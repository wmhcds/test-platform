# ==========================================================
# 后端 Dockerfile - FastAPI 服务
# 构建: docker build -t test-platform-server .
# 运行: docker run -p 8000:8000 test-platform-server
# ==========================================================
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.cloud.tencent.com/pypi/simple/

# 复制后端代码
COPY . .

# 创建数据目录（数据库文件持久化）
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8000

# 启动命令
# 使用 uvicorn 生产模式运行，--host 0.0.0.0 允许外部访问
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
