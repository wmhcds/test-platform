# ==========================================================
# 前端 Dockerfile - 多阶段构建
# 阶段 1: Node.js 构建 (Vite)
# 阶段 2: Nginx 托管静态资源 + 反向代理
# ==========================================================

# ---------- 阶段 1: 构建 ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（利用 Docker 缓存层）
COPY package.json package-lock.json ./
RUN npm ci --registry=https://mirrors.cloud.tencent.com/npm/

# 复制源码并构建
COPY . .
RUN npm run build

# ---------- 阶段 2: 运行 ----------
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
