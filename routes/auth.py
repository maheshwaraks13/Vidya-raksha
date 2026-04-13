"""
VidyaRaksha — Authentication Routes
JWT-based authentication with role-based access control.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from models.database import db, User
from datetime import datetime
from functools import wraps

auth_bp = Blueprint('auth', __name__)


def role_required(*roles):
    """Decorator to enforce role-based access"""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            user_role = claims.get('role', '')
            if user_role not in roles:
                return jsonify({'error': 'Access denied. Insufficient permissions.'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    required_fields = ['username', 'email', 'password', 'full_name']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Check unique constraints
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 409
    
    user = User(
        username=data['username'],
        email=data['email'],
        full_name=data['full_name'],
        role=data.get('role', 'teacher'),
        phone=data.get('phone'),
        school_id=data.get('school_id')
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'User registered successfully',
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login and get JWT token"""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    # Create token with role in claims
    additional_claims = {
        'role': user.role,
        'full_name': user.full_name,
        'school_id': user.school_id
    }
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims=additional_claims
    )
    
    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user': user.to_dict()
    })


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()})


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user profile"""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'email' in data:
        user.email = data['email']
    if 'phone' in data:
        user.phone = data['phone']
    if 'password' in data:
        user.set_password(data['password'])
    
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': user.to_dict()})


@auth_bp.route('/users', methods=['GET'])
@role_required('admin')
def list_users():
    """List all users (admin only)"""
    users = User.query.all()
    return jsonify({'users': [u.to_dict() for u in users]})


@auth_bp.route('/users/<int:user_id>/toggle', methods=['PUT'])
@role_required('admin')
def toggle_user(user_id):
    """Activate/deactivate a user (admin only)"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.is_active = not user.is_active
    db.session.commit()
    return jsonify({'message': f'User {"activated" if user.is_active else "deactivated"}', 'user': user.to_dict()})
