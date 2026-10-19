#!/bin/zsh
# 每天由 launchd 运行：重新统计 AI 用量，有变化就提交并推送到 main，GitHub Pages 随之更新。
#
# 这个脚本在一个只给自动更新用的副本里运行（默认 ~/.ai-usage/<仓库名>），不是平时编辑网站的那份。
# 每次运行前都会把副本重置成线上 main 的样子，所以不要在副本里手动改东西。
# 说明和出问题时的处理办法见同一文件夹里的 README.md。
#
# 整个脚本包在 main 函数里：zsh 会先读完整个函数再执行，
# 这样运行中途 git reset 改写了这个文件，也不会读到一半的新内容。
main() {
  set -eu
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
  local here="${1:A:h}"
  local repo="${here:h}"
  local home_dir="${AI_USAGE_HOME:-$HOME/.ai-usage}"
  local inbox="$home_dir/inbox"
  # 下面会 git reset --hard，只允许在自动更新专用的副本里跑，免得冲掉平时那份仓库里没提交的改动
  if [[ "$repo" != "${home_dir:A}"/* ]]; then
    echo "这个脚本只在 $home_dir 里的副本中运行（会丢弃未提交的改动）。平时那份仓库请不要直接运行它。"
    return 1
  fi
  cd "$repo"

  echo "== $(date '+%Y-%m-%d %H:%M:%S')"
  git fetch --quiet origin main
  git reset --quiet --hard origin/main

  # Grok：收件箱里有新导出的 CSV 就先导入，导入成功的移到 imported/
  local csvs=("$inbox"/*.csv(N))
  if (( ${#csvs} )); then
    if /usr/bin/python3 ai-usage/import_grok_usage.py "${csvs[@]}"; then
      mkdir -p "$inbox/imported"
      local f
      for f in "${csvs[@]}"; do mv "$f" "$inbox/imported/$(date +%Y%m%d-%H%M%S)-${f:t}"; done
    else
      echo "Grok 明细导入失败，文件留在收件箱里，下次再试"
    fi
  fi

  /usr/bin/python3 ai-usage/collect_ai_usage.py

  if git diff --quiet -- ai-usage/data; then
    echo "数据没有变化"
    return 0
  fi
  git add ai-usage/data
  git commit --quiet -m "Update AI usage data $(date +%Y-%m-%d)"
  git push --quiet origin HEAD:main
  echo "已推送"
}
main "$0"
exit
