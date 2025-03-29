#!/bin/bash

# 全息拉普拉斯互联网爬虫系统 - 一键安装脚本
# 优化版本，自动复用现有证书

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
echo -e "${BLUE}检测Docker网络配置...${NC}"
NGINX_NETWORKS=$(docker inspect -f '{{range $key, $value := .NetworkSettings.Networks}}{{$key}} {{end}}' $NGINX_CONTAINER)
echo -e "检测到Nginx容器连接的网络: ${YELLOW}$NGINX_NETWORKS${NC}"

# 选择网络
if [[ $(echo $NGINX_NETWORKS | wc -w) -gt 1 ]]; then
    echo -e "${YELLOW}检测到多个网络，请选择要使用的网络:${NC}"
    select NETWORK in $NGINX_NETWORKS; do
        if [ -n "$NETWORK" ]; then
            NGINX_NETWORK=$NETWORK
            break
        else
            echo -e "${RED}无效选择，请重试${NC}"
        fi
    done
else
    NGINX_NETWORK=$NGINX_NETWORKS
fi

echo -e "${GREEN}将使用网络: $NGINX_NETWORK${NC}"

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
    # 使用双引号替代单引号，避免转义问题
    sed -i 's|const API_BASE_URL = .*|const API_BASE_URL = "/api";|' $FRONTEND_DIR/api_client.js
    echo -e "${GREEN}API客户端配置已更新${NC}"
else
    echo -e "${RED}错误: 找不到API客户端文件${NC}"
    exit 1
fi

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

# 创建缓存清理脚本
echo -e "${BLUE}创建缓存清理脚本...${NC}"
CACHE_SCRIPT="$INSTALL_DIR/clear-cache.sh"

cat > $CACHE_SCRIPT << 'EOF'
#!/bin/bash

# 全息拉普拉斯互联网爬虫系统 - 缓存清理脚本
# 用法: sudo ./clear-cache.sh

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示横幅
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}    全息拉普拉斯互联网爬虫系统 - 缓存清理    ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请以root权限运行此脚本${NC}"
  echo "使用: sudo $0"
  exit 1
fi

# 设置安装目录
INSTALL_DIR="/opt/crawler-system"
BACKEND_CONTAINER="crawler-backend"

echo -e "${YELLOW}准备清理系统缓存...${NC}"

# 1. 清理爬虫结果目录
echo -e "${BLUE}[1/4] 清理爬取结果...${NC}"
if docker exec $BACKEND_CONTAINER test -d /app/results; then
    docker exec $BACKEND_CONTAINER sh -c "rm -rf /app/results/* && mkdir -p /app/results"
    echo -e "${GREEN}  ✓ 爬取结果已清理${NC}"
else
    echo -e "${YELLOW}  ! 爬取结果目录不存在${NC}"
fi

# 2. 清理上传文件目录
echo -e "${BLUE}[2/4] 清理上传文件...${NC}"
if docker exec $BACKEND_CONTAINER test -d /app/uploads; then
    docker exec $BACKEND_CONTAINER sh -c "rm -rf /app/uploads/* && mkdir -p /app/uploads"
    echo -e "${GREEN}  ✓ 上传文件已清理${NC}"
else
    echo -e "${YELLOW}  ! 上传文件目录不存在${NC}"
fi

# 3. 清理日志文件
echo -e "${BLUE}[3/4] 清理日志文件...${NC}"
if docker exec $BACKEND_CONTAINER test -d /app/logs; then
    docker exec $BACKEND_CONTAINER sh -c "rm -f /app/logs/* && mkdir -p /app/logs"
    echo -e "${GREEN}  ✓ 日志文件已清理${NC}"
else
    echo -e "${YELLOW}  ! 日志目录不存在${NC}"
fi

# 4. 重启爬虫后端(清理内存缓存)
echo -e "${BLUE}[4/4] 重启爬虫后端以清理内存缓存...${NC}"
cd $INSTALL_DIR
docker-compose restart $BACKEND_CONTAINER
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ 爬虫后端已重启${NC}"
else
    echo -e "${RED}  ✗ 爬虫后端重启失败${NC}"
fi

# 5. 清理Nginx缓存(如果有)
echo -e "${BLUE}[额外] 检查Nginx缓存...${NC}"
if docker exec nginx test -d /var/cache/nginx; then
    echo -e "${YELLOW}  发现Nginx缓存，正在清理...${NC}"
    docker exec nginx sh -c "rm -rf /var/cache/nginx/* || true"
    docker exec nginx nginx -s reload
    echo -e "${GREEN}  ✓ Nginx缓存已清理并重新加载配置${NC}"
