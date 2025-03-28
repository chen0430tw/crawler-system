#!/bin/bash

# 全息拉普拉斯互联网爬虫系统 - 一键安装脚本
# 支持Docker环境，自动配置Nginx

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示横幅
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  全息拉普拉斯互联网爬虫系统 - 一键安装脚本  ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请以root权限运行此脚本${NC}"
  echo "使用: sudo $0"
  exit 1
fi

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker未安装。请先安装Docker。${NC}"
    echo "可参考: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose未安装。请先安装Docker Compose。${NC}"
    echo "可参考: https://docs.docker.com/compose/install/"
    exit 1
fi

# 设置安装目录
INSTALL_DIR="/opt/crawler-system"
FRONTEND_DIR="$INSTALL_DIR/frontend"
BACKEND_DIR="$INSTALL_DIR/backend"

# 要求用户输入配置信息
echo -e "${YELLOW}请输入以下配置信息:${NC}"
read -p "网站域名 (例如: crawler.example.com): " DOMAIN_NAME
read -p "Nginx容器名称 (默认: nginx): " NGINX_CONTAINER
NGINX_CONTAINER=${NGINX_CONTAINER:-nginx}

# 检查Nginx容器是否存在
if ! docker ps | grep -q "$NGINX_CONTAINER"; then
    echo -e "${RED}错误: 找不到名为 $NGINX_CONTAINER 的容器${NC}"
    echo "请检查容器名称并确保Nginx容器正在运行"
    exit 1
fi

# 获取Nginx容器的网络
NGINX_NETWORK=$(docker inspect -f '{{range $key, $value := .NetworkSettings.Networks}}{{$key}}{{end}}' $NGINX_CONTAINER)
echo -e "${GREEN}检测到Nginx容器使用的网络: $NGINX_NETWORK${NC}"

# 创建安装目录
echo -e "${BLUE}创建安装目录...${NC}"
mkdir -p $FRONTEND_DIR $BACKEND_DIR/uploads $BACKEND_DIR/results $BACKEND_DIR/logs

# 提取当前目录下的文件
echo -e "${BLUE}提取安装文件...${NC}"
if [ -f "crawler-system.tar.gz" ]; then
    tar -xzf crawler-system.tar.gz -C $INSTALL_DIR
    echo -e "${GREEN}文件提取完成${NC}"
