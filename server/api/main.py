"""FastAPI 后端入口。

运行：
  本地开发: uvicorn api.main:app --reload --port 8000
  CloudBase: 由 entrypoint.sh 自动启动
"""
import os
import sys
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routers import batches, runner, http_proxy

# 确保 server 目录在 sys.path
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(title="AI Test Platform API", version="1.0.0")

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- 路由 ----
app.include_router(batches.router)
app.include_router(runner.router)
app.include_router(http_proxy.router)

# ---- 生产模式：托管前端静态资源 ----
_WEB_DIST = _ROOT.parent / "web" / "dist"
if _WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_WEB_DIST), html=True), name="web")


# ---- 启动 & 关闭事件 ----
@app.on_event("startup")
def on_startup():
    """应用启动：初始化数据库 + 启动 COS 后台同步。"""
    from db.database import init_db
    init_db()
    logger.info("Database initialized")

    # 启动 COS 定期备份（如果配置了 COS 环境变量）
    try:
        from utils.cos_storage import start_background_sync, _cos_enabled
        from utils.path_utils import db_path
        if _cos_enabled():
            start_background_sync(db_path(), interval=300)  # 每 5 分钟备份
            logger.info("COS background sync started")
    except Exception as e:
        logger.warning(f"COS sync not started: {e}")


@app.on_event("shutdown")
def on_shutdown():
    """应用关闭：最后一次备份数据库到 COS。"""
    try:
        from utils.cos_storage import upload_db, _cos_enabled
        from utils.path_utils import db_path
        if _cos_enabled():
            upload_db(db_path())
            logger.info("Final COS backup on shutdown")
    except Exception as e:
        logger.warning(f"COS shutdown backup failed: {e}")


@app.get("/api/health")
def health():
    db_type = os.getenv("DB_TYPE", "sqlite")
    cos_ok = bool(os.getenv("COS_SECRET_ID")) and bool(os.getenv("COS_BUCKET"))
    return {
        "status": "ok",
        "db_type": db_type,
        "cos_enabled": cos_ok,
    }
