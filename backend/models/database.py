"""
VidyaRaksha — Database Models (SQLAlchemy ORM)
Complete data model for the Dropout Early Warning System.
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    """User accounts for authentication (Admin, Teacher, Gov Officer)"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='teacher')  # admin, teacher, gov_officer
    phone = db.Column(db.String(15))
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    school = db.relationship('School', backref='staff')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'phone': self.phone,
            'school_id': self.school_id,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }


class School(db.Model):
    """School information"""
    __tablename__ = 'schools'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    district = db.Column(db.String(100), nullable=False)
    block = db.Column(db.String(100))
    state = db.Column(db.String(100), default='Maharashtra')
    contact_phone = db.Column(db.String(15))
    contact_email = db.Column(db.String(120))
    principal_name = db.Column(db.String(150))
    total_students = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    students = db.relationship('Student', backref='school', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'district': self.district,
            'block': self.block,
            'state': self.state,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'principal_name': self.principal_name,
            'total_students': self.total_students,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Student(db.Model):
    """Student records with all features needed for ML prediction"""
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), unique=True, nullable=False)  # e.g. S001
    name = db.Column(db.String(150), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(1), nullable=False)  # M or F
    grade = db.Column(db.Integer, nullable=False)
    
    # Academic features
    attendance_percentage = db.Column(db.Float, nullable=False, default=0.0)
    exam_scores = db.Column(db.Float, nullable=False, default=0.0)
    previous_failures = db.Column(db.Integer, default=0)
    
    # Socio-economic features
    distance_to_school = db.Column(db.Float, nullable=False, default=0.0)  # in km
    family_income = db.Column(db.Float, nullable=False, default=0.0)  # monthly in INR
    parent_education_level = db.Column(db.Integer, default=0)  # 0=None, 1=Primary, 2=Secondary, 3=Graduate+
    parent_occupation = db.Column(db.Integer, default=0)  # 0=Daily labour, 1=Farmer, 2=Small business, 3=Govt
    
    # Infrastructure features
    transport_availability = db.Column(db.Boolean, default=False)
    internet_access = db.Column(db.Boolean, default=False)
    
    # Health
    health_issues = db.Column(db.Boolean, default=False)
    
    # Prediction results
    dropout_risk_score = db.Column(db.Float, default=0.0)  # 0-100
    risk_level = db.Column(db.String(10), default='Low')  # Low, Medium, High
    last_predicted_at = db.Column(db.DateTime)
    
    # Contact info
    parent_name = db.Column(db.String(150))
    parent_phone = db.Column(db.String(15))
    
    # Relationships
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    alerts = db.relationship('Alert', backref='student', lazy='dynamic')
    scheme_recommendations = db.relationship('SchemeRecommendation', backref='student', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'grade': self.grade,
            'attendance_percentage': self.attendance_percentage,
            'exam_scores': self.exam_scores,
            'previous_failures': self.previous_failures,
            'distance_to_school': self.distance_to_school,
            'family_income': self.family_income,
            'parent_education_level': self.parent_education_level,
            'parent_occupation': self.parent_occupation,
            'transport_availability': self.transport_availability,
            'internet_access': self.internet_access,
            'health_issues': self.health_issues,
            'dropout_risk_score': self.dropout_risk_score,
            'risk_level': self.risk_level,
            'last_predicted_at': self.last_predicted_at.isoformat() if self.last_predicted_at else None,
            'parent_name': self.parent_name,
            'parent_phone': self.parent_phone,
            'school_id': self.school_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def to_feature_dict(self):
        """Return features needed for ML prediction"""
        return {
            'attendance': self.attendance_percentage,
            'score': self.exam_scores,
            'distance': self.distance_to_school,
            'income': self.family_income,
            'parentEdu': self.parent_education_level,
            'health': 1 if self.health_issues else 0,
            'internet': 1 if self.internet_access else 0,
            'failures': self.previous_failures,
            'gender': self.gender,
            'occupation': self.parent_occupation,
            'age': self.age,
            'grade': self.grade
        }


class Alert(db.Model):
    """SMS alert records"""
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    risk_level = db.Column(db.String(10), nullable=False)
    risk_score = db.Column(db.Float)
    
    # Message details
    message = db.Column(db.Text, nullable=False)
    recipient_type = db.Column(db.String(20), nullable=False)  # parent, teacher, admin, both
    recipient_phone = db.Column(db.String(15))
    recipient_name = db.Column(db.String(150))
    
    # Status tracking
    status = db.Column(db.String(20), default='pending')  # pending, sent, failed, queued
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    error_message = db.Column(db.Text)
    
    # SMS provider response
    provider = db.Column(db.String(20))  # fast2sms, twilio
    provider_response_id = db.Column(db.String(100))
    
    sent_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Who triggered this alert
    triggered_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    trigger_user = db.relationship('User', backref='triggered_alerts')
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'message': self.message,
            'recipient_type': self.recipient_type,
            'recipient_phone': self.recipient_phone,
            'recipient_name': self.recipient_name,
            'status': self.status,
            'retry_count': self.retry_count,
            'provider': self.provider,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Scheme(db.Model):
    """Government welfare schemes"""
    __tablename__ = 'schemes'
    
    id = db.Column(db.Integer, primary_key=True)
    scheme_name = db.Column(db.String(200), nullable=False)
    ministry = db.Column(db.String(200))
    description = db.Column(db.Text)
    eligibility = db.Column(db.Text)
    benefits = db.Column(db.Text)
    icon = db.Column(db.String(10), default='📋')
    
    # Matching conditions (stored as JSON-like string)
    condition_type = db.Column(db.String(50))  # income, distance, gender, health, internet, etc.
    condition_operator = db.Column(db.String(5))  # <, >, ==, <=, >=
    condition_value = db.Column(db.String(50))
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'scheme_name': self.scheme_name,
            'ministry': self.ministry,
            'description': self.description,
            'eligibility': self.eligibility,
            'benefits': self.benefits,
            'icon': self.icon,
            'condition_type': self.condition_type,
            'condition_operator': self.condition_operator,
            'condition_value': self.condition_value,
            'is_active': self.is_active
        }


class SchemeRecommendation(db.Model):
    """Track which schemes are recommended for which students"""
    __tablename__ = 'scheme_recommendations'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    scheme_id = db.Column(db.Integer, db.ForeignKey('schemes.id'), nullable=False)
    recommended_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='recommended')  # recommended, applied, approved, rejected
    
    scheme = db.relationship('Scheme', backref='recommendations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'scheme': self.scheme.to_dict() if self.scheme else None,
            'recommended_at': self.recommended_at.isoformat() if self.recommended_at else None,
            'status': self.status
        }


class PredictionLog(db.Model):
    """Log all predictions for auditing"""
    __tablename__ = 'prediction_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    
    # Input features (snapshot at prediction time)
    input_features = db.Column(db.Text)  # JSON string
    
    # Prediction results
    risk_score = db.Column(db.Float, nullable=False)
    risk_level = db.Column(db.String(10), nullable=False)
    
    # SHAP values (JSON string)
    shap_values = db.Column(db.Text)
    
    # Model info
    model_version = db.Column(db.String(50))
    model_accuracy = db.Column(db.Float)
    
    predicted_at = db.Column(db.DateTime, default=datetime.utcnow)
    predicted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'risk_score': self.risk_score,
            'risk_level': self.risk_level,
            'shap_values': self.shap_values,
            'model_version': self.model_version,
            'predicted_at': self.predicted_at.isoformat() if self.predicted_at else None
        }
