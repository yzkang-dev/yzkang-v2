# ==================== 后端 Dockerfile ====================
# 颐智康养 v0.3 — FastAPI 后端容器

FROM python:3.13-slim

LABEL app="yzkang-backend"
LABEL version="0.3.0"

# 设置工作目录
WORKDIR /app

# 安装系统依赖（psutil 需要 gcc）
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令（通过环境变量控制数据库类型）
CMD ["sh", "-c", "python -c 'from models import init_db; init_db()' && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4"]
