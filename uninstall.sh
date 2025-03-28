#!/bin/bash

# 全息拉普拉斯互联网爬虫系统 - 卸载脚本
# 用于完全卸载爬虫系统

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示横幅
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   全息拉普拉斯互联网爬虫系统 - 卸载脚本     ${NC}"
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

# 要求用户确认
echo -e "${YELLOW}警告: 此操作将完全删除爬虫系统${NC}"
read -p "请输入爬虫系统的域名 (例如: crawler.example.com): " DOMAIN_NAME
read -p "请输入Nginx容器名称 (默认: nginx): " NGINX_CONTAINER
NGINX_CONTAINER=${NGINX_CONTAINER:-nginx}

echo -e "${RED}您确定要删除爬虫系统吗? 此操作不可逆! [y/N]${NC} "
read -p "" confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo -e "${GREEN}卸载已取消${NC}"
    exit 0
fi

# 停止并删除爬虫后端容器
echo -e "${BLUE}停止并删除爬虫后端...${NC}"
if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    cd $INSTALL_DIR
    docker-compose down
    docker rmi crawler-backend 2>/dev/null
    echo -e "${GREEN}爬虫后端已停止并删除${NC}"
else
    echo -e "${YELLOW}找不到docker-compose配置，尝试直接删除容器...${NC}"
    docker stop crawler-backend 2>/dev/null
    docker rm crawler-backend 2>/dev/null
    docker rmi crawler-backend 2>/dev/null
fi

# 删除Nginx配置
echo -e "${BLUE}删除Nginx配置...${NC}"
if docker exec $NGINX_CONTAINER test -f /etc/nginx/conf.d/$DOMAIN_NAME.conf; then
    docker exec $NGINX_CONTAINER rm /etc/nginx/conf.d/$DOMAIN_NAME.conf
    echo -e "${GREEN}Nginx配置已删除${NC}"
else
    echo -e "${YELLOW}找不到Nginx配置文件${NC}"
fi

# 删除前端文件
echo -e "${BLUE}删除前端文件...${NC}"
if docker exec $NGINX_CONTAINER test -d /var/www/html/$DOMAIN_NAME; then
    docker exec $NGINX_CONTAINER rm -rf /var/www/html/$DOMAIN_NAME
    echo -e "${GREEN}前端文件已删除${NC}"
else
    echo -e "${YELLOW}找不到前端文件目录${NC}"
fi

# 重载Nginx配置
echo -e "${BLUE}重载Nginx配置...${NC}"
if docker ps | grep -q "$NGINX_CONTAINER"; then
    docker exec $NGINX_CONTAINER nginx -s reload
    echo -e "${GREEN}Nginx配置已重载${NC}"
else
    echo -e "${YELLOW}找不到Nginx容器，无法重载配置${NC}"
fi

# 删除安装目录
echo -e "${BLUE}删除安装目录...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    rm -rf $INSTALL_DIR
    echo -e "${GREEN}安装目录已删除${NC}"
else
    echo -e "${YELLOW}找不到安装目录${NC}"
fi

# 卸载完成
echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}全息拉普拉斯互联网爬虫系统卸载完成!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""
echo -e "所有组件已被移除，包括："
echo -e "- 爬虫后端容器和镜像"
echo -e "- Nginx配置文件"
echo -e "- 前端文件"
echo -e "- 安装目录"
echo ""
echo -e "${YELLOW}注意：爬取结果数据已被删除，如果需要保留，请提前备份${NC}"