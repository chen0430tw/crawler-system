@echo off
setlocal EnableDelayedExpansion
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
REM 修正导入名称与包名的映射
set PACKAGES=flask:flask
set PACKAGES=%PACKAGES%;flask-cors:flask_cors
set PACKAGES=%PACKAGES%;requests:requests
set PACKAGES=%PACKAGES%;beautifulsoup4:bs4
set PACKAGES=%PACKAGES%;nltk:nltk
set PACKAGES=%PACKAGES%;scikit-learn:sklearn

set INSTALL_PACKAGES=

for %%p in (%PACKAGES%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%p") do (
        %PYTHON_CMD% -c "import %%b" >nul 2>nul
        if !ERRORLEVEL! NEQ 0 (
            echo   ✗ 缺少库: %%a
            set INSTALL_PACKAGES=!INSTALL_PACKAGES! %%a
        ) else (
            echo   √ 已安装: %%a
        )
    )
)

if defined INSTALL_PACKAGES (
    echo.
    echo 正在安装缺失的库...
    %PYTHON_CMD% -m pip install !INSTALL_PACKAGES!
    
    REM 验证安装
    set INSTALL_FAILED=0
    for %%p in (%PACKAGES%) do (
        for /f "tokens=1,2 delims=:" %%a in ("%%p") do (
            if "!INSTALL_PACKAGES!"=="" goto check_dirs
            echo !INSTALL_PACKAGES! | findstr /C:"%%a" >nul
            if !ERRORLEVEL! EQU 0 (
                %PYTHON_CMD% -c "import %%b" >nul 2>nul
                if !ERRORLEVEL! NEQ 0 (
                    echo   ✗ %%a 安装失败
                    set INSTALL_FAILED=1
                ) else (
                    echo   √ %%a 已成功安装
                )
            )
        )
    )
    
    if !INSTALL_FAILED! EQU 1 (
        echo.
        echo 一些库安装失败。请尝试手动安装:
        echo %PYTHON_CMD% -m pip install !INSTALL_PACKAGES!
        pause
        exit /b 1
    )
)

:check_dirs
echo.
echo [3/4] 创建必要的目录...
set DIRS=uploads results logs
for %%d in (%DIRS%) do (
    if not exist backend\%%d (
        mkdir backend\%%d
        echo   √ 已创建目录: backend\%%d
    ) else (
        echo   √ 目录已存在: backend\%%d
    )
)

echo.
echo [4/4] 启动爬虫服务器...
echo   服务器将在 http://localhost:5000 上运行
echo   请保持此窗口打开，按Ctrl+C停止服务器
echo ===================================================

REM 启动Flask应用
cd %~dp0
set FLASK_APP=backend/crawler_server.py
%PYTHON_CMD% backend/crawler_server.py