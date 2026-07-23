@echo off
chcp 65001 >nul
REM ==========================================================
REM AI 用例执行平台 - 开发环境一键启动
REM ==========================================================

echo [1/4] 安装 Python 依赖...
cd /d "%~dp0server"
pip install -r requirements.txt -i https://mirrors.cloud.tencent.com/pypi/simple/ 2>nul
cd /d "%~dp0"

echo.
echo [2/4] 安装 Node.js 依赖...
cd /d "%~dp0web"
call npm install --registry=https://mirrors.cloud.tencent.com/npm/
cd /d "%~dp0"

echo.
echo [3/4] 启动后端 API 服务...
start "TestPlatform-Server" cmd /c "cd /d %~dp0server && uvicorn api.main:app --reload --port 8000"

echo [4/4] 启动前端开发服务器...
start "TestPlatform-Web" cmd /c "cd /d %~dp0web && npm run dev"

echo.
echo =========================================
echo   后端 API : http://localhost:8000/api/health
echo   前端页面 : http://localhost:5173
echo =========================================
echo.
echo 两个窗口已启动，关闭窗口即可停止服务。
pause
