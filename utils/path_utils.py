"""项目路径相关的公共工具。"""
import os


def project_root() -> str:
    """返回项目根目录（utils 包所在目录的上一级）。"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def db_path() -> str:
    """返回 SQLite 数据库文件的绝对路径。"""
    return os.path.join(project_root(), "test_platform.db")
