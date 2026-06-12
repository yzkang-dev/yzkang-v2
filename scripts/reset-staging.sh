#!/bin/bash
# ==================== 颐智康养 — 演示环境数据重置脚本 ====================
#
# 每日凌晨 3 点自动重置演示环境数据库
# crontab: 0 3 * * * /opt/yzkang/scripts/reset-staging.sh >> /var/log/yzkang-staging-reset.log

set -euo pipefail

COMPOSE_FILE="/opt/yzkang/docker-compose.staging.yml"
BACKUP_DIR="/opt/yzkang/staging-backups"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "🔄 开始重置演示环境..."

# 1. 备份当前数据库
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/staging_before_reset_${TIMESTAMP}.sql.gz"
docker compose -f "$COMPOSE_FILE" exec -T db-staging \
    pg_dump -U yzkang_demo -d yzkang_demo | gzip > "$BACKUP_FILE"
log "📦 备份完成: $BACKUP_FILE"

# 2. 删除并重建数据库
docker compose -f "$COMPOSE_FILE" exec -T db-staging \
    psql -U yzkang_demo -d postgres -c "DROP DATABASE IF EXISTS yzkang_demo;"
docker compose -f "$COMPOSE_FILE" exec -T db-staging \
    psql -U yzkang_demo -d postgres -c "CREATE DATABASE yzkang_demo OWNER yzkang_demo;"

# 3. 重启后端 (自动执行 init_db 种子数据)
docker compose -f "$COMPOSE_FILE" down backend-staging frontend-staging
docker compose -f "$COMPOSE_FILE" up -d backend-staging frontend-staging

# 4. 等待后端就绪
log "⏳ 等待后端就绪..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

log "✅ 演示环境重置完成"
