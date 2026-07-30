"""HTTP 请求代理接口：按前端指定的 method/url/headers/body 直接发起请求。

不处理任何登录态，用户请求什么就转发什么，仅做纯代理并返回状态码、耗时与响应体。

内网代理：通过标准环境变量 HTTP_PROXY / HTTPS_PROXY / NO_PROXY 配置。
例如在云平台环境变量中设置 HTTP_PROXY=http://proxy.company.com:8080，
容器即通过公司代理访问 beta2.vb.oa.com 等内网主机。
"""
import json
import os
from typing import Optional, List

import requests
from fastapi import APIRouter, UploadFile, File, Form

router = APIRouter(prefix="/api/http", tags=["http"])

# 默认业务接口 Host（用于相对路径）
API_HOST = "https://beta.vb.oa.com"

# 内网自签名/企业 CA 证书默认不信任，测试环境关闭校验；生产环境可开启
VERIFY_SSL = os.getenv("VERIFY_SSL", "false").lower() == "true"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)

# 按环境变量构建代理配置，requests 库原生支持 HTTP_PROXY / HTTPS_PROXY
def _build_proxies() -> dict | None:
    proxies = {}
    for scheme in ("http", "https"):
        env_val = os.getenv(f"{scheme.upper()}_PROXY") or os.getenv(f"{scheme}_proxy")
        if env_val:
            proxies[scheme] = env_val
    no_proxy = os.getenv("NO_PROXY") or os.getenv("no_proxy")
    if no_proxy:
        proxies["no_proxy"] = no_proxy
    return proxies if proxies else None

_PROXIES = _build_proxies()


@router.post("/send")
async def send_request(
    method: str = Form(...),
    url: str = Form(...),
    headers: Optional[str] = Form(None),
    body: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
):
    """代理发起 HTTP 请求，返回状态码、耗时与格式化响应体。

    用户请求什么就转发什么，不做协议改写或登录态注入。
    """
    url = url.strip()
    if url.startswith("http://") or url.startswith("https://"):
        full_url = url
    elif url.startswith("/"):
        full_url = f"{API_HOST}{url}"
    else:
        full_url = f"https://{url}"

    print(f"[http_proxy] {method.upper()} {full_url}")

    req_headers = {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Connection": "keep-alive",
    }
    if headers and headers.strip():
        try:
            req_headers.update(json.loads(headers))
        except json.JSONDecodeError as e:
            return {"error": f"Headers JSON 格式错误: {e}"}

    kwargs: dict = {"verify": VERIFY_SSL, "timeout": 15, "allow_redirects": True}
    if _PROXIES:
        kwargs["proxies"] = _PROXIES
    method = (method or "GET").upper()

    try:
        file_data = None
        if files:
            file_data = [("file", (f.filename, await f.read(), f.content_type)) for f in files]

        data_dict = None
        json_data = None
        if method not in ("GET", "HEAD") and body and body.strip():
            try:
                parsed_body = json.loads(body)
            except json.JSONDecodeError as e:
                return {"error": f"Body JSON 格式错误: {e}"}
            if file_data:
                data_dict = parsed_body
            else:
                json_data = parsed_body

        request_func = getattr(requests, method.lower(), requests.get)
        if method in ("GET", "HEAD", "OPTIONS"):
            resp = request_func(full_url, headers=req_headers, **kwargs)
        else:
            resp = request_func(
                full_url,
                json=json_data,
                data=data_dict,
                files=file_data,
                headers=req_headers,
                **kwargs,
            )

        # 调试日志：输出响应状态、大小和前 300 字符
        print(
            f"[http_proxy] RESP {resp.status_code} | "
            f"len={len(resp.content)}B | "
            f"headers={dict(resp.headers)} | "
            f"text[:300]={resp.text[:300]}"
        )

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
    except requests.exceptions.ConnectionError as e:
        print(f"[http_proxy] ERROR ConnectionError: {e}")
        return {"error": f"连接失败：无法访问目标地址 ({e})"}
    except requests.exceptions.Timeout:
        print("[http_proxy] ERROR Timeout")
        return {"error": "请求超时 (>15s)"}
    except Exception as ex:
        print(f"[http_proxy] ERROR {type(ex).__name__}: {ex}")
        return {"error": f"请求异常: {type(ex).__name__}: {ex}"}
