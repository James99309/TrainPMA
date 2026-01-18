"""
PMA 系统 API 服务
用于员工身份验证和员工数据获取
"""
import os
import requests
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# PMA 系统 API 地址
PMA_API_URL = os.getenv('PMA_API_URL', '')

# 默认公司名称（当外部API未返回时使用）
DEFAULT_COMPANY_NAME = os.getenv('DEFAULT_COMPANY_NAME', '和源通信')


def verify_employee(username: str, password: str, remember_me: bool = False) -> Dict[str, Any]:
    """
    调用 PMA 系统 API 验证员工身份

    Args:
        username: 员工账户
        password: 密码
        remember_me: 是否记住登录状态

    Returns:
        {
            'success': bool,
            'data': {...} 或 None,
            'message': str
        }
    """
    if not PMA_API_URL:
        return {
            'success': False,
            'message': 'PMA 系统未配置'
        }

    try:
        response = requests.post(
            f"{PMA_API_URL}/api/v1/auth/login",
            json={
                'username': username,
                'password': password,
                'remember_me': remember_me
            },
            timeout=10,
            headers={
                'Content-Type': 'application/json'
            }
        )

        result = response.json()

        if result.get('success'):
            user_data = result.get('data', {}).get('user', {})
            return {
                'success': True,
                'data': {
                    'employee_id': str(user_data.get('id')),
                    'real_name': user_data.get('real_name', username),
                    'username': user_data.get('username'),
                    'email': user_data.get('email'),
                    'phone': user_data.get('phone'),
                    'company': user_data.get('company_name', DEFAULT_COMPANY_NAME),
                    'pma_token': result.get('data', {}).get('token'),
                    'pma_refresh_token': result.get('data', {}).get('refresh_token')
                }
            }
        else:
            return {
                'success': False,
                'message': result.get('message', '用户名或密码错误')
            }

    except requests.Timeout:
        return {
            'success': False,
            'message': 'PMA 系统连接超时，请稍后重试'
        }
    except requests.ConnectionError:
        return {
            'success': False,
            'message': 'PMA 系统连接失败，请检查网络'
        }
    except requests.RequestException as e:
        return {
            'success': False,
            'message': f'PMA 系统请求失败: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'验证过程出错: {str(e)}'
        }


def get_all_employees(limit: int = 500, offset: int = 0, search: str = '') -> List[Dict[str, Any]]:
    """
    从 PMA 系统获取员工列表

    Args:
        limit: 返回数量限制
        offset: 偏移量
        search: 搜索关键词

    Returns:
        员工列表，格式：[{user_id, name, company, phone}]
    """
    api_key = os.getenv('PMA_EXTERNAL_API_KEY', '')
    if not PMA_API_URL or not api_key:
        logger.warning("PMA 服务未配置，返回空列表")
        return []

    try:
        params = {'limit': limit, 'offset': offset}
        if search:
            params['search'] = search

        response = requests.get(
            f"{PMA_API_URL}/api/external/employees",
            params=params,
            headers={'X-External-API-Key': api_key},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                raw_employees = data.get('data', [])
                # 添加 emp_ 前缀，保持与员工登录后的 user_id 格式一致
                employees = []
                for emp in raw_employees:
                    emp_copy = emp.copy()
                    if 'user_id' in emp_copy:
                        emp_copy['user_id'] = f"emp_{emp_copy['user_id']}"
                    employees.append(emp_copy)
                logger.info(f"从 PMA 获取到 {len(employees)} 名员工")
                return employees
            else:
                logger.error(f"PMA API 返回错误: {data.get('message')}")
                return []
        else:
            logger.error(f"PMA API 请求失败: {response.status_code} - {response.text}")
            return []

    except requests.Timeout:
        logger.error("PMA API 请求超时")
        return []
    except requests.RequestException as e:
        logger.error(f"PMA API 请求异常: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"获取 PMA 员工列表失败: {str(e)}")
        return []
