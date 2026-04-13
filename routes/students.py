"""
VidyaRaksha — Student Routes
CRUD operations and student management endpoints.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.database import db, Student, School
from datetime import datetime
import csv
import io

students_bp = Blueprint('students', __name__)


@students_bp.route('/', methods=['GET'])
@jwt_required()
def list_students():
    """List all students with optional filters"""
    # Query parameters
    risk_level = request.args.get('risk_level')
    school_id = request.args.get('school_id')
    grade = request.args.get('grade')
    search = request.args.get('search')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    sort_by = request.args.get('sort_by', 'dropout_risk_score')
    order = request.args.get('order', 'desc')
    
    query = Student.query
    
    # Apply filters
    if risk_level:
        query = query.filter(Student.risk_level == risk_level)
    if school_id:
        query = query.filter(Student.school_id == int(school_id))
    if grade:
        query = query.filter(Student.grade == int(grade))
    if search:
        query = query.filter(
            db.or_(
                Student.name.ilike(f'%{search}%'),
                Student.student_id.ilike(f'%{search}%')
            )
        )
    
    # Apply sorting
    sort_column = getattr(Student, sort_by, Student.dropout_risk_score)
    if order == 'desc':
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Paginate
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'students': [s.to_dict() for s in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
        'per_page': per_page
    })


@students_bp.route('/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student(student_id):
    """Get a specific student by ID"""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    # Include scheme recommendations
    recommendations = [sr.to_dict() for sr in student.scheme_recommendations.all()]
    
    # Include recent alerts
    recent_alerts = [a.to_dict() for a in student.alerts.order_by(
        db.desc('created_at')).limit(10).all()]
    
    result = student.to_dict()
    result['recommendations'] = recommendations
    result['recent_alerts'] = recent_alerts
    
    return jsonify({'student': result})


@students_bp.route('/', methods=['POST'])
@jwt_required()
def create_student():
    """Create a new student"""
    data = request.get_json()
    
    required_fields = ['name', 'age', 'gender', 'grade']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Auto-generate student_id
    last = Student.query.order_by(Student.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    student_id = data.get('student_id', f'S{next_num:03d}')
    
    if Student.query.filter_by(student_id=student_id).first():
        return jsonify({'error': 'Student ID already exists'}), 409
    
    student = Student(
        student_id=student_id,
        name=data['name'],
        age=data['age'],
        gender=data['gender'],
        grade=data['grade'],
        attendance_percentage=data.get('attendance_percentage', 0),
        exam_scores=data.get('exam_scores', 0),
        previous_failures=data.get('previous_failures', 0),
        distance_to_school=data.get('distance_to_school', 0),
        family_income=data.get('family_income', 0),
        parent_education_level=data.get('parent_education_level', 0),
        parent_occupation=data.get('parent_occupation', 0),
        transport_availability=data.get('transport_availability', False),
        internet_access=data.get('internet_access', False),
        health_issues=data.get('health_issues', False),
        parent_name=data.get('parent_name'),
        parent_phone=data.get('parent_phone'),
        school_id=data.get('school_id')
    )
    
    db.session.add(student)
    db.session.commit()
    
    return jsonify({
        'message': 'Student created successfully',
        'student': student.to_dict()
    }), 201


@students_bp.route('/<int:student_id>', methods=['PUT'])
@jwt_required()
def update_student(student_id):
    """Update a student record"""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    data = request.get_json()
    
    updatable_fields = [
        'name', 'age', 'gender', 'grade', 'attendance_percentage',
        'exam_scores', 'previous_failures', 'distance_to_school',
        'family_income', 'parent_education_level', 'parent_occupation',
        'transport_availability', 'internet_access', 'health_issues',
        'parent_name', 'parent_phone', 'school_id'
    ]
    
    for field in updatable_fields:
        if field in data:
            setattr(student, field, data[field])
    
    student.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'message': 'Student updated successfully',
        'student': student.to_dict()
    })


@students_bp.route('/<int:student_id>', methods=['DELETE'])
@jwt_required()
def delete_student(student_id):
    """Delete a student record"""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    db.session.delete(student)
    db.session.commit()
    
    return jsonify({'message': 'Student deleted successfully'})


@students_bp.route('/upload-csv', methods=['POST'])
@jwt_required()
def upload_csv():
    """Upload students from a CSV file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are accepted'}), 400
    
    try:
        content = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        
        created = 0
        errors = []
        
        for i, row in enumerate(reader, 1):
            try:
                # Auto-generate student_id if not present
                last = Student.query.order_by(Student.id.desc()).first()
                next_num = (last.id + 1) if last else 1
                sid = row.get('student_id', f'S{next_num:03d}')
                
                if Student.query.filter_by(student_id=sid).first():
                    errors.append(f'Row {i}: Student ID {sid} already exists')
                    continue
                
                student = Student(
                    student_id=sid,
                    name=row.get('name', f'Student {next_num}'),
                    age=int(row.get('age', 14)),
                    gender=row.get('gender', 'M'),
                    grade=int(row.get('grade', 8)),
                    attendance_percentage=float(row.get('attendance_percentage', 0)),
                    exam_scores=float(row.get('exam_scores', 0)),
                    previous_failures=int(row.get('previous_failures', 0)),
                    distance_to_school=float(row.get('distance_to_school', 0)),
                    family_income=float(row.get('family_income', 0)),
                    parent_education_level=int(row.get('parent_education_level', 0)),
                    parent_occupation=int(row.get('parent_occupation', 0)),
                    transport_availability=row.get('transport_availability', '0') in ('1', 'True', 'true', 'yes'),
                    internet_access=row.get('internet_access', '0') in ('1', 'True', 'true', 'yes'),
                    health_issues=row.get('health_issues', '0') in ('1', 'True', 'true', 'yes'),
                    parent_name=row.get('parent_name'),
                    parent_phone=row.get('parent_phone'),
                    school_id=int(row['school_id']) if row.get('school_id') else None
                )
                db.session.add(student)
                created += 1
            except Exception as e:
                errors.append(f'Row {i}: {str(e)}')
        
        db.session.commit()
        
        return jsonify({
            'message': f'{created} students imported successfully',
            'created': created,
            'errors': errors[:20]  # limit error list
        })
    except Exception as e:
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 400


