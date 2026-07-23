"""
登录客户端（接口1 + 接口2）

封装 betapower 的「表单登录 + OAuth 授权」流程，返回已携带 SSO token 的
requests.Session，供其他测试用例先完成登录、再访问业务接口。

用法：
    from auth import login_flow
    session = login_flow()                       # 先调用登录接口完成登录
    session.post("https://beta.vb.oa.com/xxx")   # 再携带登录态访问业务接口
"""
import base64
import json
import os

import pytest
import requests
import urllib3
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
from utils.log_utils import TeeLogger

# 内网自签名证书下我们主动关闭校验，抑制由此产生的告警噪音
urllib3.disable_warnings()

LOGIN_HOST = "https://betapower.vb.woa.com"
API_HOST = "https://beta.vb.oa.com"

# 抓包得到的账号信息（调试用，正式请走环境变量 TEST_USERNAME / TEST_PASSWORD）
USERNAME = os.getenv("TEST_USERNAME", "76229")
# 明文密码（抓包时浏览器已加密，这里用真实明文，由服务端校验）
PASSWORD = os.getenv("TEST_PASSWORD", "G70b{475")

# 抓包得到的 OAuth 授权参数
OAUTH_PARAMS = {
    "response_type": "code",
    "client_id": "a3bdc0c84ef14b7a",
    "state": "https://beta.vb.oa.com:443/xboss/systems",
    "redirect_uri": "https://beta.vb.oa.com/plugins/login?powerEnv=default",
}

