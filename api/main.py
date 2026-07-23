"""FastAPI 后端入口：提供批次列表、详情、报告、执行测试、HTTP 代理等接口。

运行：uvicorn api.main:app --reload --port 8000
"""
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import batches, runner, http_proxy

# 确保项目根目录在 sys.path（db / utils 等模块位于根目录）
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

app = FastAPI(title="AI用例执行平台 API", version="1.0.0")

# 允许前端开发服务器（Vite 默认 5173）跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router)
app.include_router(runner.router)
app.include_router(http_proxy.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
