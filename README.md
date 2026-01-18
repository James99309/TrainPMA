# Stargirl 课程平台

一个集成了课程学习和测验系统的 React + Flask 应用。

## 项目结构

```
stargirl-reader/
├── frontend/                 # React 前端
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                  # Flask 后端
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── credentials/
│   ├── requirements.txt
│   ├── run.py
│   └── Dockerfile
├── courses/                  # 课程文件 (PDF, PPT)
├── docker-compose.yml        # Docker 编排
├── .env                      # 环境变量
└── README.md
```

## 快速开始

### Docker 部署 (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd stargirl-reader

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 3. 放置 Google Sheets 凭证
cp your-service-account.json backend/credentials/service-account.json

# 4. 启动服务
docker-compose up -d

# 5. 访问应用
# 前端: http://localhost
# 后端: http://localhost:5005
```

### 本地开发

#### 前端开发

```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

#### 后端开发

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
# API: http://localhost:5005
```

## 添加课程文件

将课程 PDF/PPT 文件放入 `courses/` 目录：

```
courses/
├── course1/
│   ├── lesson1.pdf
│   └── lesson2.pptx
└── course2/
    └── material.pdf
```

## NAS 部署

```bash
# 1. 上传项目到 NAS
scp -r stargirl-reader nas:/docker/stargirl/

# 2. SSH 到 NAS 并启动
ssh nas
cd /docker/stargirl
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

## 环境变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `FLASK_ENV` | Flask 环境 | `production` |
| `SECRET_KEY` | Flask 密钥 | 随机字符串 |
| `GOOGLE_SHEETS_ID` | Google Sheets ID | `1XNK4...` |
| `GOOGLE_CREDENTIALS_FILE` | 凭证文件路径 | `/app/credentials/service-account.json` |
| `API_KEY` | 管理 API 密钥 | 随机字符串 |
| `JWT_SECRET_KEY` | JWT 密钥 | 随机字符串 |

## 功能特性

- 📚 课程学习 - PDF/PPT 在线阅读
- 📝 在线测验 - 基于 Google Sheets 的题库
- 🏆 排行榜 - 测验成绩排名
- 🌙 深色模式 - 护眼阅读体验
- 📱 响应式设计 - 支持移动端

## 技术栈

**前端:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (状态管理)

**后端:**
- Flask
- Google Sheets API
- JWT 认证

**部署:**
- Docker + Docker Compose
- Nginx (反向代理)