# 抓包得到的业务接口 cookie（含 eagle_access_token），用于绕过登录单独验证接口
CAPTURED_COOKIES = {
    "lang": "zh-CN",
    "kong_user_name": "v_mhhwang",
    "eagle_access_token": (
        "eyJ2ZXIiOiJ2MiIsInVpZCI6ImVlZjA5ZjQ1LTM2YWItNDYwYi1hYTdkLWRiY2FiNzYyYzNjNSIs"
        "InR5cCI6MSwiZW5jIjp0cnVlLCJzdWIiOiJ2X21oaHdhbmciLCJ0dGwiOjQzMjAwLCJpYXQiOjE3ODQx"
        "NjgwMDk1MjR9.V39ek5GT1N0kLipRY3pGn9oUTuxfGoJWQa_ozYPbUnR53G07vzbuEHwRg4EiJrciEP"
        "-omlvGXLM_eOXi9Ecp1iE2i3A0ObTqs__ZuVIrKKYnoRmXsoyLpqdqyZv-sS-qUpKZXdg4arc6HdjB4yzb1Q"
        ".MEUCIDbLyy-B8aQjjVQYpx6bcIvELDZCUH1CDbRGzc8es2_YAiEAzYHv3ADOKmN-DXJ4Hiw8ufismhgsoMmohbeRNreG9h0"
    ),
    "x_host_key_access_https": "505b55e7073cfc5594993de38e0d712bdfd661dd_s",
    "x-client-ssid": "ad622415:019f68aecb09:0db9af",
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
TIMEOUT = 15

# 内部域名通常使用自签名/企业 CA 证书，Python 默认不信任会报
# CERTIFICATE_VERIFY_FAILED。内网测试环境默认关闭校验；
# 正式环境请设为 true 并通过 REQUESTS_CA_BUNDLE 指定企业 CA 路径。
VERIFY_SSL = os.getenv("VERIFY_SSL", "false").lower() == "true"


def get_login_secret(session: requests.Session):
    """拉取登录页配置，返回 (aesSecret, redisKey)"""
    resp = session.get(
        f"{LOGIN_HOST}/sso/login/",
        headers={"Accept": "application/json"},
        timeout=TIMEOUT,
        verify=VERIFY_SSL,
    )
    result = resp.json().get("result", {}) or {}
    return result.get("aesSecret"), result.get("redisKey")


def aes_ecb_encrypt(plain: str, secret: str) -> str:
    """复刻登录页 JS：AES-ECB(Pkcs7)，key 为 aesSecret 的 UTF8 字节，输出 base64"""
    key = secret.encode("utf-8")
    cipher = AES.new(key, AES.MODE_ECB)
    ct = cipher.encrypt(pad(plain.encode("utf-8"), AES.block_size))
    return base64.b64encode(ct).decode("utf-8")


def login_flow() -> requests.Session:
    """执行登录 + OAuth 授权，返回已携带 token 的会话"""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": UA,
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
    )

    # 浏览器登录页逻辑：先取 aesSecret/redisKey，把明文密码 AES 加密后
    # 拼成 "<密文>###<redisKey>" 作为表单 password 提交
    aes_secret, redis_key = get_login_secret(session)
    enc_pw = aes_ecb_encrypt(PASSWORD, aes_secret)
    login_password = f"{enc_pw}###{redis_key}"

    # 步骤 1：表单登录
    login_resp = session.post(
        f"{LOGIN_HOST}/login",
        data={"username": USERNAME, "password": login_password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        allow_redirects=False,
        timeout=TIMEOUT,
        verify=VERIFY_SSL,
    )
    # 步骤 2：OAuth 授权（跟随重定向到 beta.vb.oa.com 并写入 eagle_access_token）
    oauth_resp = session.get(
        f"{LOGIN_HOST}/oauth/authorize",
        params=OAUTH_PARAMS,
        allow_redirects=True,
        timeout=TIMEOUT,
        verify=VERIFY_SSL,
    )
    return session


def build_session() -> requests.Session:
    """登录一次：优先走实时登录接口（接口1+2），

    若实时登录未能拿到 eagle_access_token（如抓包凭证过期、服务端校验变化
    导致登录返回 ?error），则自动回退到抓包 token，保证后续业务用例仍可运行。
    返回携带 token 的 session（全会话共享同一个）。
    """
    session = login_flow()
    if session.cookies.get("eagle_access_token"):
        print("[auth] 实时登录成功，使用登录接口获取的 token")
        return session

    # 实时登录失败，回退到抓包 token
    print("[auth] 实时登录失败，已回退使用抓包 token（凭证可能已过期）")
    session.cookies.update(CAPTURED_COOKIES)
    return session


@pytest.fixture(scope="session")
def auth_session():
    """前置：登录一次，返回携带 token 的 session（全会话共享）"""
    session = build_session()
    yield session


class ApiClient:
    """基于已登录 session 的灵活请求客户端。

    返回原始 requests.Response，由用例自行断言；每次请求自动打印（并写入
    tests/api_call_log.txt）请求方式、URL、参数与完整返回内容，方便排查。

    支持 GET / POST（json、表单、文件上传）：
        api.get(url, params={...})
        api.post(url, json={...})
        api.post(url, data={...}, files={...})     # 直接传文件
        api.upload(url, "a.png", field="file")      # 便捷上传单个文件
    """

    def __init__(self, session: requests.Session, log_path: str = None):
        self._s = session
        self._log_path = log_path or os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "api_call_log.txt"
        )
        self._logger = TeeLogger(self._log_path)

    # ---- 内部工具 ----
    def _log(self, msg=""):
        self._logger.log(msg)

    def _full_url(self, url: str) -> str:
        return url if url.startswith("http") else API_HOST + url

    def _log_req(self, method, url, json_body=None, data=None, params=None, files=None):
        self._log("=" * 60)
        self._log(f"请求方式 : {method}")
        self._log(f"请求URL  : {url}")
        if params is not None:
            self._log(f"查询参数 : {json.dumps(params, ensure_ascii=False)}")
        if json_body is not None:
            self._log(f"请求JSON : {json.dumps(json_body, ensure_ascii=False)}")
        if data is not None:
            self._log(f"表单数据 : {data}")
        if files is not None:
            names = list(files.keys()) if isinstance(files, dict) else "files"
            self._log(f"上传文件 : {names}")

    def _log_resp(self, resp: requests.Response):
        self._log(f"返回状态 : {resp.status_code}")
        preview = resp.text
        if len(preview) > 1500:
            preview = (
                preview[:1500]
                + f" ...(已截断，完整 {len(resp.text)} 字符见 {os.path.basename(self._log_path)})"
            )
        self._log(f"返回内容 : {preview}")
        self._logger.write_raw(f"返回内容(完整) : {resp.text}\n")
        self._log("=" * 60)

    # ---- 对外方法 ----
    def get(self, url, params=None, **kwargs) -> requests.Response:
        url = self._full_url(url)
        self._log_req("GET", url, params=params)
        resp = self._s.get(url, params=params, verify=VERIFY_SSL, **kwargs)
        self._log_resp(resp)
        return resp

    def post(self, url, json=None, data=None, files=None, **kwargs) -> requests.Response:
        url = self._full_url(url)
        self._log_req("POST", url, json_body=json, data=data, files=files)
        resp = self._s.post(
            url, json=json, data=data, files=files, verify=VERIFY_SSL, **kwargs
        )
        self._log_resp(resp)
        return resp

    def upload(self, url, file_path, field="file", data=None, **kwargs) -> requests.Response:
        """便捷上传单个文件（图片/文档等），自动以原文件名作为上传名。"""
        with open(file_path, "rb") as f:
            files = {field: (os.path.basename(file_path), f)}
            return self.post(url, data=data, files=files, **kwargs)


@pytest.fixture(scope="session")
def api(auth_session):
    """绑定登录态的请求客户端，供用例灵活发起请求并自行断言"""
    return ApiClient(auth_session)
