#!/bin/bash

# 显示当前状态
git status

# 提示输入 commit message
read -p "请输入提交信息: " message

# 如果没有输入，退出
if [ -z "$message" ]; then
    echo "未输入提交信息，取消操作"
    exit 1
fi

# 添加所有更改、提交、推送
git add -A
git commit -m "$message"
git push origin main
