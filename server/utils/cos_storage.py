"""COS 对象存储工具：将 SQLite 数据库备份到腾讯云 COS，实现云端持久化。

COS 免费额度：50GB 存储 + 10GB/月流量，个人项目完全够用。
"""
import os
import time
import logging
import threading
from pathlib import Path

logger = logging.getLogger("cos_storage")

# COS 客户端（延迟导入，减少依赖）
_cos_client = None


def _get_cos_client():
    """懒加载 COS 客户端。"""
    global _cos_client
    if _cos_client is not None:
        return _cos_client

    secret_id = os.getenv("COS_SECRET_ID", "")
    secret_key = os.getenv("COS_SECRET_KEY", "")
    if not secret_id or not secret_key:
        logger.info("COS credentials not set, skip COS backup")
        return None

    from qcloud_cos import CosConfig, CosS3Client
    region = os.getenv("COS_REGION", "ap-guangzhou")
    config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    _cos_client = CosS3Client(config)
    return _cos_client


def _cos_enabled() -> bool:
    return bool(os.getenv("COS_SECRET_ID") and os.getenv("COS_SECRET_KEY"))


def get_bucket() -> str:
    return os.getenv("COS_BUCKET", "")


def get_db_key() -> str:
    return os.getenv("COS_DB_KEY", "test_platform/test_platform.db")


def upload_db(local_path: str) -> bool:
    """将本地数据库文件上传到 COS。"""
    if not _cos_enabled():
        return False
    client = _get_cos_client()
    if not client or not os.path.exists(local_path):
        return False
    try:
        client.upload_file(
            Bucket=get_bucket(),
            LocalFilePath=local_path,
            Key=get_db_key(),
        )
        logger.info(f"DB uploaded to COS: {get_db_key()}")
        return True
    except Exception as e:
        logger.error(f"COS upload failed: {e}")
        return False


def download_db(local_path: str) -> bool:
    """从 COS 下载数据库文件到本地（容器冷启动时恢复数据）。"""
    if not _cos_enabled():
        return False
    client = _get_cos_client()
    if not client:
        return False
    try:
        # 检查 COS 上是否存在
        client.head_object(Bucket=get_bucket(), Key=get_db_key())
        client.download_file(
            Bucket=get_bucket(),
            Key=get_db_key(),
            DestFilePath=local_path,
        )
        if os.path.exists(local_path):
            logger.info(f"DB restored from COS: {local_path} ({os.path.getsize(local_path)} bytes)")
            return True
    except Exception as e:
        logger.info(f"No existing DB in COS: {e}")
    return False


def start_background_sync(local_path: str, interval: int = 300):
    """启动后台线程，定期备份数据库到 COS。

    Args:
        local_path: 本地 SQLite 文件路径
        interval: 备份间隔（秒），默认 5 分钟
    """
    if not _cos_enabled():
        logger.info("COS not configured, background sync disabled")
        return

    def _sync_loop():
        logger.info(f"COS background sync started (interval={interval}s)")
        last_mtime = 0
        while True:
            time.sleep(interval)
            try:
                current_mtime = os.path.getmtime(local_path)
                if current_mtime > last_mtime:
                    upload_db(local_path)
                    last_mtime = current_mtime
            except Exception as e:
                logger.error(f"COS sync error: {e}")

    t = threading.Thread(target=_sync_loop, daemon=True)
    t.start()
