"""
PMA 系统 API 服务
用于员工身份验证和员工数据获取
支持双数据源：SP8D（人民币市场）和 OVS（美元市场）
"""
import os
import requests
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# 默认公司名称（当外部API未返回时使用）
DEFAULT_COMPANY_NAME = os.getenv('DEFAULT_COMPANY_NAME', '和源通信')

# 数据源配置
DATASOURCES = {
    'sp8d': {
        'url': os.getenv('PMA_API_URL', ''),
        'api_key': os.getenv('PMA_EXTERNAL_API_KEY', ''),
        'name': 'SP8D'
    },
    'ovs': {
        'url': os.getenv('OVS_API_URL', ''),
        'api_key': os.getenv('OVS_EXTERNAL_API_KEY', ''),
        'name': 'OVS'
    }
}


def verify_employee_from_source(username: str, password: str, source: str, remember_me: bool = False) -> Dict[str, Any]:
    """
    从指定数据源验证员工身份

    Args:
        username: 员工账户
        password: 密码
        source: 数据源标识 ('sp8d' 或 'ovs')
        remember_me: 是否记住登录状态

    Returns:
        {
            'success': bool,
            'data': {...} 或 None,
            'message': str
        }
    """
    config = DATASOURCES.get(source)
    if not config or not config['url']:
        return {
            'success': False,
            'message': f'{source} 数据源未配置'
        }

    try:
        response = requests.post(
            f"{config['url']}/api/v1/auth/login",
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
                    'pma_refresh_token': result.get('data', {}).get('refresh_token'),
                    'source': source
                }
            }
        else:
            return {
                'success': False,
                'message': result.get('message', '用户名或密码错误')
            }

    except requests.Timeout:
        logger.warning(f"{config['name']} 系统连接超时")
        return {
            'success': False,
            'message': f"{config['name']} 系统连接超时"
        }
    except requests.ConnectionError:
        logger.warning(f"{config['name']} 系统连接失败")
        return {
            'success': False,
            'message': f"{config['name']} 系统连接失败"
        }
    except requests.RequestException as e:
        logger.error(f"{config['name']} 系统请求失败: {str(e)}")
        return {
            'success': False,
            'message': f"{config['name']} 系统请求失败"
        }
    except Exception as e:
        logger.error(f"{config['name']} 验证过程出错: {str(e)}")
        return {
            'success': False,
            'message': f'验证过程出错: {str(e)}'
        }


