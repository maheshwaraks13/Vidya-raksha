"""
VidyaRaksha — SHAP Explainability Engine
Provides feature importance explanations for dropout predictions.
Uses SHAP when available, falls back to feature-importance heuristic.
"""
import os
import json
import logging

logger = logging.getLogger(__name__)

try:
    import numpy as np
    import pickle
    import shap
    HAS_ML = True
    SHAP_AVAILABLE = True
except ImportError:
    HAS_ML = False
    SHAP_AVAILABLE = False
    np = None
    pickle = None
    logger.warning("ML libraries (numpy/shap/pickle) not available. Using heuristic explanations.")


# Feature display names
FEATURE_NAMES = {
    'age': 'Student Age',
    'grade': 'Grade Level',
    'attendance': 'Attendance (%)',
    'score': 'Exam Score',
    'distance': 'Distance to School (km)',
    'income': 'Family Income (₹/month)',
    'parentEdu': 'Parent Education Level',
    'occupation': 'Parent Occupation',
    'health': 'Health Issues',
    'internet': 'Internet Access',
    'failures': 'Previous Failures',
    'transport': 'Transport Available',
    'gender': 'Gender'
}

FEATURE_ORDER = [
    'age', 'grade', 'attendance', 'score', 'distance',
    'income', 'parentEdu', 'occupation', 'health',
    'internet', 'failures', 'transport', 'gender'
]


def explain_prediction(features: dict) -> list:
    """
    Generate explanation for a prediction.
    Returns list of {feature, display_name, value, impact, direction} dicts.
    """
    # Try SHAP-based explanation
    if SHAP_AVAILABLE:
        try:
            return _explain_with_shap(features)
        except Exception as e:
            logger.warning(f"SHAP explanation failed: {e}. Using heuristic.")
    
    # Fallback to heuristic explanation
    return _explain_heuristic(features)


def _explain_with_shap(features: dict) -> list:
    """Generate SHAP-based explanations"""
    model_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(model_dir, 'trained_model.pkl')
    scaler_path = os.path.join(model_dir, 'scaler.pkl')
    
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    with open(scaler_path, 'rb') as f:
        scaler = pickle.load(f)
    
    # Prepare feature vector
    feature_vector = np.array([[
        features.get('age', 14),
        features.get('grade', 8),
        features.get('attendance', 70),
        features.get('score', 50),
        features.get('distance', 5),
        features.get('income', 10000),
        features.get('parentEdu', 1),
        features.get('occupation', 1),
        features.get('health', 0),
        features.get('internet', 0),
        features.get('failures', 0),
        1 if features.get('transport', True) else 0,
        1 if features.get('gender', 'M') == 'F' else 0
    ]])
    
    feature_vector_scaled = scaler.transform(feature_vector)
    
    # Create SHAP explainer
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(feature_vector_scaled)
    
    # For binary classification, get values for positive class (dropout=1)
    if isinstance(shap_values, list):
        values = shap_values[1][0]
    else:
        values = shap_values[0]
    
    # Build explanation list
    explanations = []
    feature_keys = [
        'age', 'grade', 'attendance', 'score', 'distance',
        'income', 'parentEdu', 'occupation', 'health',
        'internet', 'failures', 'transport', 'gender'
    ]
    
    for i, key in enumerate(feature_keys):
        raw_values = {
            'age': features.get('age', 14),
            'grade': features.get('grade', 8),
            'attendance': features.get('attendance', 70),
            'score': features.get('score', 50),
            'distance': features.get('distance', 5),
            'income': features.get('income', 10000),
            'parentEdu': features.get('parentEdu', 1),
            'occupation': features.get('occupation', 1),
            'health': features.get('health', 0),
            'internet': features.get('internet', 0),
            'failures': features.get('failures', 0),
            'transport': 1 if features.get('transport', True) else 0,
            'gender': 1 if features.get('gender', 'M') == 'F' else 0
        }
        
        impact = float(values[i])
        explanations.append({
            'feature': key,
            'display_name': FEATURE_NAMES.get(key, key),
            'value': raw_values.get(key, 0),
            'impact': round(impact, 4),
            'direction': 'positive' if impact > 0 else 'negative',
            'abs_impact': abs(round(impact, 4))
        })
    
    # Sort by absolute impact
    explanations.sort(key=lambda x: x['abs_impact'], reverse=True)
    
    return explanations


