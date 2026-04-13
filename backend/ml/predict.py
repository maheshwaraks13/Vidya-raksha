"""
VidyaRaksha — ML Prediction Engine
Loads the trained model and makes dropout risk predictions.
Falls back to a heuristic model if no trained model is available.
"""
try:
    import numpy as np
    import pickle
    HAS_ML = True
except ImportError:
    HAS_ML = False
    np = None
    pickle = None

import os
import json
import logging

logger = logging.getLogger(__name__)

# Global model cache
_model = None
_scaler = None
_feature_cols = None
_model_loaded = False


def load_model():
    """Load the trained model and scaler from disk"""
    global _model, _scaler, _feature_cols, _model_loaded
    
    if not HAS_ML:
        return False
        
    if _model_loaded:
        return True
    
    model_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(model_dir, 'trained_model.pkl')
    scaler_path = os.path.join(model_dir, 'scaler.pkl')
    metadata_path = os.path.join(model_dir, 'model_metadata.json')
    
    try:
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            with open(model_path, 'rb') as f:
                _model = pickle.load(f)
            with open(scaler_path, 'rb') as f:
                _scaler = pickle.load(f)
            
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                _feature_cols = metadata.get('feature_columns', [])
            
            _model_loaded = True
            logger.info("ML model loaded successfully")
            return True
        else:
            logger.warning("Model files not found. Using heuristic model.")
            return False
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        return False


def predict_risk(features: dict) -> float:
    """
    Predict dropout risk score for a student.
    
    Args:
        features: Dictionary with student features
        
    Returns:
        Risk score between 0.0 and 1.0
    """
    # Try ML model first
    if load_model() and _model is not None:
        return _predict_with_model(features)
    
    # Fallback to heuristic
    return _predict_heuristic(features)


def _predict_with_model(features: dict) -> float:
    """Predict using the trained ML model"""
    try:
        # Prepare feature vector in the correct order
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
        
        # Scale features
        feature_vector_scaled = _scaler.transform(feature_vector)
        
        # Get probability of dropout (class 1)
        prob = _model.predict_proba(feature_vector_scaled)[0][1]
        
        return float(np.clip(prob, 0, 1))
    
    except Exception as e:
        logger.error(f"Model prediction error: {str(e)}. Falling back to heuristic.")
        return _predict_heuristic(features)


def _predict_heuristic(features: dict) -> float:
    """
    Heuristic-based risk calculation (fallback when no ML model available).
    Uses weighted feature scoring similar to the frontend implementation.
    """
    attendance = features.get('attendance', 70)
    score = features.get('score', 50)
    distance = features.get('distance', 5)
    income = features.get('income', 10000)
    parent_edu = features.get('parentEdu', 1)
    health = features.get('health', 0)
    internet = features.get('internet', 0)
    failures = features.get('failures', 0)
    
    risk = 0.0
    
    # Attendance (30% weight) — lower attendance = higher risk
    risk += max(0, (75 - attendance)) / 75 * 0.30
    
    # Exam scores (25% weight) — lower scores = higher risk
    risk += max(0, (60 - score)) / 60 * 0.25
    
    # Family income (15% weight) — lower income = higher risk
    risk += max(0, (15000 - income)) / 15000 * 0.15
    
    # Distance to school (10% weight) — farther = higher risk
    risk += min(distance / 20, 1) * 0.10
    
    # Parent education (8% weight)
    risk += max(0, (2 - parent_edu)) / 2 * 0.08
    
    # Health issues (5% weight)
    risk += health * 0.05
    
    # Internet access (4% weight)
    risk += (1 - internet) * 0.04
    
    # Previous failures (3% weight)
    risk += min(failures / 3, 1) * 0.03
    
    return float(min(max(risk, 0.0), 1.0))


def get_risk_level(score: float) -> str:
    """Classify risk score into categories"""
    if score >= 0.65:
        return 'High'
    elif score >= 0.35:
        return 'Medium'
    else:
        return 'Low'


def get_model_info() -> dict:
    """Get information about the loaded model"""
    load_model()
    
    model_dir = os.path.dirname(os.path.abspath(__file__))
    metadata_path = os.path.join(model_dir, 'model_metadata.json')
    
    info = {
        'model_loaded': _model_loaded,
        'model_type': type(_model).__name__ if _model else 'Heuristic',
        'feature_columns': _feature_cols or []
    }
    
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        info['model_results'] = metadata.get('model_results', {})
    
    return info
