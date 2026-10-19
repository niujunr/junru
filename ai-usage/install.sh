#!/bin/zsh
# 在这台 Mac 上安装（或重装）AI 用量的每日自动更新。可以重复运行，每次都会把定时任务改成最新的设置。
#
# 用法：
#   zsh ai-usage/install.sh                安装或重装
#   zsh ai-usage/install.sh --uninstall    停用定时任务（~/.ai-usage 里的文件保留）
#
# 可选的环境变量：
#   AI_USAGE_REPO     GitHub 仓库，例如 niujunr/junru。默认取当前这份仓库的 origin
#   AI_USAGE_HOME     本地文件夹，默认 ~/.ai-usage。不要放在「文稿」「桌面」「下载」里，定时任务没有权限读那些地方
#   AI_USAGE_HOUR     每天运行的小时，默认 23
#   AI_USAGE_MINUTE   每天运行的分钟，默认 50
set -eu
here="${0:A:h}"
home_dir="${AI_USAGE_HOME:-$HOME/.ai-usage}"
repo="${AI_USAGE_REPO:-$(git -C "$here" remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')}"
owner="${repo%%/*}"
name="${repo##*/}"
label="com.${owner:l}.ai-usage"
plist="$HOME/Library/LaunchAgents/$label.plist"
clone="$home_dir/$name"
hour="${AI_USAGE_HOUR:-23}"
minute="${AI_USAGE_MINUTE:-50}"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  rm -f "$plist"
  echo "已停用定时任务 $label。$home_dir 里的副本、日志和收件箱都还在，不需要可以手动删除。"
  exit 0
fi

# 1. 检查需要的工具
for cmd in git /usr/bin/python3 gh; do
  command -v "$cmd" >/dev/null || { echo "缺少 $cmd，请先安装"; exit 1; }
done
gh auth status >/dev/null 2>&1 || { echo "gh 还没有登录 GitHub，请先运行：gh auth login"; exit 1; }
command -v codex >/dev/null || echo "提示：没找到 codex 命令，ChatGPT 官方数据会读不到，其余照常更新"

# 2. 自动更新专用的副本
mkdir -p "$home_dir/inbox"
if [[ -d "$clone/.git" ]]; then
  git -C "$clone" fetch --quiet origin main
  git -C "$clone" reset --quiet --hard origin/main
else
  gh repo clone "$repo" "$clone" -- --quiet
fi

# 3. 副本自己的提交身份和推送登录（只改这个副本，不动全局 Git 设置）
login="$(gh api user --jq .login)"
uid="$(gh api user --jq .id)"
git -C "$clone" config user.name "$login"
git -C "$clone" config user.email "$uid+$login@users.noreply.github.com"
git -C "$clone" config --local --replace-all credential.helper ''
git -C "$clone" config --local --add credential.helper "!$(command -v gh) auth git-credential"

# 4. 定时任务
mkdir -p "${plist:h}"
sed -e "s#__LABEL__#$label#g" \
    -e "s#__SCRIPT__#$clone/ai-usage/update_ai_usage.sh#g" \
    -e "s#__LOG__#$home_dir/update.log#g" \
    -e "s#__HOUR__#$hour#g" \
    -e "s#__MINUTE__#$minute#g" \
    "$here/launchd.plist.template" > "$plist"
plutil -lint "$plist" >/dev/null
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"

echo "已安装 $label：每天 $hour:$(printf %02d "$minute") 和每次登录时运行一次，现在正在跑第一次。"
echo "日志：$home_dir/update.log"
echo "Grok 收件箱：$home_dir/inbox"
