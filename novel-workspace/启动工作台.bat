@echo off
chcp 65001 >nul
echo ========================================
echo    📖 小说创作工作台 - 启动中...
echo ========================================
echo.

:: 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Python，正在尝试 py 命令...
    py --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo ❌ 未找到 Python！请安装 Python 3.x
        echo    下载地址: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    set PYTHON=py
) else (
    set PYTHON=python
)

echo ✅ Python 已就绪
echo 🚀 正在启动服务器...
echo.
echo    访问地址: http://localhost:8266
echo    按 Ctrl+C 停止服务器
echo ========================================
echo.

:: 启动浏览器（延迟1秒），直接打开novel-studio.html
start "" cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:8266"

:: 启动服务器（使用根目录的server.py）
%PYTHON% "%~dp0..\server.py"
