#!/bin/bash
# ==================== 颐智康养 — 生产部署脚本 ====================
#
# 用法：
#   ./deploy.sh          → 拉取最新镜像并重启服务
#   ./deploy.sh backup   → 备份数据库
#   ./deploy.sh update   → 更新 + 运行数据库迁移
#   ./deploy.sh status   → 查看服务状态
#   ./deploy.sh logs     → 查看后端日志 (最后 100 行)
#   ./deploy.sh health   → 健康检查
#
# 前置条件：
#   1. Docker + Docker Compose 已安装
#   2. GHCR 镜像已推送 (ci.yml 自动完成)
#   3. .env 文件已配置

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
DEPLOY_LOG="${SCRIPT_DIR}/deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$DEPLOY_LOG"
}

# ── 检查前置条件 ─────────────────────────────────
check_prereqs() {
    if ! command -v docker &>/dev/null; then
        echo "❌ 请先安装 Docker" && exit 1
    fi
    if ! docker compose version &>/dev/null; then
        echo "❌ 请安装 Docker Compose v2+" && exit 1
    fi
    if [ ! -f ".env" ]; then
        echo "❌ 缺少 .env 文件，请从 .env.example 复制并填写" && exit 1
    fi
    source .env
}

# ── 备份数据库 ────────────────────────────────────
do_backup() {
    log "📦 开始备份数据库..."
    mkdir -p backups

    BACKUP_FILE="backups/yzkang_$(date +%Y%m%d_%H%M%S).sql.gz"
    docker compose -f "$COMPOSE_FILE" exec -T db \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "$BACKUP_FILE"

    log "✅ 备份完成: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

    # 删除 30 天前的备份
    find backups/ -name "yzkang_*.sql.gz" -mtime +30 -delete
    log "🧹 已清理过期备份"
}

# ── 健康检查 ──────────────────────────────────────
do_health() {
    log "🩺 健康检查..."

    # 后端健康检查
    BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health 2>/dev/null || echo "000")
    if [ "$BACKEND_HEALTH" = "200" ]; then
        log "  ✅ 后端: 正常"
    else
        log "  ❌ 后端: HTTP $BACKEND_HEALTH"
    fi

    # 前端
    FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ 2>/dev/null || echo "000")
    if [ "$FRONTEND_HEALTH" = "200" ]; then
        log "  ✅ 前端: 正常"
    else
        log "  ❌ 前端: HTTP $FRONTEND_HEALTH"
    fi

    # Grafana
    GRAFANA_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
    if [ "$GRAFANA_HEALTH" = "200" ]; then
        log "  ✅ Grafana: 正常"
    else
        log "  ⚠️  Grafana: HTTP $GRAFANA_HEALTH"
    fi
}

# ── 查看状态 ──────────────────────────────────────
do_status() {
    log "📊 服务状态..."
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    log "💾 磁盘使用..."
    df -h / | tail -1
    echo ""
    log "📦 数据卷大小..."
    docker system df -v 2>/dev/null | head -20
}

# ── 查看日志 ──────────────────────────────────────
do_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100 backend
}

# ── 更新部署 ──────────────────────────────────────
do_update() {
    log "🔄 开始更新部署..."

    # 拉取最新镜像
    docker compose -f "$COMPOSE_FILE" pull

    # 重启服务
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

    # 等待后端就绪
    log "⏳ 等待后端就绪..."
    for i in $(seq 1 30); do
        if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
            break
        fi
        if [ "$i" -eq 30 ]; then
            log "❌ 后端启动超时" && exit 1
        fi
        sleep 2
    done

    # 清理旧镜像
    docker image prune -f

    log "✅ 更新完成"
    do_health
}

# ── 主入口 ────────────────────────────────────────
check_prereqs

case "${1:-update}" in
    backup)
        do_backup
        ;;
    update)
        do_backup
        do_update
        do_health
        ;;
    status)
        do_status
        ;;
    logs)
        do_logs
        ;;
    health)
        do_health
        ;;
    *)
        echo "用法: $0 {update|backup|status|logs|health}"
        echo "  update — 备份 + 更新 + 健康检查 (默认)"
        echo "  backup — 仅备份数据库"
        echo "  status — 查看服务状态"
        echo "  logs   — 查看后端日志"
        echo "  health — 健康检查"
        exit 1
        ;;
esac
