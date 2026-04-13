"""
VidyaRaksha — Prediction Routes
ML prediction endpoints with SHAP explainability.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.database import db, Student, PredictionLog
from ml.predict import predict_risk, get_risk_level
from ml.explainer import explain_prediction
from services.scheme_matcher import match_schemes
from datetime import datetime
import json

predictions_bp = Blueprint('predictions', __name__)


@predictions_bp.route('/predict', methods=['POST'])
@jwt_required()
def predict():
    """
    Predict dropout risk for a student.
    Accepts either a student ID (to predict from DB) or raw features.
    """
    data = request.get_json()
    
    # If student_id is provided, fetch from DB
    student = None
    if 'student_id' in data:
        student = Student.query.get(data['student_id'])
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        features = student.to_feature_dict()
    else:
        # Use raw features from request
        required = ['attendance', 'score', 'distance', 'income']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Missing required feature: {field}'}), 400
        features = {
            'attendance': float(data.get('attendance', 0)),
            'score': float(data.get('score', 0)),
            'distance': float(data.get('distance', 0)),
            'income': float(data.get('income', 0)),
            'parentEdu': int(data.get('parentEdu', 0)),
            'health': int(data.get('health', 0)),
            'internet': int(data.get('internet', 0)),
            'failures': int(data.get('failures', 0)),
            'gender': data.get('gender', 'M'),
            'occupation': int(data.get('occupation', 0)),
            'age': int(data.get('age', 14)),
            'grade': int(data.get('grade', 8))
        }
    
    # Run prediction
    risk_score = predict_risk(features)
    risk_level = get_risk_level(risk_score)
    
    # Get SHAP explanation
    shap_values = explain_prediction(features)
    
    # Match government schemes
    matched_schemes = match_schemes(features, risk_level)
    
    # Generate human-readable explanation
    explanation = generate_explanation(features, shap_values, risk_level)
    
    # Update student record if we have one
    if student:
        student.dropout_risk_score = round(risk_score * 100, 1)
        student.risk_level = risk_level
        student.last_predicted_at = datetime.utcnow()
        db.session.commit()
    
    # Log prediction
    log = PredictionLog(
        student_id=student.id if student else None,
        input_features=json.dumps(features),
        risk_score=round(risk_score * 100, 1),
        risk_level=risk_level,
        shap_values=json.dumps(shap_values),
        model_version='RF_v1.0',
        predicted_by=int(get_jwt_identity())
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'risk_score': round(risk_score * 100, 1),
        'risk_level': risk_level,
        'shap_values': shap_values,
        'explanation': explanation,
        'matched_schemes': matched_schemes,
        'student': student.to_dict() if student else None,
        'prediction_id': log.id
    })


@predictions_bp.route('/predict-batch', methods=['POST'])
@jwt_required()
def predict_batch():
    """
    Run predictions for all students (or a filtered set).
    Used for periodic batch processing.
    """
    data = request.get_json() or {}
    school_id = data.get('school_id')
    grade = data.get('grade')
    
    query = Student.query
    if school_id:
        query = query.filter_by(school_id=school_id)
    if grade:
        query = query.filter_by(grade=grade)
    
    students = query.all()
    results = []
    high_risk_count = 0
    
    for student in students:
        features = student.to_feature_dict()
        risk_score = predict_risk(features)
        risk_level = get_risk_level(risk_score)
        
        student.dropout_risk_score = round(risk_score * 100, 1)
        student.risk_level = risk_level
        student.last_predicted_at = datetime.utcnow()
        
        if risk_level == 'High':
            high_risk_count += 1
        
        results.append({
            'student_id': student.student_id,
            'name': student.name,
            'risk_score': round(risk_score * 100, 1),
            'risk_level': risk_level
        })
    
    db.session.commit()
    
    return jsonify({
        'message': f'Predictions completed for {len(results)} students',
        'total_processed': len(results),
        'high_risk_count': high_risk_count,
        'results': results
    })


@predictions_bp.route('/history', methods=['GET'])
@jwt_required()
def prediction_history():
    """Get prediction history"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    student_id = request.args.get('student_id')
    
    query = PredictionLog.query
    if student_id:
        query = query.filter_by(student_id=int(student_id))
    
    query = query.order_by(PredictionLog.predicted_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'predictions': [p.to_dict() for p in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    })


def generate_explanation(features, shap_values, risk_level):
    """Generate a human-readable explanation from SHAP values"""
    if risk_level == 'Low':
        prefix = "This student has a LOW dropout risk."
    elif risk_level == 'Medium':
        prefix = "This student has a MODERATE dropout risk."
    else:
        prefix = "⚠️ This student has a HIGH dropout risk."
    
    # Sort SHAP values by absolute impact
    sorted_shap = sorted(shap_values, key=lambda x: abs(x['impact']), reverse=True)
    top_factors = sorted_shap[:3]
    
    factor_strings = []
    for f in top_factors:
        name = f['feature'].replace('_', ' ').title()
        if f['impact'] > 0:
            factor_strings.append(f"low {name}")
        else:
            factor_strings.append(f"adequate {name}")
    
    reasons = ", ".join(factor_strings)
    
    # Specific recommendations
    recommendations = []
    if features.get('attendance', 100) < 60:
        recommendations.append("Immediate attendance counseling is recommended.")
    if features.get('income', 99999) < 10000:
        recommendations.append("Financial aid schemes should be explored.")
    if features.get('health', 0) == 1:
        recommendations.append("Health screening and support is needed.")
    if features.get('distance', 0) > 8:
        recommendations.append("Transport support may reduce absenteeism.")
    
    explanation = f"{prefix} Key contributing factors: {reasons}."
    if recommendations:
        explanation += " " + " ".join(recommendations)
    
    return explanation
