#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理空白考卷，只保留指定的考卷
"""
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.sheets_service import sheets_service

def cleanup_surveys(keep_title_keyword="PNR2100"):
    """删除所有不包含指定关键词的考卷"""
    print("=" * 50)
    print("考卷清理脚本")
    print("=" * 50)

    # 获取所有考卷
    surveys = sheets_service.get_all_surveys()
    print(f"\n当前共有 {len(surveys)} 个考卷:\n")

    to_keep = []
    to_delete = []

    for idx, survey in enumerate(surveys, 1):
        survey_id = survey.get('survey_id', '')
        title = survey.get('title', '(无标题)')

        # 检查是否要保留
        if keep_title_keyword and keep_title_keyword in str(title):
            to_keep.append(survey)
            status = "✅ 保留"
        else:
            to_delete.append(survey)
            status = "❌ 删除"

        print(f"{idx}. [{status}] {title}")
        print(f"   ID: {survey_id}")
        print(f"   题数: {survey.get('total_questions', 0)}, 及格分: {survey.get('pass_score', 0)}")
        print()

    print("-" * 50)
    print(f"保留: {len(to_keep)} 个")
    print(f"删除: {len(to_delete)} 个")
    print("-" * 50)

    if not to_delete:
        print("没有需要删除的考卷")
        return

    # 确认删除
    confirm = input(f"\n确定要删除 {len(to_delete)} 个考卷吗？(输入 yes 确认): ")
    if confirm.lower() != 'yes':
        print("已取消")
        return

    # 执行删除
    print("\n开始删除...")
    success_count = 0
    fail_count = 0

    for survey in to_delete:
        survey_id = survey.get('survey_id', '')
        title = survey.get('title', '(无标题)')

        if not survey_id:
            print(f"  跳过: {title} (ID 为空)")
            fail_count += 1
            continue

        try:
            sheets_service.delete_survey(survey_id)
            print(f"  ✅ 已删除: {title}")
            success_count += 1
        except Exception as e:
            print(f"  ❌ 删除失败: {title} - {str(e)}")
            fail_count += 1

    print("\n" + "=" * 50)
    print(f"完成! 成功: {success_count}, 失败: {fail_count}")
    print("=" * 50)


if __name__ == '__main__':
    # 可以修改这里的关键词来保留不同的考卷
    cleanup_surveys(keep_title_keyword="PNR2100")
