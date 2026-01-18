from flask import Blueprint, jsonify, send_from_directory
from app.services.course_service import course_service
import os

course_bp = Blueprint('course', __name__, url_prefix='/api/courses')

# 课程目录路径 - 使用绝对路径
def _get_courses_dir():
    courses_dir = os.getenv('COURSES_DIR', '/app/courses')
    if not os.path.isabs(courses_dir):
        # 相对路径：相对于 backend 目录
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        courses_dir = os.path.join(backend_dir, courses_dir)
    return os.path.abspath(courses_dir)

COURSES_DIR = _get_courses_dir()


@course_bp.route('', methods=['GET'])
def get_courses():
    """获取所有课程列表（公开接口，无需认证）"""
    try:
        courses = course_service.get_all_courses()
        return jsonify({'success': True, 'data': courses}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@course_bp.route('/<course_id>', methods=['GET'])
def get_course(course_id):
    """获取单个课程详情"""
    try:
        course = course_service.get_course(course_id)
        if not course:
            return jsonify({'success': False, 'message': '课程不存在'}), 404
        return jsonify({'success': True, 'data': course}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@course_bp.route('/<course_id>/content.pdf', methods=['GET'])
def serve_course_pdf(course_id):
    """提供课程 PDF 文件"""
    try:
        course_dir = os.path.join(COURSES_DIR, course_id)
        if not os.path.exists(os.path.join(course_dir, 'content.pdf')):
            return jsonify({'success': False, 'message': 'PDF 文件不存在'}), 404
        return send_from_directory(course_dir, 'content.pdf', mimetype='application/pdf')
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 404