def verify_employee(username: str, password: str, remember_me: bool = False) -> Dict[str, Any]:
    """
    验证员工身份 - 依次尝试 SP8D 和 OVS

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
    # 1. 先尝试 SP8D
    result = verify_employee_from_source(username, password, 'sp8d', remember_me)
    if result['success']:
        logger.info(f"员工 {username} 通过 SP8D 验证成功")
        return result

    # 2. SP8D 失败，尝试 OVS
    ovs_result = verify_employee_from_source(username, password, 'ovs', remember_me)
    if ovs_result['success']:
        logger.info(f"员工 {username} 通过 OVS 验证成功")
        return ovs_result

    # 3. 两个数据源都失败
    logger.warning(f"员工 {username} 验证失败（SP8D 和 OVS）")
    return {
        'success': False,
        'message': '用户名或密码错误'
    }


def get_employees_from_source(source: str, limit: int = 500, offset: int = 0, search: str = '') -> List[Dict[str, Any]]:
    """
    从指定数据源获取员工列表

    Args:
        source: 数据源标识 ('sp8d' 或 'ovs')
        limit: 返回数量限制
        offset: 偏移量
        search: 搜索关键词

    Returns:
        员工列表，格式：[{user_id, name, company, phone, source}]
    """
    config = DATASOURCES.get(source)
    if not config or not config['url'] or not config['api_key']:
        logger.warning(f"{source} 数据源未配置，跳过")
        return []

    try:
        params = {'limit': limit, 'offset': offset}
        if search:
            params['search'] = search

        response = requests.get(
            f"{config['url']}/api/external/employees",
            params=params,
            headers={'X-External-API-Key': config['api_key']},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                raw_employees = data.get('data', [])
                employees = []
                for emp in raw_employees:
                    emp_copy = emp.copy()
                    # 添加前缀，保持与员工登录后的 user_id 格式一致
                    # 优先使用 id 字段（与登录流程 user_data.get('id') 一致），回退到 user_id
                    # SP8D 保持 emp_X 格式（向后兼容），OVS 使用 emp_ovs_X 格式
                    # 同时保存旧格式 legacy_user_id，用于匹配旧数据中的 member_ids
                    original_api_user_id = emp_copy.get('user_id')
                    raw_id = emp_copy.get('id') or original_api_user_id
                    if raw_id is not None:
                        if source == 'ovs':
                            emp_copy['user_id'] = f"emp_ovs_{raw_id}"
                            if original_api_user_id and str(original_api_user_id) != str(raw_id):
                                emp_copy['legacy_user_id'] = f"emp_ovs_{original_api_user_id}"
                        else:
                            emp_copy['user_id'] = f"emp_{raw_id}"
                            if original_api_user_id and str(original_api_user_id) != str(raw_id):
                                emp_copy['legacy_user_id'] = f"emp_{original_api_user_id}"
                    else:
                        logger.warning(f"员工记录缺少 id 和 user_id 字段: {emp}")
                    # 标记数据来源
                    emp_copy['source'] = source
                    employees.append(emp_copy)
                logger.info(f"从 {config['name']} 获取到 {len(employees)} 名员工")
                return employees
            else:
                logger.error(f"{config['name']} API 返回错误: {data.get('message')}")
                return []
        else:
            logger.error(f"{config['name']} API 请求失败: {response.status_code} - {response.text}")
            return []

    except requests.Timeout:
        logger.error(f"{config['name']} API 请求超时")
        return []
    except requests.RequestException as e:
        logger.error(f"{config['name']} API 请求异常: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"获取 {config['name']} 员工列表失败: {str(e)}")
        return []


def get_all_employees(limit: int = 500, offset: int = 0, search: str = '') -> List[Dict[str, Any]]:
    """
    获取所有员工 - 合并 SP8D 和 OVS 两个数据源

    Args:
        limit: 返回数量限制
        offset: 偏移量
        search: 搜索关键词

    Returns:
        员工列表，格式：[{user_id, name, company, phone, source}]
    """
    all_employees = []

    for source_key in DATASOURCES:
        employees = get_employees_from_source(source_key, limit, offset, search)
        all_employees.extend(employees)

    logger.info(f"从所有数据源共获取到 {len(all_employees)} 名员工")
    return all_employees


def get_raw_employees_from_source(source: str, limit: int = 500) -> List[Dict[str, Any]]:
    """
    从指定数据源获取原始员工列表（不做 ID 转换）

    返回的每条记录保留原始 id 和 user_id 字段，用于迁移时构建映射。
    """
    config = DATASOURCES.get(source)
    if not config or not config['url'] or not config['api_key']:
        return []

    try:
        response = requests.get(
            f"{config['url']}/api/external/employees",
            params={'limit': limit},
            headers={'X-External-API-Key': config['api_key']},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                employees = data.get('data', [])
                for emp in employees:
                    emp['source'] = source
                return employees
        return []
    except Exception as e:
        logger.error(f"获取 {source} 原始员工列表失败: {str(e)}")
        return []


def get_raw_employees(limit: int = 500) -> List[Dict[str, Any]]:
    """
    获取所有数据源的原始员工列表（不做 ID 转换）

    用于迁移：构建 emp_{user_id} → emp_{id} 的映射。
    """
    all_employees = []
    for source_key in DATASOURCES:
        all_employees.extend(get_raw_employees_from_source(source_key, limit))
    return all_employees


def get_employee_by_id(employee_id: str) -> Dict[str, Any] | None:
    """
    根据员工ID获取员工信息

    Args:
        employee_id: 员工ID（不含 emp_ 前缀）

    Returns:
        员工信息字典，包含 name, company 等字段，不存在则返回 None
    """
    # 获取所有员工并查找匹配的
    # 注意：这里 employee_id 不含前缀，需要匹配 emp_{id} 或 emp_ovs_{id}
    all_employees = get_all_employees()

    for emp in all_employees:
        user_id = emp.get('user_id', '')
        # 检查是否匹配 emp_{id} 或 emp_ovs_{id}
        if user_id == f"emp_{employee_id}" or user_id == f"emp_ovs_{employee_id}":
            return emp

    logger.warning(f"未找到员工 ID: {employee_id}")
    return None
