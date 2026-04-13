"""
VidyaRaksha — Scheme Routes
Government welfare scheme management endpoints.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models.database import db, Scheme, Student, SchemeRecommendation
from services.scheme_matcher import match_schemes_for_student

schemes_bp = Blueprint('schemes', __name__)


@schemes_bp.route('/', methods=['GET'])
@jwt_required()
def list_schemes():
    """List all government schemes"""
    schemes = Scheme.query.filter_by(is_active=True).all()
    return jsonify({'schemes': [s.to_dict() for s in schemes]})


@schemes_bp.route('/<int:scheme_id>', methods=['GET'])
@jwt_required()
def get_scheme(scheme_id):
    """Get a specific scheme"""
    scheme = Scheme.query.get(scheme_id)
    if not scheme:
        return jsonify({'error': 'Scheme not found'}), 404
    return jsonify({'scheme': scheme.to_dict()})


@schemes_bp.route('/', methods=['POST'])
@jwt_required()
def create_scheme():
    """Create a new scheme"""
    data = request.get_json()
    
    if 'scheme_name' not in data:
        return jsonify({'error': 'scheme_name is required'}), 400
    
    scheme = Scheme(
        scheme_name=data['scheme_name'],
        ministry=data.get('ministry', ''),
        description=data.get('description', ''),
        eligibility=data.get('eligibility', ''),
        benefits=data.get('benefits', ''),
        icon=data.get('icon', '📋'),
        condition_type=data.get('condition_type'),
        condition_operator=data.get('condition_operator'),
        condition_value=data.get('condition_value')
    )
    db.session.add(scheme)
    db.session.commit()
    
    return jsonify({
        'message': 'Scheme created successfully',
        'scheme': scheme.to_dict()
    }), 201


@schemes_bp.route('/match/<int:student_id>', methods=['GET'])
@jwt_required()
def match_student_schemes(student_id):
    """Get schemes matched for a specific student"""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    matched = match_schemes_for_student(student)
    
    return jsonify({
        'student_name': student.name,
        'student_id': student.student_id,
        'matched_schemes': matched
    })


@schemes_bp.route('/recommend/<int:student_id>/<int:scheme_id>', methods=['POST'])
@jwt_required()
def recommend_scheme(student_id, scheme_id):
    """Record a scheme recommendation for a student"""
    student = Student.query.get(student_id)
    scheme = Scheme.query.get(scheme_id)
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    if not scheme:
        return jsonify({'error': 'Scheme not found'}), 404
    
    # Check if already recommended
    existing = SchemeRecommendation.query.filter_by(
        student_id=student_id, scheme_id=scheme_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Scheme already recommended', 'recommendation': existing.to_dict()}), 409
    
    rec = SchemeRecommendation(
        student_id=student_id,
        scheme_id=scheme_id
    )
    db.session.add(rec)
    db.session.commit()
    
    return jsonify({
        'message': 'Scheme recommended successfully',
        'recommendation': rec.to_dict()
    }), 201


@schemes_bp.route('/recommendations', methods=['GET'])
@jwt_required()
def list_recommendations():
    """List all scheme recommendations"""
    student_id = request.args.get('student_id')
    
    query = SchemeRecommendation.query
    if student_id:
        query = query.filter_by(student_id=int(student_id))
    
    recs = query.order_by(SchemeRecommendation.recommended_at.desc()).all()
    return jsonify({'recommendations': [r.to_dict() for r in recs]})
