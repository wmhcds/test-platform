"""
tests 目录 conftest：登录前置 fixture 已统一收口到 auth.py，这里仅做再导出，
保证 pytest 仍能自动发现 auth_session / api（由 auth.py 提供）。
"""
from auth import auth_session, api  # noqa: F401
