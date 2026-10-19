#!/usr/bin/env python3
"""统计 Claude、Codex 和 Grok 每天用了多少 token，写入 data/ai-usage.json。

数据来源（除 Grok 外都在这台 Mac 上）：
  ChatGPT       通过本机 codex 命令调用 account/usage/read，拿 OpenAI 账号的累计和每日 token 数（官方数据）
  Grok          data/grok-usage.json，由 tools/import_grok_usage.py 从 xAI 控制台导出的用量明细生成
  Claude Code   ~/.claude/projects 下的会话记录
  Claude Cowork ~/Library/Application Support/Claude/local-agent-mode-sessions 下的会话记录
  Claude 使用日  ~/Library/Application Support/Claude/plan-usage-history.json（只有额度百分比，没有 token 数）
  Codex         ~/.codex/sessions 下的逐次记录；没有逐次记录的旧对话，用 ~/.codex/state_*.sqlite
                里每个对话的总数，按它在各天的使用时长分摊到每天（标为估算）

输出只有每天的汇总数字和各模型的总数，不含文件夹名、对话标题或对话内容。
已经写进 JSON 的数字只会调高、不会调低，所以删掉会话后，那几天的数字仍然保留。

用法：python3 tools/collect_ai_usage.py
"""
import atexit
import glob
import json
import os
import re
import select
import shutil
import sqlite3
import subprocess
import tempfile
import time
from collections import defaultdict
from datetime import datetime

HOME = os.path.expanduser("~")
CLAUDE_APP = os.path.join(HOME, "Library/Application Support/Claude")
CODEX = os.path.join(HOME, ".codex")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "data", "ai-usage.json")

TOOLS = [
    {"id": "claude_code", "name": "Claude Code"},
    {"id": "cowork", "name": "Claude Cowork"},
    {"id": "codex", "name": "Codex"},
    {"id": "grok", "name": "Grok"},
    {"id": "chatgpt", "name": "ChatGPT（官方每日数据）"},
]
GROK = os.path.join(REPO, "data", "grok-usage.json")


