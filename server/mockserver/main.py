# mockserver/main.py
"""基于 FastAPI 的 Mock 服务，用于接口 mock 测试。

启动方式：
    uvicorn mockserver.main:app --reload --port 8000
或：
    python -m mockserver.main

特性：
    - 内置若干示例业务接口（/api/users、/api/items ...）
    - 支持动态注册 mock 预期：POST /__mock__/register/{path}
    - 未注册的接口自动返回 echo 响应，方便调试
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Dict
import uvicorn

app = FastAPI(title="Mock Server", version="1.0.0")

# 内存态 mock 预期：path -> {"response": ..., "status_code": ...}
_mocks: Dict[str, Dict[str, Any]] = {}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


# ---------- 示例业务 mock 接口 ----------
@app.get("/api/users")
def list_users() -> Dict[str, Any]:
    return {"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}


@app.get("/api/users/{user_id}")
def get_user(user_id: int) -> Dict[str, Any]:
    return {"id": user_id, "name": f"User-{user_id}"}


class Item(BaseModel):
    name: str
    price: float


@app.post("/api/items")
def create_item(item: Item) -> Dict[str, Any]:
    return {"id": 1, **item.model_dump()}


# ---------- 动态 mock 注册 ----------
class MockRule(BaseModel):
    response: Dict[str, Any]
    status_code: int = 200


@app.post("/__mock__/register/{path:path}")
def register_mock(path: str, rule: MockRule) -> Dict[str, str]:
    key = "/" + path.strip("/")
    _mocks[key] = {"response": rule.response, "status_code": rule.status_code}
    return {"msg": "registered", "path": key}


# ---------- 通配路由：命中已注册 mock，否则 echo ----------
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all(path: str, request: Request):
    key = "/" + path
    if key in _mocks:
        rule = _mocks[key]
        return JSONResponse(rule["response"], status_code=rule["status_code"])

    body = None
    if request.method in ("POST", "PUT", "PATCH"):
        try:
            body = await request.json()
        except Exception:
            body = None
    return JSONResponse({
        "mock": True,
        "path": key,
        "method": request.method,
        "query": dict(request.query_params),
        "body": body,
    }, status_code=200)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