else
    echo -e "${GREEN}  ✓ 未发现Nginx缓存目录${NC}"
fi

echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}缓存清理完成!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""
echo -e "系统缓存已被清理，包括:"
echo -e "- 爬取结果"
echo -e "- 上传文件"
echo -e "- 日志文件"
echo -e "- 内存缓存 (通过重启服务)"
echo ""
echo -e "${YELLOW}您现在可以重新使用爬虫系统，它将从零开始缓存新的数据。${NC}"
EOF

chmod +x $CACHE_SCRIPT
echo -e "${GREEN}缓存清理脚本已创建: $CACHE_SCRIPT${NC}"

# 获取bbs配置作为模板
echo -e "${BLUE}检查现有证书和配置模板...${NC}"
if docker exec $NGINX_CONTAINER test -f /etc/nginx/conf.d/bbs.newrin.link.conf; then
    echo -e "${GREEN}找到现有配置模板: bbs.newrin.link${NC}"
    
    # 创建临时配置文件
    TMP_CONF=$(mktemp)
    docker exec $NGINX_CONTAINER cat /etc/nginx/conf.d/bbs.newrin.link.conf > $TMP_CONF
    
    # 替换域名
    sed -i "s/bbs\.newrin\.link/$DOMAIN_NAME/g" $TMP_CONF
    
    # 将修改后的配置复制到Nginx容器
    docker cp $TMP_CONF $NGINX_CONTAINER:/etc/nginx/conf.d/$DOMAIN_NAME.conf
    
    # 复制证书文件
    docker exec $NGINX_CONTAINER cp /etc/nginx/certs/bbs.newrin.link_cert.pem /etc/nginx/certs/${DOMAIN_NAME}_cert.pem
    docker exec $NGINX_CONTAINER cp /etc/nginx/certs/bbs.newrin.link_key.pem /etc/nginx/certs/${DOMAIN_NAME}_key.pem
    
    echo -e "${GREEN}已复制并修改配置模板${NC}"
    echo -e "${GREEN}已复制证书文件${NC}"
    
    rm -f $TMP_CONF
else
    # 没有找到模板，创建基本HTTP配置
    echo -e "${YELLOW}未找到配置模板，创建基本HTTP配置${NC}"
    
    # 创建Nginx配置文件
    NGINX_CONF_FILE="$INSTALL_DIR/crawler-nginx.conf"
    
    cat > $NGINX_CONF_FILE << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    
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

    # 将Nginx配置复制到容器
    docker cp $NGINX_CONF_FILE $NGINX_CONTAINER:/etc/nginx/conf.d/$DOMAIN_NAME.conf
fi

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
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}爬虫后端构建并启动成功${NC}"
else
    echo -e "${RED}爬虫后端启动失败，请检查日志${NC}"
    echo -e "${YELLOW}您可以使用以下命令查看日志: cd $INSTALL_DIR && docker-compose logs${NC}"
fi

# 安装完成
echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}全息拉普拉斯互联网爬虫系统安装完成!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""
echo -e "您的爬虫系统现已安装在 ${YELLOW}$INSTALL_DIR${NC}"

if docker exec $NGINX_CONTAINER test -f /etc/nginx/certs/${DOMAIN_NAME}_cert.pem; then
    echo -e "前端界面可通过 ${YELLOW}https://$DOMAIN_NAME${NC} 访问"
else
    echo -e "前端界面可通过 ${YELLOW}http://$DOMAIN_NAME${NC} 访问"
    echo -e "${YELLOW}如需配置HTTPS，您可以参考已有的配置文件:${NC}"
    echo -e "  例如: ${YELLOW}/etc/nginx/conf.d/bbs.newrin.link.conf${NC}"
fi

echo -e "确保您已经设置DNS记录，将 ${YELLOW}$DOMAIN_NAME${NC} 指向您的服务器IP"
echo ""

echo -e "${BLUE}系统管理命令:${NC}"
echo -e "  启动: ${YELLOW}cd $INSTALL_DIR && docker-compose up -d${NC}"
echo -e "  停止: ${YELLOW}cd $INSTALL_DIR && docker-compose down${NC}"
echo -e "  查看日志: ${YELLOW}cd $INSTALL_DIR && docker-compose logs -f${NC}"
echo -e "  清理缓存: ${YELLOW}sudo $CACHE_SCRIPT${NC}"
echo ""
echo -e "${BLUE}欢迎使用全息拉普拉斯互联网爬虫系统!${NC}"
