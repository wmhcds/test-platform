"""登录方式抽象层。

不同业务系统有各自独立的登录方式（当前为 XBOSS，后续可扩展更多）。
每个登录方式实现 LoginProvider 接口，对外提供 get_session() 返回已登录的
requests.Session。http_proxy 根据前端传入的 login_type 选择对应 provider，
实现「前端选哪种登录方式就用哪种方式登录」。

新增一个系统只需：
  1. 写一个 Provider 子类实现 get_session()
  2. 在 LOGIN_PROVIDERS 注册表里登记
前端下拉框追加对应枚举即可，后端无需改其它逻辑。
"""
import importlib.util
from pathlib import Path
from typing import Dict

import requests

# 复用 tests/auth.py 中的 XBOSS 登录逻辑。
# auth.py 位于 tests 目录、并非标准包，这里按文件路径显式加载，
# 既能在运行时正确导入，也不会触发静态分析的「未解析引用」误报。
_AUTH_PATH = Path(__file__).resolve().parent.parent / "tests" / "auth.py"
_spec = importlib.util.spec_from_file_location("tests_auth", _AUTH_PATH)
_auth = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_auth)

xboss_build_session = _auth.build_session
API_HOST = _auth.API_HOST
VERIFY_SSL = _auth.VERIFY_SSL
UA = _auth.UA


class LoginProvider:
    """登录方式基类：子类实现 get_session 返回已登录 session。"""

    name: str = ""

    def get_session(self) -> requests.Session:
        raise NotImplementedError


class XbossLoginProvider(LoginProvider):
    """XBOSS 系统登录（betapower SSO + OAuth 授权）。"""

    name = "XBOSS"

    def get_session(self) -> requests.Session:
        return xboss_build_session()


# 登录方式注册表：前端传入的 login_type 对应到这里
LOGIN_PROVIDERS: Dict[str, LoginProvider] = {
    "XBOSS": XbossLoginProvider(),
}

DEFAULT_LOGIN_TYPE = "XBOSS"


def get_provider(login_type: str) -> LoginProvider:
    """根据前端传入的 login_type 取对应 provider，未知值回退默认。"""
    return LOGIN_PROVIDERS.get(
        (login_type or "").upper(), LOGIN_PROVIDERS[DEFAULT_LOGIN_TYPE]
    )