else
    # 如果没有找到压缩包，复制当前目录下的文件
    echo -e "${YELLOW}未找到压缩包，将使用当前目录下的文件${NC}"
    
    # 复制前端文件
    if [ -d "frontend" ]; then
        cp -r frontend/* $FRONTEND_DIR/
    else
        echo -e "${RED}错误: 找不到前端文件目录${NC}"
        exit 1
    fi
    
    # 复制后端文件
    if [ -d "backend" ]; then
        cp -r backend/* $BACKEND_DIR/
    else
        echo -e "${RED}错误: 找不到后端文件目录${NC}"
        exit 1
    fi
fi

# 修改API客户端配置
echo -e "${BLUE}更新API客户端配置...${NC}"
if [ -f "$FRONTEND_DIR/api_client.js" ]; then
    # 替换API基础URL为相对路径
    sed -i 's|const API_BASE_URL = .*|const API_BASE_URL = \'/api\';|' $FRONTEND_DIR/api_client.js
    echo -e "${GREEN}API客户端配置已更新${NC}"
else
    echo -e "${RED}错误: 找不到API客户端文件${NC}"
    exit 1
fi

# 创建Nginx配置文件
echo -e "${BLUE}创建Nginx配置文件...${NC}"
NGINX_CONF_FILE="$INSTALL_DIR/crawler-nginx.conf"

cat > $NGINX_CONF_FILE << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    
    # 如果需要HTTPS，取消注释以下行并提供SSL证书
    # listen 443 ssl;
    # listen [::]:443 ssl;
    # ssl_certificate /etc/nginx/certs/${DOMAIN_NAME}_cert.pem;
    # ssl_certificate_key /etc/nginx/certs/${DOMAIN_NAME}_key.pem;
    
    # HTTP重定向到HTTPS (需要SSL配置)
    # if (\$scheme = http) {
    #     return 301 https://\$host\$request_uri;
    # }
    
    # 前端文件目录
    root /var/www/html/$DOMAIN_NAME;
    index index.html;
    
    # 前端路由处理
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://crawler-backend:5000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;
    }
    
    # 健康检查接口
    location /health {
        proxy_pass http://crawler-backend:5000/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    # 静态资源缓存策略
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        log_not_found off;
    }
    
    # 客户端请求大小限制
    client_max_body_size 50m;
}
EOF

echo -e "${GREEN}Nginx配置文件已创建: $NGINX_CONF_FILE${NC}"

# 创建Docker Compose配置
echo -e "${BLUE}创建Docker Compose配置...${NC}"
DOCKER_COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"

cat > $DOCKER_COMPOSE_FILE << EOF
version: '3.8'

services:
  crawler-backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    container_name: crawler-backend
    restart: unless-stopped
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/results:/app/results
      - ./backend/logs:/app/logs
    environment:
      - PORT=5000
      - PYTHONUNBUFFERED=1
    networks:
      - default
      - nginx_network

networks:
  default:
  nginx_network:
    external: true
    name: $NGINX_NETWORK
EOF

echo -e "${GREEN}Docker Compose配置已创建: $DOCKER_COMPOSE_FILE${NC}"

# 创建Dockerfile
echo -e "${BLUE}创建后端Dockerfile...${NC}"
DOCKERFILE="$BACKEND_DIR/Dockerfile"

cat > $DOCKERFILE << EOF
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads results logs

EXPOSE 5000

ENV PYTHONUNBUFFERED=1

CMD ["python", "crawler_server.py"]
EOF

echo -e "${GREEN}后端Dockerfile已创建: $DOCKERFILE${NC}"

# 将前端文件复制到Nginx容器
echo -e "${BLUE}将前端文件复制到Nginx容器...${NC}"
CONTAINER_HTML_DIR="/var/www/html/$DOMAIN_NAME"

# 在Nginx容器内创建目录
docker exec $NGINX_CONTAINER mkdir -p $CONTAINER_HTML_DIR

# 复制前端文件到临时目录
TMP_DIR=$(mktemp -d)
cp -r $FRONTEND_DIR/* $TMP_DIR/

# 复制文件到容器
docker cp $TMP_DIR/. $NGINX_CONTAINER:$CONTAINER_HTML_DIR/
rm -rf $TMP_DIR

echo -e "${GREEN}前端文件已复制到Nginx容器${NC}"

# 将Nginx配置复制到容器
echo -e "${BLUE}将Nginx配置复制到容器...${NC}"
docker cp $NGINX_CONF_FILE $NGINX_CONTAINER:/etc/nginx/conf.d/$DOMAIN_NAME.conf

# 检查Nginx配置
echo -e "${BLUE}验证Nginx配置...${NC}"
NGINX_TEST=$(docker exec $NGINX_CONTAINER nginx -t 2>&1)

if echo "$NGINX_TEST" | grep -q "successful"; then
    echo -e "${GREEN}Nginx配置验证成功${NC}"
    # 重新加载Nginx配置
    docker exec $NGINX_CONTAINER nginx -s reload
    echo -e "${GREEN}Nginx配置已重新加载${NC}"
else
    echo -e "${RED}Nginx配置验证失败:${NC}"
    echo "$NGINX_TEST"
    echo -e "${YELLOW}请手动修复Nginx配置并重新加载${NC}"
fi

# 启动爬虫后端
echo -e "${BLUE}启动爬虫后端...${NC}"
cd $INSTALL_DIR
docker-compose up -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN}爬虫后端已成功启动${NC}"
else
    echo -e "${RED}爬虫后端启动失败，请检查日志${NC}"
fi

# 安装完成
echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}全息拉普拉斯互联网爬虫系统安装完成!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""
echo -e "您的爬虫系统现已安装在 ${YELLOW}$INSTALL_DIR${NC}"
echo -e "前端界面可通过 ${YELLOW}http://$DOMAIN_NAME${NC} 访问"
echo -e "确保您已经设置DNS记录，将 ${YELLOW}$DOMAIN_NAME${NC} 指向您的服务器IP"
echo ""
echo -e "${YELLOW}如需HTTPS支持，请编辑Nginx配置文件并提供SSL证书${NC}"
echo -e "Nginx配置文件: ${YELLOW}/etc/nginx/conf.d/$DOMAIN_NAME.conf${NC}"
echo ""
echo -e "${BLUE}后端管理命令:${NC}"
echo -e "  启动: ${YELLOW}cd $INSTALL_DIR && docker-compose up -d${NC}"
echo -e "  停止: ${YELLOW}cd $INSTALL_DIR && docker-compose down${NC}"
echo -e "  查看日志: ${YELLOW}cd $INSTALL_DIR && docker-compose logs -f${NC}"
echo ""
echo -e "${BLUE}欢迎使用全息拉普拉斯互联网爬虫系统!${NC}"