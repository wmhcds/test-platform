"""项目路径相关的公共工具。"""
import os


def project_root() -> str:
    """返回项目根目录（server 目录）。"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def db_path() -> str:
    """返回 SQLite 数据库文件的绝对路径。

    优先读取 DB_PATH 环境变量（Docker/生产环境）；
    否则默认为项目根目录下的 test_platform.db。
    """
    env_path = os.getenv("DB_PATH", "")
    if env_path:
        return env_path
    return os.path.join(project_root(), "test_platform.db")
