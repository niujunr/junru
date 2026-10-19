#!/bin/zsh
# 由 launchd 每天运行：重新统计 AI 用量，有变化就提交并推送到 main，GitHub Pages 随之更新。
#
# 这个脚本在一个只给自动更新用的副本里运行（~/.ai-usage/junru），不是平时编辑网站的那份。
# 每次运行前都会把副本重置成线上 main 的样子，所以不要在副本里手动改东西。
set -eu
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "${0:A:h}/.."

echo "== $(date '+%Y-%m-%d %H:%M:%S')"
git fetch --quiet origin main
git reset --quiet --hard origin/main
/usr/bin/python3 tools/collect_ai_usage.py

if git diff --quiet -- data/ai-usage.json; then
  echo "数据没有变化"
  exit 0
fi
git add data/ai-usage.json
git commit --quiet -m "Update AI usage data $(date +%Y-%m-%d)"
git push --quiet origin HEAD:main
echo "已推送"
