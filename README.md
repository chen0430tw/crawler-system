# 全息拉普拉斯互联网爬虫系统 v3.0

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue)](https://chen0430tw.github.io/crawler-system/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

一键式网页爬虫系统，支持 10+ 主流平台，内置数据可视化与 NLP 分析，无需编程知识即可使用。

## 在线演示

**[点击体验在线 Demo](https://chen0430tw.github.io/crawler-system/)**

> 注意：在线 Demo 仅展示前端界面，完整功能需要部署后端服务器。

## v3.0 更新内容

- **数据可视化** - 词云、链接关系图、词频统计图表
- **内容分类** - 基于 TF-IDF + K-Means 的自动内容聚类
- **主题系统** - 5 套主题预设 + 自定义背景 + 毛玻璃效果
- **国际化** - 中英文界面切换
- **嵌入媒体检测** - 自动识别 YouTube、Twitter、Vimeo、Instagram 嵌入内容
- **导出功能** - 支持 JSON、CSV、HTML 多格式导出

## 功能总览

### 核心爬虫

- **一键爬取** - 输入 URL，点击运行，自动完成
- **零代码** - 可视化界面，不需要写任何代码
- **多平台支持** - 维基百科、B站、知乎、GitHub、微博等 10+ 平台
- **深度爬取** - 支持 1-3 级深度，自动跟踪同域链接
- **并发控制** - 可配置并发数（1-5），避免被封禁
- **代理支持** - HTTP/HTTPS/SOCKS5 代理，在 UI 中直接配置
- **浏览器渲染** - Playwright 自动处理 JavaScript 动态页面
- **嵌入媒体检测** - 自动识别页面中嵌入的 YouTube、Twitter、Vimeo、Instagram 内容

### 数据可视化

| 图表 | 说明 |
|------|------|
| 关键词词云 | 基于 ECharts WordCloud，词大小反映频率 |
| 链接关系图 | 网络拓扑图，展示页面间的链接关系 |
| 词频统计 | 柱状图展示 Top 关键词频率 |
| 阴谋论检测饼图 | 确认/疑似/正常内容占比 |

### 内容分析 (NLP)

- **关键词提取** - NLTK 分词 + 频率统计
- **TF-IDF 向量化** - 自动计算词项权重
- **K-Means 聚类** - 自动将内容分类到不同主题
- **文本预处理** - 分词、停用词过滤、词形还原
- **阴谋论检测** - 基于全息拉普拉斯图论的 J-value 数学模型

### 维基百科专属功能

| 功能 | 说明 |
|------|------|
| 搜索 | 关键词搜索，返回匹配页面列表 |
| 页面抓取 | 获取完整页面内容与结构 |
| 分类浏览 | 按分类层级浏览条目 |
| 分类树可视化 | 递归展示分类层级结构（0-3 层深度） |
| 页面路径查找 | BFS 搜索两个页面间的最短链接路径 |
| 信息框提取 | 结构化提取 Infobox 数据 |
| 随机页面 | 获取 N 个随机页面（1/3/5/10） |
| 批量操作 | 批量获取多个页面内容 |
| 统计面板 | 爬取量、搜索量、语言使用分布 |
| 多语言 | 中/英/日/韩/法/德/西/俄 8 种语言 |

### 任务管理

- **实时进度监控** - 任务进度百分比实时更新
- **任务列表** - 查看所有历史任务状态
- **任务取消** - 随时取消运行中的任务
- **结果持久化** - 任务数据保存至 tasks.json，重启不丢失

### 导出与下载

- **多格式导出** - JSON、CSV、HTML
- **结果下载** - 单页下载或批量下载
- **配置导出** - 导出爬虫配置文件 (crawler_config.json)

### 界面定制

| 功能 | 说明 |
|------|------|
| 主题切换 | 默认、暗色、蓝色、紫色、绿色 5 套预设 |
| 自定义背景 | 上传自定义背景图片 |
| 内容透明度 | 100% / 90% / 80% / 70% 可调 |
| 毛玻璃效果 | Glass Morphism 开关 |
| 中英文切换 | 界面完整中英文国际化 |
| Live2D 助手 | 动态角色助手（可选） |

## 支持的平台

| 平台 | 功能 | 状态 |
|------|------|------|
| 通用网页 | 任意网页爬取、深度遍历 | ✅ |
| 维基百科 | 搜索、分类、路径查找、信息框、随机页面 | ✅ |
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
│  │  index.html + script.js + api_client.js             │    │
│  │  - 爬虫配置界面          - 任务监控面板               │    │
│  │  - 数据可视化 (ECharts)   - 结果展示与导出            │    │
│  │  - 主题/背景/语言设置     - Live2D 助手              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │ API 请求
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              后端 (Flask Server)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  crawler_server.py - RESTful API (60+ 端点)         │    │
│  │  - 任务队列管理 (ThreadPoolExecutor)                  │    │
│  │  - 并发爬取控制        - 结果存储与导出               │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CrawlerHub (crawler.py) - 统一爬虫调度              │    │
│  │  - WikipediaCrawler    - ZhihuCrawler               │    │
│  │  - BilibiliCrawler     - GitHubCrawler              │    │
│  │  - WeiboCrawler        - YouTubeCrawler             │    │
│  │  - TiebaCrawler        - ArxivCrawler               │    │
│  │  - MoegirlCrawler      - DocsCrawler                │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  DataProcessor - NLP 分析引擎                        │    │
│  │  - 关键词提取    - TF-IDF 向量化    - K-Means 聚类   │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  UrbanLegendAnalyzer - 阴谋论检测                    │    │
│  │  - J-value 数学模型   - 可信域名白名单               │    │
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
| `/api/download/<id>` | GET | 下载结果文件 |
| `/api/upload` | POST | 上传配置文件 |
| `/health` | GET | 健康检查 |

### 维基百科接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/wiki/search` | GET | 搜索维基百科 |
| `/api/wiki/page` | GET | 获取页面内容 |
| `/api/wiki/category` | GET | 获取分类条目 |
| `/api/wiki/category-tree` | POST | 获取分类树结构 |
| `/api/wiki/path` | POST | 页面路径查找 |
| `/api/wiki/random` | GET | 获取随机页面 |
| `/api/wiki/infobox` | GET | 提取信息框 |
| `/api/wiki/languages` | GET | 可用语言列表 |
| `/api/wiki/stats` | GET | 使用统计 |
| `/api/wiki/batch` | POST | 批量获取页面 |

### 平台专用接口

| 前缀 | 平台 |
|------|------|
| `/api/zhihu/*` | 知乎 |
| `/api/bilibili/*` | 哔哩哔哩 |
| `/api/github/*` | GitHub |
| `/api/weibo/*` | 微博 |
| `/api/youtube/*` | YouTube |
| `/api/tieba/*` | 百度贴吧 |
| `/api/arxiv/*` | arXiv |
| `/api/moegirl/*` | 萌娘百科 |

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
│   ├── index.html            # 单页应用主页
│   ├── script.js             # 主逻辑 (可视化、任务管理)
│   ├── styles.css            # 主样式
│   ├── api_client.js         # API 客户端
│   ├── ui-manager.js         # UI 组件管理
│   ├── language-manager.js   # 国际化
│   ├── css/                  # 主题、背景、Live2D 样式
│   └── js/                   # 广告、背景、主题、Live2D 模块
│
├── backend/                  # 后端源码
│   ├── crawler_server.py     # Flask API 服务器 (60+ 端点)
│   ├── crawler.py            # 爬虫引擎 + NLP + 存储
│   └── requirements.txt
│
├── docs/                     # GitHub Pages 部署 (前端镜像)
│   └── DEPLOYMENT.md         # 部署指南
│
├── docker-compose.yml        # Docker 编排
├── Dockerfile                # Docker 构建
├── nginx.conf                # Nginx 反向代理配置
├── install.sh                # 服务器安装脚本
├── startup.sh                # Linux/macOS 启动脚本
├── start.bat                 # Windows 启动脚本
└── README.md
```

## 配置说明

### 前端 API 地址配置

前端支持通过 localStorage 动态配置 API 地址，无需修改代码：

```javascript
// 在浏览器控制台执行
localStorage.setItem('API_BASE_URL', 'https://your-server.com/api');
```

也可以在 UI 的设置面板中配置。GitHub Pages 部署时会自动提示配置后端地址。

### 后端服务器配置

```bash
# 环境变量
export FLASK_PORT=5000           # 服务端口
export FLASK_HOST=0.0.0.0        # 监听地址
export CORS_ORIGINS=*            # 允许的跨域来源
export MAX_WORKERS=4             # 线程池大小
export TASK_TIMEOUT=300          # 任务超时 (秒)
```

## 常见问题

**Q: 服务器状态显示红色？**
A: 后端服务器未启动或无法连接。请确保运行了 `python crawler_server.py`。

**Q: 爬取失败或被封禁？**
A: 降低并发数，或在 UI 中添加代理服务器地址（支持 HTTP/SOCKS5）。

**Q: 如何处理需要 JavaScript 渲染的页面？**
A: 系统支持 Playwright 浏览器模式，会自动检测需要 JS 渲染的页面并切换：

```bash
pip install playwright
playwright install chromium
```

**Q: 如何添加新的爬虫平台？**
A: 在 `backend/crawler.py` 中创建新的 Crawler 类，注册到 CrawlerHub，并在 `crawler_server.py` 中添加 API 路由。

**Q: 维基百科页面路径查找很慢或超时？**
A: 维基百科链接网络庞大，当前使用 BFS 算法，已设置 60 秒超时和 100 页限制。建议尝试更相关的页面组合。

**Q: 支持定时任务吗？**
A: 当前版本不支持内置定时任务，可以配合 cron 或系统计划任务实现。

## 已知限制

| 功能 | 限制 | 说明 |
|------|------|------|
| 页面路径查找 | 60 秒超时 | BFS 算法效率限制，后续考虑双向 BFS 或 A* |
| 并发爬取 | 最多 5 线程 | 避免目标网站封禁 |
| 文件上传 | 16MB | Flask 配置限制 |
| 任务持久化 | 文件存储 | 使用 tasks.json，无数据库 |

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT License](LICENSE)

## 致谢

- 基于全息拉普拉斯互联网图理论
- 感谢所有贡献者
