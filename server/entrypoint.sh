#!/bin/sh
# CloudBase CloudRun 容器启动脚本
# 1. 从 COS 恢复 SQLite 数据库（如果配置了 COS）
# 2. 启动 FastAPI 服务

echo "[entrypoint] Starting..."

# COS 恢复数据库（如果环境变量已配置）
if [ -n "$COS_SECRET_ID" ] && [ -n "$COS_SECRET_KEY" ]; then
    echo "[entrypoint] COS configured, restoring database..."
    python -c "
from utils.cos_storage import download_db
from utils.path_utils import db_path
download_db(db_path())
" || echo "[entrypoint] COS restore skipped (first run or no backup)"
fi

# 初始化数据库表结构
python -c "from db.database import init_db; init_db(); print('[entrypoint] DB initialized')"

# 启动 FastAPI（监听 CloudRun 分配的端口）
echo "[entrypoint] Starting FastAPI on port ${PORT:-80}..."
exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-80}
