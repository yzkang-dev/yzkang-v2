# ==================== 颐智康养 — 数据库备份 (Windows PowerShell) ====================
#
# 使用方式：
#   手动:  .\scripts\backup.ps1
#   定时:  schtasks /Create /TN "YzkangBackup" /TR "powershell.exe -File E:\嘟嘟工作区\颐智康养-v2\scripts\backup.ps1" /SC DAILY /ST 02:00
#
# 前置条件：
#   PostgreSQL pg_dump 在 PATH 中 (或设置 $PG_DUMP_PATH)

param(
    [string]$Action = "backup",
    [string]$RestoreFile = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectDir "backups"

# ── 配置 ─────────────────────────────────────────
$DB_USER     = if ($env:DB_USER)     { $env:DB_USER }     else { "yzkang" }
$DB_NAME     = if ($env:DB_NAME)     { $env:DB_NAME }     else { "yzkang_v2" }
$DB_HOST     = if ($env:DB_HOST)     { $env:DB_HOST }     else { "localhost" }
$DB_PORT     = if ($env:DB_PORT)     { $env:DB_PORT }     else { "5432" }
$RETENTION   = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 30 }

# PostgreSQL 二进制路径 (如果不在 PATH 中则设置)
$PG_DUMP_PATH = if (Test-Path "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe") {
    "C:\Program Files\PostgreSQL\16\bin\"
} elseif (Test-Path "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe") {
    "C:\Program Files\PostgreSQL\15\bin\"
} else {
    ""
}

$PG_DUMP    = Join-Path $PG_DUMP_PATH "pg_dump.exe"
$PG_RESTORE = Join-Path $PG_DUMP_PATH "pg_restore.exe"

# ── 日志 ─────────────────────────────────────────
$LogFile = Join-Path $BackupDir "backup.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}

# ── 备份 ─────────────────────────────────────────
function Backup-Database {
    Write-Log "📦 开始备份数据库 ${DB_NAME}..."

    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $fileName = "yzkang_${timestamp}.dump"
    $filePath = Join-Path $BackupDir $fileName

    $env:PGPASSWORD = $env:DB_PASSWORD

    $args = @(
        "-h", $DB_HOST,
        "-p", $DB_PORT,
        "-U", $DB_USER,
        "-d", $DB_NAME,
        "-Fc",
        "--no-owner",
        "--no-acl",
        "-f", $filePath
    )

    & $PG_DUMP $args 2>&1 | ForEach-Object { Write-Log $_ }

    if ($LASTEXITCODE -ne 0) {
        Write-Log "❌ 备份失败: pg_dump 退出码 $LASTEXITCODE"
        return $false
    }

    $fileSize = (Get-Item $filePath).Length
    $sizeMB = [math]::Round($fileSize / 1MB, 2)
    Write-Log "✅ 备份完成: ${fileName} (${sizeMB} MB)"

    # MD5 校验
    $hash = (Get-FileHash -Path $filePath -Algorithm MD5).Hash
    $hash | Out-File -FilePath "${filePath}.md5" -Encoding ASCII
    Write-Log "🔐 MD5: $hash"

    return $true
}

# ── 清理过期备份 ─────────────────────────────────
function Remove-ExpiredBackups {
    Write-Log "🧹 清理 ${RETENTION} 天前的备份..."
    $cutoff = (Get-Date).AddDays(-$RETENTION)

    Get-ChildItem -Path $BackupDir -Filter "yzkang_*.dump" | Where-Object {
        $_.LastWriteTime -lt $cutoff
    } | ForEach-Object {
        Write-Log "  删除: $($_.Name)"
        Remove-Item $_.FullName -Force
        $md5File = "$($_.FullName).md5"
        if (Test-Path $md5File) { Remove-Item $md5File -Force }
    }
    Write-Log "✅ 清理完成"
}

# ── 备份列表 ─────────────────────────────────────
function Show-BackupList {
    Write-Log "📋 备份列表 (最近 20 个):"
    Get-ChildItem -Path $BackupDir -Filter "yzkang_*.dump" | 
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 20 |
        ForEach-Object {
            $sizeMB = [math]::Round($_.Length / 1MB, 2)
            Write-Log "  $($_.Name) - $($_.LastWriteTime) - ${sizeMB}MB"
        }
}

# ── 恢复备份 ─────────────────────────────────────
function Restore-Database {
    param([string]$File)

    if (-not (Test-Path $File)) {
        Write-Host "❌ 文件不存在: $File"
        Show-BackupList
        return
    }

    Write-Host "⚠️  即将恢复到数据库 ${DB_NAME} (${DB_HOST}:${DB_PORT})"
    $confirm = Read-Host "确认? (输入 yes 继续)"
    if ($confirm -ne "yes") {
        Write-Host "已取消"
        return
    }

    Write-Log "🔄 恢复数据库从: $File"
    $env:PGPASSWORD = $env:DB_PASSWORD

    $args = @(
        "-h", $DB_HOST,
        "-p", $DB_PORT,
        "-U", $DB_USER,
        "-d", $DB_NAME,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "-j", "4",
        $File
    )

    & $PG_RESTORE $args
    Write-Log "✅ 恢复完成"
}

# ── 主入口 ───────────────────────────────────────
try {
    switch ($Action) {
        "backup" {
            $result = Backup-Database
            if ($result) {
                Remove-ExpiredBackups
                Write-Log "🎉 备份流程完成"
            }
        }
        "list" {
            Show-BackupList
        }
        "restore" {
            if ($RestoreFile) {
                Restore-Database -File $RestoreFile
            } else {
                Write-Host "用法: .\backup.ps1 -Action restore -RestoreFile <文件路径>"
            }
        }
        default {
            Write-Host "用法: .\backup.ps1 -Action {backup|list|restore} [-RestoreFile <路径>]"
        }
    }
} catch {
    Write-Log "❌ 错误: $_"
    exit 1
}
