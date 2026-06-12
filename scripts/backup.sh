#!/bin/bash
# ==================== 颐智康养 — 数据库自动备份脚本 ====================
#
# 功能：
#   1. PostgreSQL 全量备份 (pg_dump -Fc)
#   2. 保留最近 30 天备份，自动清理过期文件
#   3. MD5 校验防损坏
#   4. 支持 S3/阿里云 OSS/本地目录三种备份目标
#   5. 告警通知 (钉钉 Webhook / 企业微信)
#
# 使用方式：
#   手动:  ./backup.sh
#   定时:  crontab -e
#         0 2 * * * /opt/yzkang/scripts/backup.sh >> /var/log/yzkang-backup.log 2>&1
#
# 环境变量（在 .env 中配置）:
#   DB_USER / DB_PASSWORD / DB_NAME / DB_HOST / DB_PORT
#   BACKUP_RETENTION_DAYS=30
#   BACKUP_DIR=./backups
#
#   # S3 备份 (可选)
#   S3_ENDPOINT=https://s3.amazonaws.com
#   S3_BUCKET=yzkang-backups
#   S3_ACCESS_KEY=xxx
#   S3_SECRET_KEY=xxx
#
#   # 告警通知 (可选)
#   DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

# ── 加载环境变量 ─────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# ── 配置 ────────────────────────────────────────
DB_USER="${DB_USER:-yzkang}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-yzkang_v2}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="yzkang_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ── 日志 ─────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── 告警通知 ────────────────────────────────────
notify() {
    local level="$1" msg="$2"
    if [ -n "${DINGTALK_WEBHOOK:-}" ]; then
        curl -s -H "Content-Type: application/json" \
            -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"[颐智康养-${level}] ${msg}\"}}" \
            "$DINGTALK_WEBHOOK" > /dev/null 2>&1 || true
    fi
}

# ── 执行备份 ─────────────────────────────────────
do_backup() {
    log "📦 开始备份数据库 ${DB_NAME}..."

    mkdir -p "$BACKUP_DIR"

    # 导出数据库 (custom 格式，支持并行恢复)
    export PGPASSWORD="$DB_PASSWORD"
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -Fc \
        --no-owner \
        --no-acl \
        -f "$BACKUP_PATH" 2>&1 | tee -a "$LOG_FILE"

    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        log "❌ 备份失败: pg_dump 返回非零状态码"
        notify "ERROR" "数据库备份失败 (pg_dump error)"
        return 1
    fi

    # 备份文件大小
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log "✅ 备份完成: ${BACKUP_FILE} (${BACKUP_SIZE})"

    # MD5 校验
    md5sum "$BACKUP_PATH" > "${BACKUP_PATH}.md5"
    log "🔐 MD5: $(cat ${BACKUP_PATH}.md5 | cut -d' ' -f1)"
}

# ── 清理过期备份 ─────────────────────────────────
do_cleanup() {
    log "🧹 清理 ${RETENTION_DAYS} 天前的备份..."
    find "$BACKUP_DIR" -name "yzkang_*.dump" -mtime +"${RETENTION_DAYS}" -delete
    find "$BACKUP_DIR" -name "yzkang_*.dump.md5" -mtime +"${RETENTION_DAYS}" -delete
    log "✅ 清理完成"
}

# ── 上传到 S3 ────────────────────────────────────
do_s3_upload() {
    if [ -z "${S3_ENDPOINT:-}" ] || [ -z "${S3_BUCKET:-}" ]; then
        return 0  # S3 未配置，跳过
    fi

    log "☁️  上传到 S3: s3://${S3_BUCKET}/"
    
    # 使用 AWS CLI
    if command -v aws &>/dev/null; then
        aws s3 cp "$BACKUP_PATH" "s3://${S3_BUCKET}/$(date +%Y/%m)/${BACKUP_FILE}" \
            --endpoint-url "$S3_ENDPOINT" \
            --storage-class STANDARD_IA  # 低频存储 (成本更低)
        aws s3 cp "${BACKUP_PATH}.md5" "s3://${S3_BUCKET}/$(date +%Y/%m)/${BACKUP_FILE}.md5" \
            --endpoint-url "$S3_ENDPOINT"
        log "✅ S3 上传完成"
    else
        log "⚠️  AWS CLI 未安装，跳过 S3 上传"
    fi
}

# ── 备份列表 ─────────────────────────────────────
do_list() {
    log "📋 备份列表 (保留 ${RETENTION_DAYS} 天):"
    ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null | tail -20 || echo "  (无备份文件)"
}

# ── 恢复备份 (交互式) ────────────────────────────
do_restore() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "❌ 文件不存在: $file"
        echo "可用备份文件:"
        ls -1 "$BACKUP_DIR"/*.dump 2>/dev/null || echo "  (无)"
        exit 1
    fi

    echo "⚠️  即将恢复到数据库 ${DB_NAME} (${DB_HOST}:${DB_PORT})"
    read -p "确认? (输入 yes 继续): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "已取消"
        exit 0
    fi

    log "🔄 恢复数据库从: $file"
    export PGPASSWORD="$DB_PASSWORD"
    pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        -j 4 \
        "$file"
    log "✅ 恢复完成"
}

# ── 主入口 ───────────────────────────────────────
case "${1:-backup}" in
    backup)
        do_backup
        do_cleanup
        do_s3_upload
        log "🎉 备份流程完成"
        ;;
    list)
        do_list
        ;;
    restore)
        do_restore "${2:-}"
        ;;
    *)
        echo "用法: $0 {backup|list|restore <文件路径>}"
        exit 1
        ;;
esac
