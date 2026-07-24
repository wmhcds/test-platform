# ==========================================================
# 多阶段构建：前端编译 → 后端运行
# 构建: docker build -t test-platform .
# 运行: docker run -p 8000:8000 test-platform
# ==========================================================

# ---- Stage 1: 构建前端（Node） ----
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---- Stage 2: 运行后端（Python） ----
FROM python:3.11-slim AS backend
WORKDIR /app

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    -i https://mirrors.cloud.tencent.com/pypi/simple/

# 后端代码
COPY server/ .

# 前端构建产物（从 Stage 1 复制）
COPY --from=frontend /frontend/dist /app/web/dist/

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
