"""
VidyaRaksha — Flask Application Factory
AI-Powered Rural Student Dropout Early Warning System
"""
import os
import logging
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from models.database import db
from config import config_map

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    app.config.from_object(config_map.get(config_name, config_map['development']))
    
    # Initialize extensions
    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Ensure directories exist
    os.makedirs(app.config.get('UPLOAD_FOLDER', 'uploads'), exist_ok=True)
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    # Register blueprints
    from routes.auth import auth_bp
    from routes.students import students_bp
    from routes.predictions import predictions_bp
    from routes.alerts import alerts_bp
    from routes.schemes import schemes_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(students_bp, url_prefix='/api/students')
    app.register_blueprint(predictions_bp, url_prefix='/api/predictions')
    app.register_blueprint(alerts_bp, url_prefix='/api/alerts')
    app.register_blueprint(schemes_bp, url_prefix='/api/schemes')
    
    # API health check / model info
    @app.route('/api/health')
    def health_check():
        from ml.predict import get_model_info
        from ml.explainer import get_global_feature_importance
        model_info = get_model_info()
        return jsonify({
            'status': 'healthy',
            'app': 'VidyaRaksha — Dropout Early Warning System',
            'version': '1.0.0',
            'model': model_info,
            'feature_importance': get_global_feature_importance()
        })
    
    # Serve frontend
    @app.route('/')
    def serve_frontend():
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.route('/<path:path>')
    def serve_static(path):
        if os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')
    
    # Create tables and seed on first run
    with app.app_context():
        db.create_all()
        
        # Auto-seed if empty
        from models.database import Student
        if Student.query.count() == 0:
            logger.info("Empty database detected. Running seed...")
            from data.seed_data import seed_database
            seed_database(app, db)
    
    logger.info(f"VidyaRaksha app created [{config_name}]")
    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
