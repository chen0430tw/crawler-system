#!/bin/bash
# 全息拉普拉斯互联网爬虫系统 - 启动脚本

# 定义颜色代码
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示欢迎信息
echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}    全息拉普拉斯互联网爬虫系统 - 启动程序    ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo ""

# 检查Python版本
echo -e "${YELLOW}[1/4] 检查Python环境...${NC}"
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$(python3 --version)
    echo -e "  ${GREEN}✓ 已找到 $PYTHON_VERSION${NC}"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
    PYTHON_VERSION=$(python --version)
    echo -e "  ${GREEN}✓ 已找到 $PYTHON_VERSION${NC}"
else
    echo -e "  ${RED}✗ 未找到Python。请安装Python 3.7或更高版本${NC}"
    exit 1
fi

# 检查必要的库
echo -e "\n${YELLOW}[2/4] 检查必要的库...${NC}"
REQUIRED_PACKAGES=("flask" "flask-cors" "requests" "beautifulsoup4" "nltk" "scikit-learn")
MISSING_PACKAGES=()

for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! $PYTHON_CMD -c "import $package" &>/dev/null; then
        MISSING_PACKAGES+=("$package")
        echo -e "  ${RED}✗ 缺少库: $package${NC}"
    else
        echo -e "  ${GREEN}✓ 已安装: $package${NC}"
    fi
done

# 安装缺失的库
if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}正在安装缺失的库...${NC}"
    $PYTHON_CMD -m pip install "${MISSING_PACKAGES[@]}"
    
    # 验证安装
    INSTALL_FAILED=0
    for package in "${MISSING_PACKAGES[@]}"; do
        if ! $PYTHON_CMD -c "import $package" &>/dev/null; then
            echo -e "  ${RED}✗ $package 安装失败${NC}"
            INSTALL_FAILED=1
        else
            echo -e "  ${GREEN}✓ $package 已成功安装${NC}"
        fi
    done
    
    if [ $INSTALL_FAILED -eq 1 ]; then
        echo -e "\n${RED}一些库安装失败。请尝试手动安装:${NC}"
        echo -e "${YELLOW}$PYTHON_CMD -m pip install ${MISSING_PACKAGES[*]}${NC}"
        exit 1
    fi
fi

# 创建必要的目录
echo -e "\n${YELLOW}[3/4] 创建必要的目录...${NC}"
DIRS=("uploads" "results" "logs")
for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "  ${GREEN}✓ 已创建目录: $dir${NC}"
    else
        echo -e "  ${GREEN}✓ 目录已存在: $dir${NC}"
    fi
done

# 启动爬虫服务器
echo -e "\n${YELLOW}[4/4] 启动爬虫服务器...${NC}"
echo -e "  ${BLUE}服务器将在 http://localhost:5000 上运行${NC}"
echo -e "  ${BLUE}请保持此窗口打开，按Ctrl+C停止服务器${NC}"
echo -e "${BLUE}===================================================${NC}"

# 启动Flask应用
export FLASK_APP=crawler_server.py
$PYTHON_CMD crawler_server.py