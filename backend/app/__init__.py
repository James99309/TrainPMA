from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

def create_app(config_name='development'):
    """Flask应用工厂"""
    app = Flask(__name__)
    
    # 配置
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-key-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 86400))
    
    # CORS配置
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',')
    CORS(app, resources={
        r"/api/*": {
            "origins": cors_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-API-Key"]
        }
    })
    
    # JWT
    jwt = JWTManager(app)

    # JWT 错误处理回调 (用于调试 422 错误)
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        app.logger.warning(f"JWT expired: sub={jwt_payload.get('sub')}")
        return {'error': 'Token has expired', 'code': 'token_expired'}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        app.logger.warning(f"Invalid JWT: {error}")
        return {'error': 'Invalid token', 'code': 'invalid_token', 'detail': str(error)}, 422

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        app.logger.warning(f"Missing JWT: {error}")
        return {'error': 'Authorization required', 'code': 'missing_token'}, 401

    @jwt.token_verification_failed_loader
    def token_verification_failed_callback(jwt_header, jwt_payload):
        app.logger.warning(f"JWT verification failed: {jwt_payload}")
        return {'error': 'Token verification failed', 'code': 'verification_failed'}, 422
    
    # 注册蓝图
    from app.routes import auth, survey, quiz, leaderboard, admin, course, progress
    from app.routes import syllabus, user_group

    app.register_blueprint(auth.auth_bp)
    app.register_blueprint(survey.survey_bp)
    app.register_blueprint(quiz.quiz_bp)
    app.register_blueprint(leaderboard.leaderboard_bp)
    app.register_blueprint(admin.admin_bp)
    app.register_blueprint(course.course_bp)
    app.register_blueprint(progress.progress_bp)
    app.register_blueprint(syllabus.syllabus_bp)
    app.register_blueprint(user_group.user_group_bp)
    
    # 健康检查路由
    @app.route('/health', methods=['GET'])
    @app.route('/api/health', methods=['GET'])
    def health():
        return {'status': 'ok', 'message': 'Quiz System Backend is running'}, 200
    
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not Found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal Server Error'}, 500
    
    return app
