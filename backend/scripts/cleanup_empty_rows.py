#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理 Google Sheets 中的空白行（survey_id 为空的行）
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.sheets_service import sheets_service

def cleanup_empty_rows():
    """删除 survey_id 为空的行"""
    print("=" * 50)
    print("清理空白行脚本")
    print("=" * 50)

    # 直接获取原始数据
    rows = sheets_service.surveys_sheet.get_all_values()
    print(f"\n共有 {len(rows)} 行 (含表头)\n")

    # 找出空行的索引（从后往前删除以避免索引问题）
    empty_rows = []
    for idx, row in enumerate(rows):
        if idx == 0:  # 跳过表头
            continue
        survey_id = str(row[0]).strip() if row and len(row) > 0 else ''
        title = str(row[1]).strip() if row and len(row) > 1 else ''

        print(f"行 {idx + 1}: ID='{survey_id[:20]}...' Title='{title[:30]}'")

        if not survey_id or survey_id == '':
            empty_rows.append(idx + 1)  # Google Sheets 行号从 1 开始
            print(f"  ↳ 标记为空行")

    print("\n" + "-" * 50)
    print(f"发现 {len(empty_rows)} 个空行: {empty_rows}")
    print("-" * 50)

    if not empty_rows:
        print("没有空行需要清理")
        return

    confirm = input(f"\n确定要删除这 {len(empty_rows)} 个空行吗？(输入 yes 确认): ")
    if confirm.lower() != 'yes':
        print("已取消")
        return

    # 从后往前删除，避免索引偏移
    print("\n开始删除...")
    for row_idx in reversed(empty_rows):
        try:
            print(f"  删除行 {row_idx}...")
            sheets_service.surveys_sheet.delete_rows(row_idx)
            print(f"  ✅ 已删除行 {row_idx}")
        except Exception as e:
            print(f"  ❌ 删除行 {row_idx} 失败: {str(e)}")

    # 清除缓存
    sheets_service.clear_cache('surveys')

    print("\n" + "=" * 50)
    print("清理完成!")
    print("=" * 50)


if __name__ == '__main__':
    cleanup_empty_rows()
