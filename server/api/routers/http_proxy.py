"""HTTP 请求代理接口：根据 login_type 选择登录方式，向后端业务接口发请求。

前端把 method/url/login_type/headers/body/files 发到本接口，本接口按
login_type 选择对应登录方式拿到已登录的 requests.Session，实际发起请求，
再把响应返回给前端展示。
"""
import json
from typing import Optional, List, Dict

import requests
from fastapi import APIRouter, UploadFile, File, Form

router = APIRouter(prefix="/api/http", tags=["http"])

# 登录/请求配置统一从 login_providers 获取（其内部已负责 tests 路径与 auth 导入）
from api.login_providers import (  # noqa: E402
    get_provider,
    DEFAULT_LOGIN_TYPE,
    API_HOST,
    VERIFY_SSL,
    UA,
)

# 按登录方式分别缓存 session（不同系统互不影响）
_sessions: Dict[str, requests.Session] = {}


def get_session(login_type: str) -> requests.Session:
    key = (login_type or DEFAULT_LOGIN_TYPE).upper()
    if key not in _sessions:
        _sessions[key] = get_provider(key).get_session()
    return _sessions[key]


def reset_session(login_type: str) -> requests.Session:
    """丢弃旧 session 并重新登录，用于 token 过期时自动刷新"""
    key = (login_type or DEFAULT_LOGIN_TYPE).upper()
    _sessions[key] = get_provider(key).get_session()
    return _sessions[key]


_MAX_RETRIES = 1


@router.post("/send")
async def send_request(
    method: str = Form(...),
    url: str = Form(...),
    login_type: str = Form(DEFAULT_LOGIN_TYPE),
    headers: Optional[str] = Form(None),
    body: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
):
    """代理发起 HTTP 请求，返回状态码、耗时与格式化响应体。"""
    # 统一 URL：用户可能输入 http://，但内网业务接口要求 https（cookie Secure 标记）
    if url.startswith("http://"):
        full_url = url.replace("http://", "https://", 1)
    elif url.startswith("https://"):
        full_url = url
    else:
        full_url = f"{API_HOST}{url}"

    print(f"[http_proxy] [{login_type}] {method} {full_url}")

    req_headers = {"User-Agent": UA}
    if headers and headers.strip():
        try:
            req_headers.update(json.loads(headers))
        except json.JSONDecodeError as e:
            return {"error": f"Headers JSON 格式错误: {e}"}

    kwargs = {"verify": VERIFY_SSL, "timeout": 15}
    method = (method or "GET").upper()

    try:
        # 文件内容在循环外一次性读取，避免重试时已被消费
        file_data = None
        if files:
            file_data = [("file", (f.filename, await f.read(), f.content_type)) for f in files]

        data_dict = None
        json_data = None
        if method != "GET" and body and body.strip():
            try:
                parsed_body = json.loads(body)
            except json.JSONDecodeError as e:
                return {"error": f"Body JSON 格式错误: {e}"}
            if file_data:
                data_dict = parsed_body
            else:
                json_data = parsed_body

        # 是否匿名请求：login_type 为空时不使用登录态 session，直接访问目标地址
        is_anonymous = not login_type or not login_type.strip()

        if is_anonymous:
            if method == "GET":
                resp = requests.get(full_url, headers=req_headers, **kwargs)
            else:
                resp = requests.post(
                    full_url, json=json_data, data=data_dict,
                    files=file_data, headers=req_headers, **kwargs
                )
        else:
            for attempt in range(_MAX_RETRIES + 1):
                session = get_session(login_type)

                if method == "GET":
                    resp = session.get(full_url, headers=req_headers, **kwargs)
                else:
                    resp = session.post(
                        full_url, json=json_data, data=data_dict,
                        files=file_data, headers=req_headers, **kwargs
                    )

                # 401 → 登录态过期，重新登录后重试一次（仅重试 1 次）
                if resp.status_code == 401 and attempt < _MAX_RETRIES:
                    print("[http_proxy] 检测到 401，自动重新登录并重试...")
                    reset_session(login_type)
                    continue

                break

        try:
            text = json.dumps(resp.json(), ensure_ascii=False, indent=2)
        except Exception:
            text = resp.text[:20000]

        return {
            "status_code": resp.status_code,
            "elapsed_ms": int(resp.elapsed.total_seconds() * 1000),
            "size": len(resp.content),
            "body": text,
        }
    except requests.exceptions.ConnectionError:
        return {"error": "连接失败：无法访问目标地址"}
    except requests.exceptions.Timeout:
        return {"error": "请求超时 (>15s)"}
    except Exception as ex:
        return {"error": f"请求异常: {ex}"}
