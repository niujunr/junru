#!/usr/bin/env python3
"""把 xAI 控制台导出的用量明细（personal-unified-usage-*.csv）汇总成每天的 token 数，写入 data/grok-usage.json。

只保存每天、每个产品的合计，不保存邮箱、用户 ID 或明细编号。
可以重复导入：同一天同一产品取较大的值，所以新旧导出的时间段重叠也没关系。

用法：python3 tools/import_grok_usage.py ~/Downloads/personal-unified-usage-2026-10-19.csv [更多文件...]
"""
import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "data", "grok-usage.json")

PRODUCT_NAMES = {"grok-bot": "Grok Bot", "grok-chat": "Grok 对话", "grok-tasks": "Grok Tasks"}


def label(row):
    # 有模型名就用模型名，没有就用产品名
    return (row.get("Model") or "").strip() or PRODUCT_NAMES.get(row["Product"], row["Product"])


def main(paths):
    days = defaultdict(lambda: defaultdict(int))
    first, last = None, None
    for path in paths:
        with open(os.path.expanduser(path), encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                try:
                    usage = json.loads(row.get("Usage") or "{}")
                    t = datetime.fromisoformat(row["Event Time"].replace("Z", "+00:00")).astimezone()
                except (ValueError, KeyError):
                    continue
                tokens = sum(int(v) for k, v in usage.items() if "token" in k.lower() and str(v).isdigit())
                if tokens <= 0:
                    continue
                day = t.strftime("%Y-%m-%d")
                days[day][label(row)] += tokens
                first = min(first or day, day)
                last = max(last or day, day)

    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        old = {}
    merged = {d: dict(r) for d, r in (old.get("days") or {}).items()}
    for d, row in days.items():
        cur = merged.setdefault(d, {})
        for k, v in row.items():
            cur[k] = max(cur.get(k, 0), v)
    if not merged:
        sys.exit("没有读到任何用量记录")
    span = sorted(merged)
    data = {
        "_说明": "由 tools/import_grok_usage.py 从 xAI 控制台导出的用量明细生成，只含每天的合计。",
        "from": min([d for d in (old.get("from"), first, span[0]) if d]),
        "to": max([d for d in (old.get("to"), last, span[-1]) if d]),
        "days": {d: merged[d] for d in span},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    total = sum(sum(r.values()) for r in merged.values())
    print(f"已写入 {OUT}：{data['from']} 到 {data['to']}，{len(merged)} 天，共 {total:,} token")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
