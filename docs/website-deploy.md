# ==================== 颐智康养官网 — 部署方案 ====================
#
# 官网结构：纯静态 SPA (index.html + style.css + main.js + sitemap.xml + robots.txt)
#
# 可选部署方式：

# ============================================================
# 方案 1: Nginx 静态托管 (推荐，完全可控)
# ============================================================
# 将官网文件放在服务器 /var/www/yzkang-website/ 目录，
# 在 Nginx 中添加以下 server block：

server {
    listen 80;
    server_name yzkang.com www.yzkang.com;
    root /var/www/yzkang-website;
    index index.html;

    # 静态资源缓存
    location ~* \.(css|js|png|jpg|svg|ico|xml|txt)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # SPA 路由 (hash 路由，所有请求返回 index.html)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
}

# ============================================================
# 方案 2: Docker + Nginx 容器化部署
# ============================================================
# 创建 Dockerfile:

FROM nginx:alpine
COPY index.html style.css main.js sitemap.xml robots.txt /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# 构建并运行：
# docker build -t yzkang-website .
# docker run -d -p 80:80 --name yzkang-website yzkang-website

# ============================================================
# 方案 3: CloudStudio / Vercel / Cloudflare Pages (零运维)
# ============================================================
# 直接上传 dist 目录或连接 Git 仓库自动部署
# - Vercel:    vercel --prod
# - Cloudflare: wrangler pages deploy dist/
# - 腾讯云 COS: 静态网站托管 + CDN 加速

# ============================================================
# 方案 4: Docker Compose 集成到现有服务
# ============================================================
# 在 docker-compose.prod.yml 中添加:

  website:
    image: nginx:alpine
    container_name: yzkang-website
    restart: unless-stopped
    volumes:
      - ./website:/usr/share/nginx/html:ro
      - ./website/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
