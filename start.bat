@echo off
REM 全息拉普拉斯互联网爬虫系统 - Windows启动脚本

echo ===================================================
echo     全息拉普拉斯互联网爬虫系统 - 启动程序    
echo ===================================================
echo.

echo [1/4] 检查Python环境...
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python --version
    set PYTHON_CMD=python
    echo   √ Python已找到
) else (
    where python3 >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        python3 --version
        set PYTHON_CMD=python3
        echo   √ Python3已找到
    ) else (
        echo   ✗ 未找到Python。请安装Python 3.7或更高版本
        pause
        exit /b 1
    )
)

echo.
echo [2/4] 检查必要的库...
set REQUIRED_PACKAGES=flask flask-cors requests beautifulsoup4 nltk scikit-learn
set INSTALL_PACKAGES=

for %%p in (%REQUIRED_PACKAGES%) do (
    %PYTHON_CMD% -c "import %%p" >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo   ✗ 缺少库: %%p
        set INSTALL_PACKAGES=!INSTALL_PACKAGES! %%p
    ) else (
        echo   √ 已安装: %%p
    )
)

if defined INSTALL_PACKAGES (
    echo.
    echo 正在安装缺失的库...
    %PYTHON_CMD% -m pip install %INSTALL_PACKAGES%
    
    REM 验证安装
    set INSTALL_FAILED=0
    for %%p in (%INSTALL_PACKAGES%) do (
        %PYTHON_CMD% -c "import %%p" >nul 2>nul
        if %ERRORLEVEL% NEQ 0 (
            echo   ✗ %%p 安装失败
            set INSTALL_FAILED=1
        ) else (
            echo   √ %%p 已成功安装
        )
    )
    
    if %INSTALL_FAILED% EQU 1 (
        echo.
        echo 一些库安装失败。请尝试手动安装:
        echo %PYTHON_CMD% -m pip install %INSTALL_PACKAGES%
        pause
        exit /b 1
    )
)

echo.
echo [3/4] 创建必要的目录...
set DIRS=uploads results logs
for %%d in (%DIRS%) do (
    if not exist %%d (
        mkdir %%d
        echo   √ 已创建目录: %%d
    ) else (
        echo   √ 目录已存在: %%d
    )
)

echo.
echo [4/4] 启动爬虫服务器...
echo   服务器将在 http://localhost:5000 上运行
echo   请保持此窗口打开，按Ctrl+C停止服务器
echo ===================================================

REM 启动Flask应用
set FLASK_APP=crawler_server.py
%PYTHON_CMD% crawler_server.py
