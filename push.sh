#!/bin/bash

VERSION_FILE="frontend/public/version.json"

# 显示当前状态
git status

# 提示输入 commit message
read -p "请输入提交信息: " message

# 如果没有输入，退出
if [ -z "$message" ]; then
    echo "未输入提交信息，取消操作"
    exit 1
fi

# 读取当前版本号并递增
current_version=$(python3 -c "
import json
with open('$VERSION_FILE') as f:
    data = json.load(f)
print(data['version'])
")

# 计算新版本号 (v1.00 -> v1.01, v1.99 -> v2.00)
new_version=$(python3 -c "
v = '$current_version'
prefix = v[0]  # 'v'
parts = v[1:].split('.')
major = int(parts[0])
minor = int(parts[1])
minor += 1
if minor > 99:
    major += 1
    minor = 0
print(f'{prefix}{major}.{minor:02d}')
")

# 更新 version.json
today=$(date +%Y-%m-%d)
python3 -c "
import json
with open('$VERSION_FILE') as f:
    data = json.load(f)
data['version'] = '$new_version'
data['changelog'].insert(0, {
    'version': '$new_version',
    'date': '$today',
    'message': '''$message'''
})
with open('$VERSION_FILE', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
"

echo "版本号: $current_version -> $new_version"

# 添加所有更改、提交、推送
git add -A
git commit -m "$message"
git push origin main
