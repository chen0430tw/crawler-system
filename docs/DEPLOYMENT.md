# 部署指南

本指南介绍如何将全息拉普拉斯互联网爬虫系统部署到生产环境。

## 部署架构

```
                    互联网用户
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│              GitHub Pages (免费静态托管)               │
│                                                       │
│   https://your-username.github.io/crawler-system/    │
│   - 前端 HTML/CSS/JS                                  │
│   - 无服务器成本                                       │
└───────────────────────────────────────────────────────┘
                        │
                        │ HTTPS API 请求
                        ▼
┌───────────────────────────────────────────────────────┐
│              云服务器 (后端 API)                        │
│                                                       │
│   https://api.your-domain.com                        │
│   - Flask 后端服务                                    │
│   - 爬虫任务执行                                       │
│   - 数据存储                                          │
└───────────────────────────────────────────────────────┘
```

## 方案一：GitHub Pages + 云服务器

### 步骤 1：部署前端到 GitHub Pages

1. Fork 或克隆本仓库到你的 GitHub 账户

2. 修改 `docs/api_client.js`，设置后端 API 地址：

```javascript
// 将这行
const API_BASE_URL = '/api';

// 改为你的后端服务器地址
const API_BASE_URL = 'https://api.your-domain.com/api';
```

3. 提交并推送更改：

```bash
git add docs/api_client.js
git commit -m "Configure API endpoint"
git push
```

4. 在 GitHub 仓库设置中启用 Pages：
   - 进入 Settings → Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main"，文件夹选择 "/docs"
   - 点击 Save

5. 等待几分钟后访问 `https://your-username.github.io/crawler-system/`

### 步骤 2：部署后端到云服务器

#### 选项 A：使用 Docker（推荐）

1. 在服务器上安装 Docker：

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

2. 克隆项目：

```bash
git clone https://github.com/your-username/crawler-system.git
cd crawler-system
```

3. 创建环境配置文件：

```bash
cat > .env << EOF
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
CORS_ORIGINS=https://your-username.github.io
EOF
```

4. 启动服务：

```bash
docker-compose up -d
```

#### 选项 B：直接部署

1. 安装 Python 和依赖：

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r backend/requirements.txt
```

2. 使用 systemd 管理服务：

```bash
sudo cat > /etc/systemd/system/crawler-system.service << EOF
[Unit]
Description=Crawler System Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/crawler-system/backend
Environment=FLASK_HOST=0.0.0.0
Environment=FLASK_PORT=5000
Environment=CORS_ORIGINS=https://your-username.github.io
ExecStart=/opt/crawler-system/venv/bin/python crawler_server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable crawler-system
sudo systemctl start crawler-system
```

3. 配置 Nginx 反向代理：

```nginx
# /etc/nginx/sites-available/crawler-api
server {
    listen 80;
    server_name api.your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    # SSL 证书（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS 头（如果后端没有处理）
        # add_header Access-Control-Allow-Origin "https://your-username.github.io";
        # add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        # add_header Access-Control-Allow-Headers "Content-Type";
    }
}
```

4. 获取 SSL 证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com
```

## 方案二：全部署到云服务器

如果你有自己的域名和服务器，可以将前后端都部署到同一台服务器。

### Nginx 配置

```nginx
server {
    listen 80;
    server_name crawler.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crawler.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/crawler.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crawler.your-domain.com/privkey.pem;

    # 前端静态文件
    root /var/www/crawler-system/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:5000/health;
    }
}
```

## 方案三：使用 PaaS 平台

### Railway

1. 注册 [Railway](https://railway.app/) 账户

2. 连接 GitHub 仓库

3. 设置环境变量：
   - `FLASK_HOST=0.0.0.0`
   - `FLASK_PORT=$PORT`
   - `CORS_ORIGINS=https://your-username.github.io`

4. Railway 会自动检测 Python 项目并部署

### Render

1. 注册 [Render](https://render.com/) 账户

2. 创建 Web Service，连接 GitHub 仓库

3. 配置：
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `cd backend && python crawler_server.py`

4. 设置环境变量

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FLASK_HOST` | 监听地址 | `127.0.0.1` |
| `FLASK_PORT` | 监听端口 | `5000` |
| `CORS_ORIGINS` | 允许的跨域来源 | `*` |
| `MAX_WORKERS` | 最大工作线程数 | `4` |
| `TASK_TIMEOUT` | 任务超时时间（秒） | `300` |

## 安全建议

1. **HTTPS**：始终使用 HTTPS，特别是后端 API

2. **CORS**：生产环境中，`CORS_ORIGINS` 应该设置为具体的前端域名，而不是 `*`

3. **速率限制**：考虑添加 API 速率限制防止滥用

4. **防火墙**：只开放必要的端口（80, 443）

5. **日志监控**：设置日志记录和监控告警

## 故障排除

### 前端无法连接后端

1. 检查后端服务是否运行：
   ```bash
   curl http://localhost:5000/health
   ```

2. 检查 CORS 配置是否正确

3. 检查浏览器控制台错误信息

### 后端启动失败

1. 检查端口是否被占用：
   ```bash
   netstat -tlnp | grep 5000
   ```

2. 检查日志：
   ```bash
   journalctl -u crawler-system -f
   ```

### SSL 证书问题

1. 检查证书是否过期：
   ```bash
   sudo certbot certificates
   ```

2. 手动更新证书：
   ```bash
   sudo certbot renew
   ```

## 更新部署

```bash
# 拉取最新代码
cd /opt/crawler-system
git pull

# 如果使用 Docker
docker-compose down
docker-compose up -d --build

# 如果使用 systemd
sudo systemctl restart crawler-system
```
