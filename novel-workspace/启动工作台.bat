@echo off
cd /d "%~dp0"
echo 正在启动服务器...
start "" http://localhost:8266
python server.py
pause
