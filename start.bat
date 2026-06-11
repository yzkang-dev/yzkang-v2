@echo off
chcp 65001 >nul
title 颐智康养 - 一键启动

echo ==============================
echo   颐智康养 SaaS 系统启动中...
echo ==============================
echo.

cd /d "%~dp0backend"
start "颐智康养-后端" cmd /c "venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000"

echo [OK] 后端已启动 (端口 8000)

cd /d "%~dp0frontend-admin"
start "颐智康养-前端" cmd /c "..\..\..\..\..\.workbuddy\binaries\node\versions\22.12.0\node.exe node_modules\vite\bin\vite.js --port 5174 --host 0.0.0.0"

echo [OK] 前端已启动 (端口 5174)
echo.
echo ==============================
echo   等待服务就绪...
echo ==============================

timeout /t 5 /nobreak >nul

echo.
echo ==============================
echo   启动完成！
echo   请打开浏览器访问: http://localhost:5174
echo   登录账号: admin / admin123
echo ==============================
echo.
pause
