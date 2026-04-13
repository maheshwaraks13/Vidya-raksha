"""
VidyaRaksha — Alert Routes
SMS alert management endpoints.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.database import db, Alert, Student
from services.sms_service import send_sms, SMSResult
from datetime import datetime

alerts_bp = Blueprint('alerts', __name__)


@alerts_bp.route('/', methods=['GET'])
@jwt_required()
def list_alerts():
    """List all alerts with filters"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    status = request.args.get('status')
    risk_level = request.args.get('risk_level')
    
    query = Alert.query.order_by(Alert.created_at.desc())
    
    if status:
        query = query.filter_by(status=status)
    if risk_level:
        query = query.filter_by(risk_level=risk_level)
    
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'alerts': [a.to_dict() for a in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    })


@alerts_bp.route('/send', methods=['POST'])
@jwt_required()
def send_alert():
    """Send SMS alert for a student"""
    data = request.get_json()
    
    if 'student_id' not in data:
        return jsonify({'error': 'student_id is required'}), 400
    
    student = Student.query.get(data['student_id'])
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    recipient_type = data.get('recipient_type', 'both')
    custom_message = data.get('message')
    
    results = []
    
    # Generate messages
    risk_pct = round(student.dropout_risk_score, 1)
    
    teacher_msg = custom_message or (
        f"[VidyaRaksha] Alert: {student.name} ({student.student_id}) "
        f"has {student.risk_level} dropout risk ({risk_pct}%). "
        f"Attendance: {student.attendance_percentage}%. "
        f"Immediate counseling recommended."
    )
    
    parent_msg = custom_message or (
        f"[VidyaRaksha] Dear Parent, your child {student.name} "
        f"has {student.attendance_percentage}% attendance and is at "
        f"{student.risk_level.lower()} risk of dropout. "
        f"Please contact the school. Helpline: 1800-XXX-XXXX"
    )
    
    user_id = int(get_jwt_identity())
    
    # Send to teacher / parent / both
    if recipient_type in ('teacher', 'both'):
        phone = data.get('teacher_phone', '')
        alert = create_and_send_alert(
            student=student,
            message=teacher_msg,
            recipient_type='teacher',
            phone=phone,
            recipient_name=data.get('teacher_name', 'Teacher'),
            user_id=user_id
        )
        results.append(alert.to_dict())
    
    if recipient_type in ('parent', 'both'):
        phone = data.get('parent_phone', student.parent_phone or '')
        alert = create_and_send_alert(
            student=student,
            message=parent_msg,
            recipient_type='parent',
            phone=phone,
            recipient_name=student.parent_name or 'Parent',
            user_id=user_id
        )
        results.append(alert.to_dict())
    
    return jsonify({
        'message': f'{len(results)} alert(s) processed',
        'alerts': results
    })


@alerts_bp.route('/send-custom', methods=['POST'])
@jwt_required()
def send_custom_alert():
    """Send a custom SMS alert"""
    data = request.get_json()
    
    required = ['phone', 'message']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    phone = data['phone']
    message = data['message']
    recipient_type = data.get('recipient_type', 'custom')
    
    # Try to send SMS
    sms_result = send_sms(phone, message)
    
    # Log the alert
    alert = Alert(
        student_id=data.get('student_id', 1),
        risk_level=data.get('risk_level', 'High'),
        risk_score=data.get('risk_score'),
        message=message,
        recipient_type=recipient_type,
        recipient_phone=phone,
        recipient_name=data.get('recipient_name', 'Custom'),
        status='sent' if sms_result.success else 'failed',
        provider=sms_result.provider,
        provider_response_id=sms_result.response_id,
        error_message=sms_result.error,
        sent_at=datetime.utcnow() if sms_result.success else None,
        triggered_by=int(get_jwt_identity())
    )
    db.session.add(alert)
    db.session.commit()
    
    return jsonify({
        'message': 'SMS sent successfully' if sms_result.success else 'SMS sending failed',
        'success': sms_result.success,
        'alert': alert.to_dict()
    })


