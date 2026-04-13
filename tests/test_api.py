"""
VidyaRaksha — API Tests
Tests for all REST API endpoints.
"""
import pytest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.database import db as _db


@pytest.fixture(scope='session')
def app():
    """Create application for testing"""
    app = create_app('testing')
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope='session')
def client(app):
    """Test client"""
    return app.test_client()


@pytest.fixture(scope='session')
def auth_headers(client):
    """Get auth headers by registering and logging in"""
    # Register
    client.post('/api/auth/register', json={
        'username': 'testadmin',
        'email': 'test@test.com',
        'password': 'test123',
        'full_name': 'Test Admin',
        'role': 'admin'
    })
    
    # Login
    response = client.post('/api/auth/login', json={
        'username': 'testadmin',
        'password': 'test123'
    })
    data = json.loads(response.data)
    token = data['access_token']
    
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


# ── Health Check ──
class TestHealth:
    def test_health_check(self, client):
        response = client.get('/api/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'VidyaRaksha' in data['app']


# ── Authentication ──
class TestAuth:
    def test_register(self, client):
        response = client.post('/api/auth/register', json={
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'pass123',
            'full_name': 'New User',
            'role': 'teacher'
        })
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['user']['username'] == 'newuser'
    
    def test_register_duplicate(self, client):
        response = client.post('/api/auth/register', json={
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'pass123',
            'full_name': 'New User'
        })
        assert response.status_code == 409
    
    def test_login_success(self, client):
        response = client.post('/api/auth/login', json={
            'username': 'newuser',
            'password': 'pass123'
        })
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'access_token' in data
    
    def test_login_fail(self, client):
        response = client.post('/api/auth/login', json={
            'username': 'newuser',
            'password': 'wrongpassword'
        })
        assert response.status_code == 401
    
    def test_profile(self, client, auth_headers):
        response = client.get('/api/auth/profile', headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['username'] == 'testadmin'
    
    def test_unauthorized(self, client):
        response = client.get('/api/auth/profile')
        assert response.status_code == 401


# ── Students ──
class TestStudents:
    def test_create_student(self, client, auth_headers):
        response = client.post('/api/students/', json={
            'name': 'Test Student',
            'age': 14,
            'gender': 'M',
            'grade': 8,
            'attendance_percentage': 65.0,
            'exam_scores': 55.0,
            'distance_to_school': 5.0,
            'family_income': 10000,
            'parent_education_level': 1,
            'health_issues': False,
            'internet_access': False,
            'previous_failures': 1
        }, headers=auth_headers)
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['student']['name'] == 'Test Student'
    
    def test_list_students(self, client, auth_headers):
        response = client.get('/api/students/', headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'students' in data
        assert 'total' in data
    
    def test_get_student(self, client, auth_headers):
        response = client.get('/api/students/1', headers=auth_headers)
        assert response.status_code == 200
    
    def test_update_student(self, client, auth_headers):
        response = client.put('/api/students/1', json={
            'attendance_percentage': 75.0
        }, headers=auth_headers)
        assert response.status_code == 200
    
    def test_filter_students(self, client, auth_headers):
        response = client.get('/api/students/?search=Test', headers=auth_headers)
        assert response.status_code == 200
    
    def test_statistics(self, client, auth_headers):
        response = client.get('/api/students/statistics', headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'total_students' in data


# ── Predictions ──
class TestPredictions:
    def test_predict_raw(self, client, auth_headers):
        response = client.post('/api/predictions/predict', json={
            'attendance': 45,
            'score': 35,
            'distance': 10,
            'income': 6000,
            'parentEdu': 0,
            'health': 1,
            'internet': 0,
            'failures': 2,
            'gender': 'F'
        }, headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'risk_score' in data
        assert 'risk_level' in data
        assert 'shap_values' in data
        assert 'explanation' in data
        assert 'matched_schemes' in data
    
    def test_predict_student(self, client, auth_headers):
        response = client.post('/api/predictions/predict', json={
            'student_id': 1
        }, headers=auth_headers)
        assert response.status_code == 200
    
    def test_predict_batch(self, client, auth_headers):
        response = client.post('/api/predictions/predict-batch', json={},
                               headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'total_processed' in data
    
    def test_prediction_history(self, client, auth_headers):
        response = client.get('/api/predictions/history', headers=auth_headers)
        assert response.status_code == 200


# ── Alerts ──
class TestAlerts:
    def test_send_custom_alert(self, client, auth_headers):
        response = client.post('/api/alerts/send-custom', json={
            'phone': '9876543210',
            'message': 'Test alert message',
            'student_id': 1
        }, headers=auth_headers)
        assert response.status_code == 200
    
    def test_list_alerts(self, client, auth_headers):
        response = client.get('/api/alerts/', headers=auth_headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'alerts' in data
    
    def test_alert_statistics(self, client, auth_headers):
        response = client.get('/api/alerts/statistics', headers=auth_headers)
        assert response.status_code == 200


# ── Schemes ──
class TestSchemes:
    def test_list_schemes(self, client, auth_headers):
        # First create a scheme
        client.post('/api/schemes/', json={
            'scheme_name': 'Test Scholarship',
            'ministry': 'Test Ministry',
            'description': 'Test description',
            'condition_type': 'income',
            'condition_operator': '<',
            'condition_value': '10000'
        }, headers=auth_headers)
        
        response = client.get('/api/schemes/', headers=auth_headers)
        assert response.status_code == 200
    
    def test_create_scheme(self, client, auth_headers):
        response = client.post('/api/schemes/', json={
            'scheme_name': 'Girl Education Fund',
            'ministry': 'Ministry of Education',
            'description': 'Financial support for girl students',
            'icon': '👧',
            'condition_type': 'gender',
            'condition_operator': '==',
            'condition_value': 'F'
        }, headers=auth_headers)
        assert response.status_code == 201
    
    def test_match_schemes(self, client, auth_headers):
        response = client.get('/api/schemes/match/1', headers=auth_headers)
        assert response.status_code == 200


# ── ML Model Tests ──
class TestMLModel:
    def test_risk_score_high(self):
        from ml.predict import predict_risk, get_risk_level
        score = predict_risk({
            'attendance': 30, 'score': 25, 'distance': 15,
            'income': 4000, 'parentEdu': 0, 'health': 1,
            'internet': 0, 'failures': 3
        })
        assert 0 <= score <= 1
        assert get_risk_level(score) == 'High'
    
    def test_risk_score_low(self):
        from ml.predict import predict_risk, get_risk_level
        score = predict_risk({
            'attendance': 90, 'score': 85, 'distance': 2,
            'income': 25000, 'parentEdu': 3, 'health': 0,
            'internet': 1, 'failures': 0
        })
        assert 0 <= score <= 1
        assert get_risk_level(score) == 'Low'
    
    def test_explain_prediction(self):
        from ml.explainer import explain_prediction
        explanations = explain_prediction({
            'attendance': 40, 'score': 30, 'distance': 10,
            'income': 5000, 'parentEdu': 0, 'health': 1,
            'internet': 0, 'failures': 2
        })
        assert len(explanations) > 0
        assert 'feature' in explanations[0]
        assert 'impact' in explanations[0]
    
    def test_scheme_matching(self):
        from services.scheme_matcher import match_schemes
        matched = match_schemes({
            'attendance': 40, 'score': 30, 'distance': 10,
            'income': 5000, 'parentEdu': 0, 'health': 1,
            'internet': 0, 'failures': 2, 'gender': 'F'
        }, 'High')
        # Should match some schemes for a high-risk female student with low income
        assert isinstance(matched, list)


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