@students_bp.route('/statistics', methods=['GET'])
@jwt_required()
def get_statistics():
    """Get aggregate statistics for dashboard"""
    total = Student.query.count()
    high_risk = Student.query.filter_by(risk_level='High').count()
    medium_risk = Student.query.filter_by(risk_level='Medium').count()
    low_risk = Student.query.filter_by(risk_level='Low').count()
    
    # Average attendance
    from sqlalchemy import func
    avg_attendance = db.session.query(func.avg(Student.attendance_percentage)).scalar() or 0
    avg_score = db.session.query(func.avg(Student.exam_scores)).scalar() or 0
    
    # School-wise breakdown
    schools = School.query.all()
    school_breakdown = []
    for school in schools:
        students_in_school = Student.query.filter_by(school_id=school.id)
        school_breakdown.append({
            'school_name': school.name,
            'total': students_in_school.count(),
            'high': students_in_school.filter_by(risk_level='High').count(),
            'medium': students_in_school.filter_by(risk_level='Medium').count(),
            'low': students_in_school.filter_by(risk_level='Low').count()
        })
    
    # Grade-wise breakdown
    grade_breakdown = []
    for grade in range(1, 13):
        count = Student.query.filter_by(grade=grade).count()
        if count > 0:
            high = Student.query.filter_by(grade=grade, risk_level='High').count()
            grade_breakdown.append({'grade': grade, 'total': count, 'high_risk': high})
    
    return jsonify({
        'total_students': total,
        'high_risk': high_risk,
        'medium_risk': medium_risk,
        'low_risk': low_risk,
        'avg_attendance': round(avg_attendance, 1),
        'avg_score': round(avg_score, 1),
        'school_breakdown': school_breakdown,
        'grade_breakdown': grade_breakdown
    })
