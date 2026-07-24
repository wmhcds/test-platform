"""FastAPI 后端入口。

运行：
  本地开发: uvicorn api.main:app --reload --port 8000
  CloudBase: 由 entrypoint.sh 自动启动
"""
import os
import sys
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
_WEB_INDEX = _WEB_DIST / "index.html"

if _WEB_DIST.exists():
    # 静态资源（JS/CSS/图片等）
    app.mount("/assets", StaticFiles(directory=str(_WEB_DIST / "assets")), name="assets")

    # SPA 路由兜底：非 API 请求返回 index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if not _WEB_INDEX.exists():
            raise HTTPException(status_code=404, detail="index.html not found")
        return FileResponse(str(_WEB_INDEX))


# ---- 启动 & 关闭事件 ----
@app.on_event("startup")
def on_startup():
    """应用启动：COS 恢复 → 初始化数据库 → 后台同步 + 自动清理。"""
    import threading
    import time

    from db.database import init_db
    from utils.cos_storage import download_db, _cos_enabled
    from utils.path_utils import db_path

    db_file = db_path()

    # 本地 DB 不存在或为空时，从 COS 恢复
    if _cos_enabled() and (not os.path.exists(db_file) or os.path.getsize(db_file) == 0):
        logger.info("Local DB missing/empty, restoring from COS...")
        download_db(db_file)

    init_db()
    logger.info("Database initialized")

    # 首次启动时主动上传一次到 COS，确保 COS 上始终有备份
    try:
        from utils.cos_storage import upload_db
        if _cos_enabled() and os.path.exists(db_file) and os.path.getsize(db_file) > 0:
            upload_db(db_file)
            logger.info("Initial COS upload done")
    except Exception as e:
        logger.warning(f"Initial COS upload failed: {e}")

    # COS 后台定期备份
    try:
        from utils.cos_storage import start_background_sync
        if _cos_enabled():
            start_background_sync(db_file, interval=300)
            logger.info("COS background sync started")
    except Exception as e:
        logger.warning(f"COS sync not started: {e}")

    # 后台线程：每 5 分钟检查并清理超过 200 条旧批次
    def _auto_cleanup():
        logger.info("Auto cleanup daemon started (keep=200)")
        while True:
            time.sleep(300)
            try:
                from utils.db_utils import cleanup_old_batches
                cleanup_old_batches(keep=200)
            except Exception as e:
                logger.error(f"Auto cleanup error: {e}")

    t = threading.Thread(target=_auto_cleanup, daemon=True)
    t.start()


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