def _explain_heuristic(features: dict) -> list:
    """
    Generate heuristic-based explanations without SHAP.
    Calculates feature contributions based on weighted scoring.
    """
    attendance = features.get('attendance', 70)
    score = features.get('score', 50)
    distance = features.get('distance', 5)
    income = features.get('income', 10000)
    parent_edu = features.get('parentEdu', 1)
    health = features.get('health', 0)
    internet = features.get('internet', 0)
    failures = features.get('failures', 0)
    gender = features.get('gender', 'M')
    
    explanations = [
        {
            'feature': 'attendance',
            'display_name': 'Attendance (%)',
            'value': attendance,
            'impact': round(max(0, (75 - attendance)) / 75 * 0.30, 4),
            'direction': 'positive' if attendance < 75 else 'negative',
            'abs_impact': round(abs(max(0, (75 - attendance)) / 75 * 0.30), 4)
        },
        {
            'feature': 'score',
            'display_name': 'Exam Score',
            'value': score,
            'impact': round(max(0, (60 - score)) / 60 * 0.25, 4),
            'direction': 'positive' if score < 60 else 'negative',
            'abs_impact': round(abs(max(0, (60 - score)) / 60 * 0.25), 4)
        },
        {
            'feature': 'income',
            'display_name': 'Family Income (₹/month)',
            'value': income,
            'impact': round(max(0, (15000 - income)) / 15000 * 0.15, 4),
            'direction': 'positive' if income < 15000 else 'negative',
            'abs_impact': round(abs(max(0, (15000 - income)) / 15000 * 0.15), 4)
        },
        {
            'feature': 'distance',
            'display_name': 'Distance to School (km)',
            'value': distance,
            'impact': round(min(distance / 20, 1) * 0.10, 4),
            'direction': 'positive' if distance > 5 else 'negative',
            'abs_impact': round(abs(min(distance / 20, 1) * 0.10), 4)
        },
        {
            'feature': 'parentEdu',
            'display_name': 'Parent Education Level',
            'value': parent_edu,
            'impact': round(max(0, (2 - parent_edu)) / 2 * 0.08, 4),
            'direction': 'positive' if parent_edu < 2 else 'negative',
            'abs_impact': round(abs(max(0, (2 - parent_edu)) / 2 * 0.08), 4)
        },
        {
            'feature': 'health',
            'display_name': 'Health Issues',
            'value': health,
            'impact': round(health * 0.05, 4),
            'direction': 'positive' if health == 1 else 'negative',
            'abs_impact': round(abs(health * 0.05), 4)
        },
        {
            'feature': 'internet',
            'display_name': 'Internet Access',
            'value': internet,
            'impact': round((1 - internet) * 0.04, 4),
            'direction': 'positive' if internet == 0 else 'negative',
            'abs_impact': round(abs((1 - internet) * 0.04), 4)
        },
        {
            'feature': 'failures',
            'display_name': 'Previous Failures',
            'value': failures,
            'impact': round(min(failures / 3, 1) * 0.03, 4),
            'direction': 'positive' if failures > 0 else 'negative',
            'abs_impact': round(abs(min(failures / 3, 1) * 0.03), 4)
        }
    ]
    
    # Sort by absolute impact
    explanations.sort(key=lambda x: x['abs_impact'], reverse=True)
    
    return explanations


def get_global_feature_importance() -> list:
    """
    Get global feature importance across all predictions.
    Uses model's built-in feature importances if available.
    """
    model_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(model_dir, 'trained_model.pkl')
    
    feature_names = [
        'Age', 'Grade', 'Attendance', 'Exam Score', 'Distance',
        'Family Income', 'Parent Education', 'Parent Occupation',
        'Health Issues', 'Internet Access', 'Previous Failures',
        'Transport', 'Gender'
    ]
    
    try:
        if HAS_ML and os.path.exists(model_path):
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            
            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
                result = []
                for i, name in enumerate(feature_names):
                    result.append({
                        'feature': name,
                        'importance': round(float(importances[i]), 4)
                    })
                result.sort(key=lambda x: x['importance'], reverse=True)
                return result
    except Exception as e:
        logger.error(f"Error getting feature importance: {e}")
    
    # Fallback: return heuristic weights
    return [
        {'feature': 'Attendance', 'importance': 0.30},
        {'feature': 'Exam Score', 'importance': 0.25},
        {'feature': 'Family Income', 'importance': 0.15},
        {'feature': 'Distance', 'importance': 0.10},
        {'feature': 'Parent Education', 'importance': 0.08},
        {'feature': 'Health Issues', 'importance': 0.05},
        {'feature': 'Internet Access', 'importance': 0.04},
        {'feature': 'Previous Failures', 'importance': 0.03},
    ]