@alerts_bp.route('/auto-trigger', methods=['POST'])
@jwt_required()
def auto_trigger_alerts():
    """
    Automatically trigger SMS alerts for all HIGH risk students
    who haven't been alerted in the last 7 days.
    """
    from datetime import timedelta
    
    cutoff = datetime.utcnow() - timedelta(days=7)
    
    high_risk_students = Student.query.filter_by(risk_level='High').all()
    
    triggered = 0
    skipped = 0
    
    user_id = int(get_jwt_identity())
    
    for student in high_risk_students:
        # Check if alert was sent recently
        recent_alert = Alert.query.filter(
            Alert.student_id == student.id,
            Alert.created_at > cutoff,
            Alert.status == 'sent'
        ).first()
        
        if recent_alert:
            skipped += 1
            continue
        
        # Send alert
        if student.parent_phone:
            risk_pct = round(student.dropout_risk_score, 1)
            message = (
                f"[VidyaRaksha] Alert: Your child {student.name} "
                f"has been identified as HIGH risk ({risk_pct}%) for dropout. "
                f"Attendance: {student.attendance_percentage}%. "
                f"Please contact the school immediately."
            )
            
            create_and_send_alert(
                student=student,
                message=message,
                recipient_type='parent',
                phone=student.parent_phone,
                recipient_name=student.parent_name or 'Parent',
                user_id=user_id
            )
            triggered += 1
    
    return jsonify({
        'message': f'Auto-trigger complete. {triggered} alerts sent, {skipped} skipped (recently alerted).',
        'triggered': triggered,
        'skipped': skipped,
        'total_high_risk': len(high_risk_students)
    })


@alerts_bp.route('/statistics', methods=['GET'])
@jwt_required()
def alert_statistics():
    """Get alert statistics for dashboard"""
    from sqlalchemy import func
    
    total_sent = Alert.query.filter_by(status='sent').count()
    total_failed = Alert.query.filter_by(status='failed').count()
    total_pending = Alert.query.filter_by(status='pending').count()
    
    # This month's alerts
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = Alert.query.filter(Alert.created_at >= month_start).count()
    
    # Weekly breakdown
    from datetime import timedelta
    weekly = []
    for i in range(4):
        week_start = now - timedelta(weeks=i+1)
        week_end = now - timedelta(weeks=i)
        count = Alert.query.filter(
            Alert.created_at >= week_start,
            Alert.created_at < week_end
        ).count()
        weekly.append({'week': f'Week {4-i}', 'count': count})
    
    return jsonify({
        'total_sent': total_sent,
        'total_failed': total_failed,
        'total_pending': total_pending,
        'this_month': this_month,
        'weekly_breakdown': weekly
    })


@alerts_bp.route('/retry/<int:alert_id>', methods=['POST'])
@jwt_required()
def retry_alert(alert_id):
    """Retry a failed alert"""
    alert = Alert.query.get(alert_id)
    if not alert:
        return jsonify({'error': 'Alert not found'}), 404
    
    if alert.status == 'sent':
        return jsonify({'error': 'Alert already sent successfully'}), 400
    
    if alert.retry_count >= alert.max_retries:
        return jsonify({'error': 'Maximum retries exceeded'}), 400
    
    sms_result = send_sms(alert.recipient_phone, alert.message)
    
    alert.retry_count += 1
    if sms_result.success:
        alert.status = 'sent'
        alert.sent_at = datetime.utcnow()
        alert.provider_response_id = sms_result.response_id
    else:
        alert.error_message = sms_result.error
    
    db.session.commit()
    
    return jsonify({
        'message': 'Retry successful' if sms_result.success else 'Retry failed',
        'alert': alert.to_dict()
    })


def create_and_send_alert(student, message, recipient_type, phone, recipient_name, user_id):
    """Helper to create and send an alert"""
    sms_result = SMSResult(success=False, provider='none', error='No phone number')
    
    if phone:
        sms_result = send_sms(phone, message)
    
    alert = Alert(
        student_id=student.id,
        risk_level=student.risk_level,
        risk_score=student.dropout_risk_score,
        message=message,
        recipient_type=recipient_type,
        recipient_phone=phone,
        recipient_name=recipient_name,
        status='sent' if sms_result.success else ('pending' if not phone else 'failed'),
        provider=sms_result.provider,
        provider_response_id=sms_result.response_id,
        error_message=sms_result.error,
        sent_at=datetime.utcnow() if sms_result.success else None,
        triggered_by=user_id
    )
    db.session.add(alert)
    db.session.commit()
    
    return alert
