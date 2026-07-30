"""HTTP 请求代理接口：按前端指定的 method/url/headers/body 直接发起请求。

不处理任何登录态，用户请求什么就转发什么，仅做纯代理并返回状态码、耗时与响应体。
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


@router.post("/send")
async def send_request(
    method: str = Form(...),
    url: str = Form(...),
    headers: Optional[str] = Form(None),
    body: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
):
    """代理发起 HTTP 请求，返回状态码、耗时与格式化响应体。

    协议处理：用户输入 http:// 与 https:// 等价，统一按 https 转发。
    原因是内网环境 HTTP 通道常被拦截（返回 404 空 body），而用户期望请求的是
    同一资源，协议差异不影响业务语义。
    """
    url = url.strip()
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
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

    kwargs = {"verify": VERIFY_SSL, "timeout": 15, "allow_redirects": True}
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
    except requests.exceptions.ConnectionError:
        return {"error": "连接失败：无法访问目标地址"}
    except requests.exceptions.Timeout:
        return {"error": "请求超时 (>15s)"}
    except Exception as ex:
        return {"error": f"请求异常: {ex}"}