#!/bin/bash
# ==========================================================
# AI 用例执行平台 - 开发环境一键启动 (Linux/Mac)
# ==========================================================

# 1/4: 安装 Python 依赖
cd server
pip install -r requirements.txt -i https://mirrors.cloud.tencent.com/pypi/simple/
cd ..

# 2/4: 安装 Node.js 依赖
cd web
npm install --registry=https://mirrors.cloud.tencent.com/npm/
cd ..

# 3/4: 启动服务
echo "启动后端 API 服务 (http://localhost:8000)..."
cd server && uvicorn api.main:app --reload --port 8000 &
SERVER_PID=$!

echo "启动前端开发服务器 (http://localhost:5173)..."
cd ../web && npm run dev &
WEB_PID=$!

# 4/4: 等待中断后清理
echo ""
echo "========================================="
echo "  API: http://localhost:8000/api/health"
echo "  Web: http://localhost:5173"
echo "  Ctrl+C 停止所有服务"
echo "========================================="

trap "kill $SERVER_PID $WEB_PID 2>/dev/null; exit 0" INT TERM
wait
