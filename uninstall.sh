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

# 检查Nginx容器是否存在
if ! docker ps -a | grep -q "$NGINX_CONTAINER"; then
    echo -e "${YELLOW}警告: 找不到名为 $NGINX_CONTAINER 的容器，继续卸载可能不完整${NC}"
    read -p "是否继续? [y/N] " continue_without_nginx
    if [[ $continue_without_nginx != [yY] && $continue_without_nginx != [yY][eE][sS] ]]; then
        echo -e "${GREEN}卸载已取消${NC}"
        exit 0
    fi
fi

# 询问是否需要备份数据
echo -e "${YELLOW}是否需要备份爬虫数据? [y/N]${NC}"
read -p "" backup_data
if [[ $backup_data == [yY] || $backup_data == [yY][eE][sS] ]]; then
    BACKUP_DIR="/tmp/crawler-backup-$(date +%Y%m%d%H%M%S)"
    echo -e "${BLUE}创建备份目录: $BACKUP_DIR${NC}"
    mkdir -p $BACKUP_DIR
    
    # 备份爬虫结果和上传数据
    if [ -d "$INSTALL_DIR/backend/results" ]; then
        cp -r $INSTALL_DIR/backend/results $BACKUP_DIR/
    fi
    if [ -d "$INSTALL_DIR/backend/uploads" ]; then
        cp -r $INSTALL_DIR/backend/uploads $BACKUP_DIR/
    fi
    
    echo -e "${GREEN}数据已备份到: $BACKUP_DIR${NC}"
fi

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
    docker-compose down || echo -e "${YELLOW}警告: docker-compose down 失败${NC}"
    
    # 查找并删除相关镜像
    IMAGES=$(docker images | grep 'crawler-backend\|crawler-system_crawler-backend' | awk '{print $1}')
    if [ -n "$IMAGES" ]; then
        echo -e "${BLUE}删除相关镜像: $IMAGES${NC}"
        for image in $IMAGES; do
            docker rmi $image || echo -e "${YELLOW}警告: 删除镜像 $image 失败${NC}"
        done
    fi
    
    echo -e "${GREEN}爬虫后端已停止并删除${NC}"
else
    echo -e "${YELLOW}找不到docker-compose配置，尝试直接删除容器...${NC}"
    docker stop crawler-backend 2>/dev/null || true
    docker rm crawler-backend 2>/dev/null || true
    
    # 查找并删除相关镜像
    IMAGES=$(docker images | grep 'crawler-backend\|crawler-system_crawler-backend' | awk '{print $1}')
    if [ -n "$IMAGES" ]; then
        echo -e "${BLUE}删除相关镜像: $IMAGES${NC}"
        for image in $IMAGES; do
            docker rmi $image || echo -e "${YELLOW}警告: 删除镜像 $image 失败${NC}"
        done
    fi
fi

# 删除Nginx配置
echo -e "${BLUE}删除Nginx配置...${NC}"
if docker ps | grep -q "$NGINX_CONTAINER"; then
    if docker exec $NGINX_CONTAINER test -f /etc/nginx/conf.d/$DOMAIN_NAME.conf 2>/dev/null; then
        docker exec $NGINX_CONTAINER rm /etc/nginx/conf.d/$DOMAIN_NAME.conf
        echo -e "${GREEN}Nginx配置已删除${NC}"
    else
        echo -e "${YELLOW}找不到Nginx配置文件: /etc/nginx/conf.d/$DOMAIN_NAME.conf${NC}"
    fi
else
    echo -e "${YELLOW}Nginx容器不在运行状态，无法删除配置文件${NC}"
fi

# 删除前端文件
echo -e "${BLUE}删除前端文件...${NC}"
if docker ps | grep -q "$NGINX_CONTAINER"; then
    if docker exec $NGINX_CONTAINER test -d /var/www/html/$DOMAIN_NAME 2>/dev/null; then
        docker exec $NGINX_CONTAINER rm -rf /var/www/html/$DOMAIN_NAME
        echo -e "${GREEN}前端文件已删除${NC}"
    else
        echo -e "${YELLOW}找不到前端文件目录: /var/www/html/$DOMAIN_NAME${NC}"
    fi
else
    echo -e "${YELLOW}Nginx容器不在运行状态，无法删除前端文件${NC}"
fi

# 重载Nginx配置
echo -e "${BLUE}重载Nginx配置...${NC}"
if docker ps | grep -q "$NGINX_CONTAINER"; then
    docker exec $NGINX_CONTAINER nginx -s reload || echo -e "${YELLOW}警告: Nginx配置重载失败${NC}"
    echo -e "${GREEN}Nginx配置已重载${NC}"
else
    echo -e "${YELLOW}Nginx容器不在运行状态，无法重载配置${NC}"
fi

# 删除安装目录
echo -e "${BLUE}删除安装目录...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    rm -rf $INSTALL_DIR || echo -e "${YELLOW}警告: 删除安装目录失败，可能需要手动删除${NC}"
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${GREEN}安装目录已删除${NC}"
    fi
else
    echo -e "${YELLOW}找不到安装目录: $INSTALL_DIR${NC}"
fi

# 清理Docker网络(如果不再使用)
echo -e "${BLUE}检查并清理Docker网络...${NC}"
DOCKER_NETWORKS=$(docker network ls | grep crawler | awk '{print $2}')
if [ -n "$DOCKER_NETWORKS" ]; then
    echo -e "${YELLOW}发现可能相关的Docker网络:${NC}"
    for network in $DOCKER_NETWORKS; do
        echo "  - $network"
    done
    
    echo -e "${YELLOW}是否清理这些网络? [y/N]${NC}"
    read -p "" clean_networks
    if [[ $clean_networks == [yY] || $clean_networks == [yY][eE][sS] ]]; then
        for network in $DOCKER_NETWORKS; do
            docker network rm $network || echo -e "${YELLOW}警告: 无法删除网络 $network${NC}"
        done
    fi
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

if [[ $backup_data == [yY] || $backup_data == [yY][eE][sS] ]]; then
    echo -e "${YELLOW}备份数据位于: $BACKUP_DIR${NC}"
    echo -e "请自行保存并管理此备份"
else
    echo -e "${YELLOW}注意：所有爬取结果数据已被删除${NC}"
fi