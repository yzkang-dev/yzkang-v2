#!/bin/bash
# ==================== 颐智康养 — SSL 证书一键配置脚本 ====================
#
# 使用前确保：
#   1. 域名已解析到服务器 IP
#   2. 80 端口可访问 (Let's Encrypt 验证用)
#   3. Nginx 80 server block 已配置 (见 nginx.conf)
#
# 用法：
#   chmod +x scripts/setup-ssl.sh
#   sudo ./scripts/setup-ssl.sh yzkang.com www.yzkang.com

set -euo pipefail

DOMAIN="${1:-}"
ALTDOMAINS="${2:-}"

if [ -z "$DOMAIN" ]; then
    echo "用法: $0 <主域名> [附加域名]"
    echo "示例: $0 yzkang.com www.yzkang.com"
    exit 1
fi

# ── 安装 certbot ────────────────────────────────
echo "📦 安装 certbot..."
if command -v apt &>/dev/null; then
    apt update && apt install -y certbot python3-certbot-nginx
elif command -v yum &>/dev/null; then
    yum install -y certbot python3-certbot-nginx
elif command -v brew &>/dev/null; then
    brew install certbot
fi

# ── 申请证书 ───────────────────────────────────
echo "🔒 申请 SSL 证书: $DOMAIN"
CERT_CMD="certbot certonly --standalone --agree-tos --non-interactive"

if [ -n "$ALTDOMAINS" ]; then
    CERT_CMD="$CERT_CMD -d $DOMAIN -d $ALTDOMAINS"
else
    CERT_CMD="$CERT_CMD -d $DOMAIN"
fi

$CERT_CMD

# ── 证书路径 ───────────────────────────────────
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
echo ""
echo "✅ SSL 证书申请成功！"
echo "   公钥: ${CERT_PATH}/fullchain.pem"
echo "   私钥: ${CERT_PATH}/privkey.pem"
echo ""
echo "📅 证书 90 天后到期，已配置自动续期："
echo "   certbot renew --dry-run  # 测试续期"
echo "   systemctl status certbot.timer  # 检查定时任务"
echo ""
echo "🔧 下一步："
echo "   1. 将证书路径挂载到 Docker 容器"
echo "   2. 重新加载 Nginx: docker compose exec frontend nginx -s reload"
echo "   3. 验证: https://${DOMAIN}"

# ── 自动续期 ───────────────────────────────────
echo ""
echo "📅 配置自动续期 cron..."
echo "0 3 * * * root certbot renew --quiet --post-hook 'docker compose -f /opt/yzkang/docker-compose.prod.yml exec frontend nginx -s reload'" > /etc/cron.d/certbot-renew
