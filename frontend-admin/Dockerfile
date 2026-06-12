# ==================== 前端 Dockerfile ====================
# 颐智康养 v0.3 — React 前端（多阶段构建）

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（使用淘宝npm镜像）
COPY package.json package-lock.json* ./
RUN npm ci --silent --registry=https://registry.npmmirror.com

# 复制源码并构建
COPY . .
RUN npm run build

# ---- Stage 2: Serve with Nginx ----
FROM nginx:alpine

LABEL app="yzkang-frontend"
LABEL version="0.3.0"

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
