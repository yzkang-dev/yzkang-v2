#!/usr/bin/env python3
"""
颐智康养 — 日志分析工具

功能：
  1. 统计错误率 / QPS / 慢请求
  2. 按状态码/端点/时间段聚合
  3. 输出 JSON 报告 / 终端表格

用法：
  python scripts/analyze_logs.py                           # 分析今天的日志
  python scripts/analyze_logs.py --days 7                   # 最近 7 天
  python scripts/analyze_logs.py --format json              # JSON 输出
  python scripts/analyze_logs.py --errors-only              # 只看错误
"""

import argparse
import json
import gzip
import re
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, date
from collections import defaultdict, Counter

LOG_DIR = Path(__file__).parent.parent / "backend" / "logs"
REQUEST_PATTERN = re.compile(r'"method":\s*"(\w+)".*?"path":\s*"([^"]+)".*?"status_code":\s*(\d+)')


def parse_log_line(line: str) -> dict | None:
    """解析 JSON 格式日志行"""
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def extract_request_info(record: dict) -> dict | None:
    """从日志 record 中提取请求信息"""
    msg = record.get("text", "")
    match = REQUEST_PATTERN.search(msg)
    if match:
        return {
            "method": match.group(1),
            "path": match.group(2),
            "status": int(match.group(3)),
            "time": record.get("record", {}).get("time", {}).get("repr", ""),
        }
    return None


def load_logs(days: int = 1) -> list[dict]:
    """加载指定天数的日志"""
    records = []
    for d in range(days):
        log_date = date.today() - timedelta(days=d)
        date_str = log_date.strftime("%Y-%m-%d")

        for pattern in [f"app_{date_str}.json.gz", f"app_{date_str}.json"]:
            log_file = LOG_DIR / pattern
            if not log_file.exists():
                continue

            opener = gzip.open if log_file.suffix == ".gz" else open
            with opener(log_file, "rt", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    rec = parse_log_line(line)
                    if rec:
                        records.append(rec)
    return records


def analyze(records: list[dict], errors_only: bool = False) -> dict:
    """分析日志并返回统计结果"""
    total = len(records)
    errors = [r for r in records if r.get("record", {}).get("level", {}).get("name") == "ERROR"]
    warnings = [r for r in records if r.get("record", {}).get("level", {}).get("name") == "WARNING"]

    # 状态码统计
    status_counter = Counter()
    endpoint_counter = Counter()
    requests_by_hour = Counter()

    for rec in records:
        info = extract_request_info(rec)
        if info:
            status_counter[info["status"]] += 1
            # 简化路径 (去掉 ID)
            simple_path = re.sub(r"/\d+", "/:id", info["path"])
            endpoint_counter[simple_path] += 1
            if info["time"]:
                try:
                    hour = info["time"][11:13]  # 提取小时
                    requests_by_hour[hour] += 1
                except IndexError:
                    pass

    return {
        "total_lines": total,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "error_rate": f"{len(errors)/total*100:.2f}%" if total > 0 else "0%",
        "status_distribution": dict(status_counter.most_common()),
        "top_endpoints": dict(endpoint_counter.most_common(10)),
        "requests_by_hour": dict(sorted(requests_by_hour.items())),
        "recent_errors": [
            {"time": r.get("record", {}).get("time", {}).get("repr", ""),
             "message": r.get("text", "")[:200]}
            for r in errors[-10:]
        ] if errors_only or errors else None,
    }


def print_report(stats: dict):
    """终端表格输出"""
    print("=" * 60)
    print("  颐智康养 — 日志分析报告")
    print("=" * 60)

    print(f"\n📊 总览")
    print(f"  日志总量: {stats['total_lines']:,}")
    print(f"  错误数:   {stats['error_count']} ({stats['error_rate']})")
    print(f"  警告数:   {stats['warning_count']}")

    if stats.get("status_distribution"):
        print(f"\n📈 HTTP 状态码分布")
        for code, count in sorted(stats["status_distribution"].items()):
            bar = "█" * min(count // max(1, max(stats["status_distribution"].values()) // 20), 40)
            print(f"  {code}: {count:>6}  {bar}")

    if stats.get("top_endpoints"):
        print(f"\n🔝 请求最多端点 (Top 10)")
        for i, (path, count) in enumerate(stats["top_endpoints"].items(), 1):
            print(f"  {i:>2}. {path:45s} {count:>5}")

    if stats.get("requests_by_hour"):
        print(f"\n🕐 每小时请求分布")
        hours = stats["requests_by_hour"]
        max_req = max(hours.values()) if hours else 1
        for hour, count in sorted(hours.items()):
            bar = "█" * min(count // max(1, max_req // 20), 40)
            print(f"  {hour}:00  {count:>5}  {bar}")

    if stats.get("recent_errors"):
        print(f"\n🐛 最近错误")
        for err in stats["recent_errors"]:
            print(f"  [{err['time']}] {err['message']}")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="颐智康养日志分析工具")
    parser.add_argument("--days", type=int, default=1, help="分析天数 (默认: 1)")
    parser.add_argument("--format", choices=["table", "json"], default="table", help="输出格式")
    parser.add_argument("--errors-only", action="store_true", help="只看错误")
    parser.add_argument("--log-dir", type=str, help="日志目录 (默认: backend/logs/)")
    args = parser.parse_args()

    log_dir = Path(args.log_dir) if args.log_dir else LOG_DIR
    if not log_dir.exists():
        print(f"❌ 日志目录不存在: {log_dir}")
        sys.exit(1)

    # 全局变量覆盖
    global LOG_DIR
    LOG_DIR = log_dir

    records = load_logs(args.days)
    if not records:
        print(f"❌ 没有找到日志 (days={args.days})")
        sys.exit(1)

    stats = analyze(records, errors_only=args.errors_only)

    if args.format == "json":
        print(json.dumps(stats, ensure_ascii=False, indent=2))
    else:
        print_report(stats)


if __name__ == "__main__":
    main()
