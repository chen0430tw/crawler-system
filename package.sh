#!/bin/bash

# 全息拉普拉斯互联网爬虫系统 - 打包脚本
# 用于将项目打包成可发布的压缩文件，包含所有必要文件

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示横幅
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}     全息拉普拉斯互联网爬虫系统 - 打包脚本    ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# 检查目录结构
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}错误: 找不到前端或后端目录${NC}"
    echo "请确保在项目根目录中运行此脚本"
    exit 1
fi

# 创建临时目录
TEMP_DIR=$(mktemp -d)
PACKAGE_NAME="crawler-system"
echo -e "${BLUE}创建临时目录: $TEMP_DIR${NC}"

# 复制必要文件
echo -e "${BLUE}复制项目文件...${NC}"

# 前端文件
mkdir -p $TEMP_DIR/frontend
cp -r frontend/index.html frontend/styles.css frontend/script.js frontend/api_client.js $TEMP_DIR/frontend/

# 后端文件
mkdir -p $TEMP_DIR/backend
cp -r backend/crawler.py backend/crawler_server.py backend/requirements.txt $TEMP_DIR/backend/

# 安装脚本
cp install.sh $TEMP_DIR/

# 创建README文件
cat > $TEMP_DIR/README.md << 'EOF'
# 全息拉普拉斯互联网爬虫系统

基于全息拉普拉斯互联网图理论的网页爬虫系统，用于爬取和分析网页内容。

## 系统特点

- **服务器模式**：爬虫以服务形式运行，支持多任务并发执行
- **实时监控**：实时监控任务执行状态与进度
- **灵活配置**：通过网页界面配置，无需编程知识
- **内容清洗**：自动移除广告、导航栏等噪声内容
- **自动分类**：基于内容相似度自动对爬取的网页进行分类
- **阴谋论检测**：基于全息拉普拉斯互联网图理论的网页内容分析

## 系统要求

- Docker 和 Docker Compose
- 运行中的Nginx容器
- 公网IP或域名（可选，用于远程访问）

## 快速安装

1. 确保您的服务器上已安装Docker和Docker Compose
2. 下载并解压此软件包
3. 运行安装脚本:

```bash
sudo ./install.sh
```

4. 按照提示输入您的域名和Nginx容器名称
5. 安装脚本将自动配置系统并启动服务

详细使用说明请参见安装完成后的提示信息。

## 自定义配置

如需自定义配置，可以编辑以下文件:

- Nginx配置: `/etc/nginx/conf.d/your-domain.conf`
- 后端配置: `/opt/crawler-system/docker-compose.yml`

## 卸载

要卸载系统，请运行:

```bash
sudo docker-compose -f /opt/crawler-system/docker-compose.yml down
sudo docker rmi crawler-backend
sudo rm -rf /opt/crawler-system
sudo docker exec nginx rm /etc/nginx/conf.d/your-domain.conf
sudo docker exec nginx rm -rf /var/www/html/your-domain
sudo docker exec nginx nginx -s reload
```

## 许可证

MIT License
EOF

# 创建版本信息文件
VERSION="1.0.0"
DATE=$(date +"%Y-%m-%d")

cat > $TEMP_DIR/VERSION.txt << EOF
全息拉普拉斯互联网爬虫系统
版本: $VERSION
发布日期: $DATE
作者: 430
EOF

# 打包文件
echo -e "${BLUE}打包文件...${NC}"
CURRENT_DIR=$(pwd)
cd $TEMP_DIR
tar -czf "$CURRENT_DIR/$PACKAGE_NAME-$VERSION.tar.gz" .
cd "$CURRENT_DIR"

# 清理临时目录
rm -rf $TEMP_DIR

echo -e "${GREEN}打包完成!${NC}"
echo -e "软件包已创建: ${YELLOW}$PACKAGE_NAME-$VERSION.tar.gz${NC}"
echo ""
echo -e "${BLUE}包含内容:${NC}"
echo -e "- 前端文件 (HTML, CSS, JavaScript)"
echo -e "- 后端爬虫代码"
echo -e "- 自动安装脚本"
echo -e "- 文档和说明"
echo ""
echo -e "${YELLOW}您可以将此软件包分享或发布到GitHub${NC}"