def day_from_iso(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d")


def day_from_epoch(t):
    return datetime.fromtimestamp(t / 1000 if t > 1e11 else t).strftime("%Y-%m-%d")


def read_lines(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            yield from fh
    except OSError:
        return


# ---------- Claude ----------

def claude_model(model):
    # claude-opus-5-5 → Opus 5.5，claude-fable-5 → Fable 5
    m = re.match(r"claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:-\d{8})?$", model)
    if not m:
        return model
    return f"{m.group(1).capitalize()} {m.group(2)}" + (f".{m.group(3)}" if m.group(3) else "")


def collect_claude(days, models):
    files = [(f, "claude_code") for f in glob.glob(os.path.join(HOME, ".claude/projects/**/*.jsonl"), recursive=True)]
    files += [(f, "cowork") for f in glob.glob(
        os.path.join(CLAUDE_APP, "local-agent-mode-sessions/**/.claude/projects/**/*.jsonl"), recursive=True)]
    # 一条回复会按内容块拆成多行写入，每行带同一份用量，按 message.id + requestId 去重
    replies = {}
    for path, tool in files:
        for line in read_lines(path):
            if '"usage"' not in line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                continue
            m = o.get("message") or {}
            u = m.get("usage")
            if o.get("type") != "assistant" or not u or not o.get("timestamp"):
                continue
            model = m.get("model") or "unknown"
            if model == "<synthetic>":
                continue
            total = sum(u.get(k) or 0 for k in (
                "input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
            replies[(m.get("id"), o.get("requestId"))] = (tool, day_from_iso(o["timestamp"]), claude_model(model), total)
    for tool, day, model, total in replies.values():
        days[day][tool] += total
        models[(tool, model)] += total


def claude_seen_days():
    """额度采样里 5 小时额度大于 0 的日子：那天用过 Claude，但可能已经没有会话记录。"""
    try:
        samples = json.load(open(os.path.join(CLAUDE_APP, "plan-usage-history.json"))).get("samples", [])
    except (OSError, ValueError):
        return set()
    return {day_from_epoch(s["t"]) for s in samples if ((s.get("u") or {}).get("fh") or 0) > 0}


# ---------- Codex ----------

def latest_db(pattern):
    found = glob.glob(os.path.join(CODEX, pattern))
    num = lambda p: int(re.search(r"_(\d+)\.sqlite$", p).group(1)) if re.search(r"_(\d+)\.sqlite$", p) else -1
    return max(found, key=num) if found else None


def open_ro(path):
    # Codex 正在运行时，只读打开可能因为需要建 -shm 文件而失败；那就复制一份到临时文件夹再读
    try:
        con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        con.execute("select 1 from sqlite_master limit 1")
        return con
    except sqlite3.Error:
        tmp = tempfile.mkdtemp(prefix="ai-usage-")
        atexit.register(shutil.rmtree, tmp, True)
        for suffix in ("", "-wal", "-shm"):
            if os.path.exists(path + suffix):
                shutil.copy2(path + suffix, os.path.join(tmp, os.path.basename(path) + suffix))
        return sqlite3.connect(os.path.join(tmp, os.path.basename(path)))


def collect_codex(days, models, estimated):
    # 有逐次记录的对话：total_token_usage 是累计值，按相邻两次的差值记到当天
    exact = set()
    files = glob.glob(os.path.join(CODEX, "sessions/**/*.jsonl"), recursive=True)
    files += glob.glob(os.path.join(CODEX, "archived_sessions/**/*.jsonl"), recursive=True)
    for path in files:
        thread_id, model, prev = None, None, None
        for line in read_lines(path):
            if '"token_count"' not in line and '"session_meta"' not in line and '"turn_context"' not in line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                continue
            p = o.get("payload") or {}
            if o.get("type") == "session_meta":
                thread_id = thread_id or p.get("id")
            elif o.get("type") == "turn_context":
                model = p.get("model") or model
            elif p.get("type") == "token_count" and p.get("info") and o.get("timestamp"):
                total = (p["info"].get("total_token_usage") or {}).get("total_tokens")
                if total is None:
                    continue
                # 累计值变小说明上下文被重置，从新的累计值重新算
                inc = total - prev if prev is not None and total >= prev else total
                prev = total
                if inc > 0:
                    days[day_from_iso(o["timestamp"])]["codex"] += inc
                    models[("codex", model or "unknown")] += inc
        if thread_id:
            exact.add(thread_id)

    # 没有逐次记录的对话：只有每个对话的总数，按各天的使用时长分摊
    state = latest_db("state_*.sqlite")
    if not state:
        return
    weights = defaultdict(lambda: defaultdict(float))
    history = latest_db("thread_history_*.sqlite")
    if history:
        try:
            for tid, started, dur in open_ro(history).execute(
                    "select thread_id, started_at, duration_ms from thread_turns"):
                if started:
                    weights[tid][day_from_epoch(started)] += max(dur or 0, 1000)
        except sqlite3.Error:
            pass
    try:
        rows = open_ro(state).execute("select id, created_at, tokens_used, model from threads").fetchall()
    except sqlite3.Error:
        return
    for tid, created, tokens, model in rows:
        if tid in exact or not tokens:
            continue
        w = weights.get(tid) or {day_from_epoch(created): 1.0}
        s = sum(w.values())
        for day, x in w.items():
            days[day]["codex"] += tokens * x / s
            estimated.add(day)
        models[("codex", model or "unknown")] += tokens


# ---------- ChatGPT 官方数据 ----------

def read_chatgpt_official(timeout=120):
    """通过本机 codex 命令的 app-server 调用 account/usage/read，拿账号的累计和每日 token 数。

    登录由 codex 自己处理，这里不读取任何凭据。返回 None 表示这次没拿到（没装 codex、没登录或超时）。
    """
    exe = shutil.which("codex") or "/opt/homebrew/bin/codex"
    if not os.path.exists(exe):
        return None
    try:
        proc = subprocess.Popen([exe, "app-server"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, text=True)
    except OSError:
        return None

    def send(msg):
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()

    def wait_for(msg_id, deadline):
        while time.time() < deadline:
            ready, _, _ = select.select([proc.stdout], [], [], 1)
            if not ready:
                continue
            line = proc.stdout.readline()
            if not line:
                return None
            try:
                msg = json.loads(line)
            except ValueError:
                continue
            if msg.get("id") == msg_id:
                return msg
        return None

    try:
        deadline = time.time() + timeout
        send({"id": 0, "method": "initialize",
              "params": {"clientInfo": {"name": "junru_ai_usage", "title": "AI usage page", "version": "1.0.0"}}})
        if not wait_for(0, deadline):
            return None
        send({"method": "initialized"})
        send({"id": 1, "method": "account/usage/read"})
        res = wait_for(1, deadline)
    except (OSError, ValueError):
        res = None
    finally:
        proc.terminate()
    if not res or "result" not in res:
        return None
    return res["result"]


def collect_chatgpt(days):
    usage = read_chatgpt_official()
    if not usage:
        return None
    for b in usage.get("dailyUsageBuckets") or []:
        if b.get("startDate") and b.get("tokens"):
            days[b["startDate"][:10]]["chatgpt"] += b["tokens"]
    s = usage.get("summary") or {}
    return {
        "lifetime": s.get("lifetimeTokens"),
        "asOf": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %z"),
        "currentStreakDays": s.get("currentStreakDays"),
        "peakDailyTokens": s.get("peakDailyTokens"),
    }


# ---------- Grok ----------

def collect_grok(days, models):
    """Grok 没有本地记录，读 tools/import_grok_usage.py 从 xAI 导出明细生成的每日合计。"""
    try:
        grok = json.load(open(GROK, encoding="utf-8"))
    except (OSError, ValueError):
        return None
    for day, row in (grok.get("days") or {}).items():
        for name, tokens in row.items():
            days[day]["grok"] += tokens
            models[("grok", name)] += tokens
    return {"from": grok.get("from"), "to": grok.get("to")}


# ---------- 合并与输出 ----------

def main():
    days = defaultdict(lambda: defaultdict(float))
    models = defaultdict(float)
    estimated = set()
    collect_claude(days, models)
    collect_codex(days, models, estimated)
    grok_range = collect_grok(days, models)
    chatgpt = collect_chatgpt(days)

    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        old = {}

    merged = {d: dict(r) for d, r in (old.get("days") or {}).items()}
    for d, row in days.items():
        cur = merged.setdefault(d, {})
        for tool, v in row.items():
            v = round(v)
            if v > cur.get(tool, 0):
                cur[tool] = v
    merged = {d: r for d, r in merged.items() if any(r.values())}

    old_models = {(m["tool"], m["name"]): m["tokens"] for m in old.get("models") or []}
    for k, v in models.items():
        old_models[k] = max(old_models.get(k, 0), round(v))

    seen = (set(old.get("seen") or []) | claude_seen_days()) - set(merged)
    est = (set(old.get("estimated") or []) | estimated) & set(merged)
    all_days = sorted(set(merged) | seen)

    data = {
        "updated": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %z"),
        "first": all_days[0] if all_days else None,
        "tools": TOOLS,
        "grok_range": grok_range or old.get("grok_range"),
        # 这次没拿到官方数据时，沿用上一次的
        "chatgpt": chatgpt or old.get("chatgpt"),
        "days": {d: merged[d] for d in sorted(merged)},
        "estimated": sorted(est),
        "seen": sorted(seen),
        "models": sorted(({"tool": t, "name": n, "tokens": v} for (t, n), v in old_models.items() if v > 0),
                         key=lambda m: -m["tokens"]),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    # ChatGPT 有官方每日数据的日子，本机的 Codex 记录已经包含在里面，不重复加
    total = sum(sum(v for k, v in r.items() if not (k == "codex" and "chatgpt" in r)) for r in merged.values())
    print(f"已写入 {OUT}：{len(merged)} 天有 token 记录，累计 {total:,} token")


if __name__ == "__main__":
    main()
