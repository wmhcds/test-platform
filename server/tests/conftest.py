"""
tests 目录 conftest：登录前置 fixture 已统一收口到 auth.py，这里仅做再导出。
"""
import sys
import os

# 确保 tests 目录在 Python 路径中，让 pytest 能找到 auth 模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auth import auth_session, api  # noqa: F401
