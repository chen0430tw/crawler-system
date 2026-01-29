# 全息拉普拉斯互联网爬虫系统

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue)](https://chen0430tw.github.io/crawler-system/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

一键式网页爬虫系统，支持 10+ 主流平台，无需编程知识即可使用。

## 在线演示

👉 **[点击体验在线 Demo](https://chen0430tw.github.io/crawler-system/)**

> 注意：在线 Demo 仅展示前端界面，完整功能需要部署后端服务器。

## 特点

- **一键爬取** - 输入 URL，点击运行，完事
- **零代码** - 可视化界面，不需要写任何代码
- **多平台支持** - 维基百科、B站、知乎、GitHub、微博等 10+ 平台
- **实时监控** - 任务进度实时更新
- **内容分析** - 自动分类、关键词提取、阴谋论检测
- **灵活部署** - 支持本地运行、Docker、云服务器

## 支持的平台

| 平台 | 功能 | 状态 |
|------|------|------|
| 通用网页 | 任意网页爬取 | ✅ |
| 维基百科 | 搜索、分类爬取、随机页面 | ✅ |
| 知乎 | 问题、回答、专栏、用户 | ✅ |
| 哔哩哔哩 | 视频、UP主、搜索 | ✅ |
| GitHub | 仓库、用户、Issue、代码搜索 | ✅ |
| 微博 | 用户、热搜、话题 | ✅ |
| YouTube | 视频、频道、搜索 | ✅ |
| 百度贴吧 | 帖子、吧内容 | ✅ |
| arXiv | 论文搜索、分类浏览 | ✅ |
| 萌娘百科 | 词条、分类 | ✅ |

## 快速开始

### 方式一：本地运行（推荐新手）

```bash
# 1. 克隆项目
git clone https://github.com/chen0430tw/crawler-system.git
cd crawler-system

# 2. 安装依赖
pip install -r backend/requirements.txt

# 3. 启动服务器
cd backend
python crawler_server.py

# 4. 打开浏览器访问 http://localhost:5000
```

### 方式二：Docker 部署

```bash
# 1. 克隆项目
git clone https://github.com/chen0430tw/crawler-system.git
cd crawler-system

# 2. 构建并启动
docker-compose up -d

# 3. 访问 http://localhost:5000
```

### 方式三：前后端分离部署

适合需要公网访问的场景：前端部署到 GitHub Pages，后端部署到云服务器。

详见 [部署指南](docs/DEPLOYMENT.md)

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户浏览器                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              前端 (GitHub Pages / Nginx)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  index.html + styles.css + script.js                │    │
│  │  - 爬虫配置界面                                       │    │
│  │  - 任务监控面板                                       │    │
│  │  - 结果展示与分析                                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │ API 请求
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              后端 (Flask Server)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  crawler_server.py                                   │    │
│  │  - RESTful API                                       │    │
│  │  - 任务队列管理                                       │    │
│  │  - 并发爬取控制                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CrawlerHub (crawler.py)                             │    │
│  │  - WikipediaCrawler    - ZhihuCrawler               │    │
│  │  - BilibiliCrawler     - GitHubCrawler              │    │
│  │  - WeiboCrawler        - YouTubeCrawler             │    │
│  │  - TiebaCrawler        - ArxivCrawler               │    │
│  │  - MoegirlCrawler      - DocsCrawler                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## API 接口

### 基础接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/submit` | POST | 提交爬虫任务 |
| `/api/tasks` | GET | 获取任务列表 |
| `/api/status/<id>` | GET | 获取任务状态 |
| `/api/result/<id>` | GET | 获取任务结果 |
| `/api/cancel/<id>` | POST | 取消任务 |
| `/health` | GET | 健康检查 |

### 平台专用接口

| 接口 | 描述 |
|------|------|
| `/api/wikipedia/*` | 维基百科相关 |
| `/api/zhihu/*` | 知乎相关 |
| `/api/bilibili/*` | B站相关 |
| `/api/github/*` | GitHub相关 |
| `/api/weibo/*` | 微博相关 |
| `/api/hub/*` | CrawlerHub 统一接口 |

### CrawlerHub 统一接口

```bash
# 获取支持的平台列表
GET /api/hub/platforms

# 使用指定平台爬取
POST /api/hub/crawl
{
  "platform": "wikipedia",
  "method": "search",
  "args": ["人工智能"],
  "kwargs": {"limit": 10}
}

# 批量爬取
POST /api/hub/batch
{
  "tasks": [
    {"platform": "wikipedia", "method": "search", "args": ["AI"]},
    {"platform": "zhihu", "method": "search_questions", "args": ["机器学习"]}
  ]
}
```

## 目录结构

```
crawler-system/
├── frontend/                 # 前端源码
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── api_client.js
│
├── backend/                  # 后端源码
│   ├── crawler_server.py     # API 服务器
│   ├── crawler.py            # 爬虫实现 + CrawlerHub
│   └── requirements.txt
│
├── docs/                     # GitHub Pages 部署文件
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── DEPLOYMENT.md         # 部署指南
│   └── ...
│
├── docker-compose.yml        # Docker 编排文件
├── Dockerfile                # Docker 构建文件
├── install.sh                # 安装脚本
├── start.bat                 # Windows 启动脚本
├── startup.sh                # Linux/macOS 启动脚本
└── README.md
```

## 配置说明

### 前端 API 地址配置

编辑 `frontend/api_client.js` 或 `docs/api_client.js`：

```javascript
// 本地开发
const API_BASE_URL = '/api';

// 远程后端服务器
const API_BASE_URL = 'https://your-server.com/api';
```

### 后端服务器配置

```bash
# 环境变量
export FLASK_PORT=5000           # 服务端口
export FLASK_HOST=0.0.0.0        # 监听地址
export CORS_ORIGINS=*            # 允许的跨域来源
```

## 常见问题

**Q: 服务器状态显示红色？**
A: 后端服务器未启动或无法连接。请确保运行了 `python crawler_server.py`。

**Q: 爬取失败或被封禁？**
A: 降低并发数，或添加代理。部分网站有反爬机制。

**Q: 如何添加新的爬虫平台？**
A: 在 `backend/crawler.py` 中创建新的 Crawler 类，并注册到 CrawlerHub。

**Q: 支持定时任务吗？**
A: 当前版本不支持，可以配合 cron 或系统计划任务实现。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT License](LICENSE)

## 致谢

- 基于全息拉普拉斯互联网图理论
- 感谢所有贡献者
