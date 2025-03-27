# 全息拉普拉斯互联网爬虫系统

基于全息拉普拉斯互联网图理论的网页爬虫系统，现已支持本地API服务模式。

## 重要更新

本项目已重构为前后端分离架构：
- `frontend/` - 包含所有Web界面文件
- `backend/` - 包含爬虫服务器和核心实现
- `scripts/` - 保留原脚本（兼容旧版本）

## 系统特点

- **服务器模式**：爬虫以服务形式运行，支持多任务并发执行
- **实时监控**：实时监控任务执行状态与进度
- **灵活配置**：通过网页界面配置，无需编程知识
- **内容清洗**：自动移除广告、导航栏等噪声内容
- **自动分类**：基于内容相似度自动对爬取的网页进行分类
- **阴谋论检测**：基于全息拉普拉斯互联网图理论的网页内容分析

## 系统要求

- Python 3.7 或更高版本
- 操作系统：Windows/Linux/macOS
- 现代浏览器（Chrome, Firefox, Edge等）

## 快速开始

### 服务器模式（推荐）

#### Windows用户
1. 双击运行 `start.bat` 文件
2. 服务器将在 http://localhost:5000 启动
3. 访问系统界面并使用

#### Linux/macOS用户
```bash
# 添加执行权限（只需首次执行）
chmod +x startup.sh

# 启动爬虫服务器
./startup.sh
```

### 传统模式（向后兼容）

仍然支持原有的命令行模式：

```bash
# 生成配置文件
# 通过Web界面生成并下载 crawler_config.json

# 运行爬虫
python scripts/crawler.py -c crawler_config.json
```

## 目录结构

```
crawler-system/
│
├── frontend/                  # 前端文件
│   ├── index.html             # 主页面
│   ├── styles.css             # 样式文件
│   ├── script.js              # 主脚本文件
│   └── api_client.js          # API客户端
│
├── backend/                   # 后端文件
│   ├── crawler_server.py      # 后端服务器
│   ├── crawler.py             # 爬虫实现（从scripts移入）
│   └── requirements.txt       # 依赖列表
│
├── scripts/                   # 原有的脚本目录（保留向后兼容性）
│   ├── crawler.py             # 爬虫脚本（指向backend/crawler.py）
│   └── setup.py               # 安装脚本
│
├── start.bat                  # Windows启动脚本
├── startup.sh                 # Linux/macOS启动脚本
├── README.md                  # 项目主说明文档
└── .gitignore                 # Git忽略文件
```

## API接口说明

服务器模式提供以下API接口：

| 接口路径 | 方法 | 描述 |
|---------|------|------|
| `/api/submit` | POST | 提交爬虫任务 |
| `/api/status/<task_id>` | GET | 获取任务状态 |
| `/api/result/<task_id>` | GET | 获取任务结果 |
| `/api/download/<task_id>` | GET | 下载任务结果文件 |
| `/api/tasks` | GET | 获取所有任务列表 |
| `/api/cancel/<task_id>` | POST | 取消任务 |
| `/api/upload` | POST | 上传配置文件 |
| `/health` | GET | 健康检查 |

## 使用方法

### 1. 配置并运行爬虫任务

1. 在URL列表中输入要爬取的网站地址（每行一个）
2. 设置爬取深度（1-3级）
3. 选择存储格式（TXT或HTML）
4. 设置并发数
5. 点击"运行爬虫"开始执行爬取任务

### 2. 监控任务进度

1. 切换到"任务列表"标签页
2. 查看任务状态、进度和完成时间
3. 可以取消等待中的任务或查看失败任务的错误信息

### 3. 查看分析结果

1. 在任务完成后，点击"查看结果"按钮
2. 切换不同标签页查看不同类型的分析：
   - **抓取内容**：所有爬取的页面内容
   - **分类结果**：自动分类的网页内容
   - **阴谋论检测**：基于全息拉普拉斯理论的内容分析
   - **统计信息**：爬取结果的总体统计和图表

## 安装依赖

服务器模式需要额外的Python库，可以通过以下方式安装：

```bash
pip install -r backend/requirements.txt
```

或者手动安装：

```bash
pip install flask flask-cors requests beautifulsoup4 nltk scikit-learn
```

## 常见问题

**Q: 服务器启动失败怎么办？**  
A: 请检查端口5000是否被占用，可以在启动脚本中修改端口号。

**Q: 爬虫任务一直等待中怎么办？**  
A: 可能是线程池已满，请等待其他任务完成或重启服务器。

**Q: 如何增加爬虫并发数？**  
A: 在配置面板中选择更高的并发选项。但注意过高的并发可能导致被目标网站屏蔽。

## 理论基础

本系统基于全息拉普拉斯互联网图理论，这是一种新型的互联网动态拓扑模型，将全息原理与拉普拉斯矩阵分析有机结合，用于描述和解析全球互联网中各节点间复杂的结构关系及动态演变。

该理论提供了以下优势：
- 通过局部信息推断全局网络结构
- 利用谱分析方法进行网络连通性研究
- 采用全息映射确保局部与全局信息的一致性

## 开发者信息

如有问题或建议，请提交Issue或Pull Request。

## 许可证

MIT 许可证
