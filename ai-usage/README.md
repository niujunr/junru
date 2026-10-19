# AI 用量自动统计

这个文件夹负责网站「AI 用量」页背后的数据：每天自动统计 Claude、ChatGPT 和 Grok 用了多少 token，并更新到网站上。

- 中文页：https://niujunr.github.io/junru/usage.html
- 英文页：https://niujunr.github.io/junru/en/usage.html

## 它是怎么运作的

```
每天 23:50 和每次登录时
  macOS 定时任务（launchd）
    → 运行 update_ai_usage.sh（在 ~/.ai-usage 里的专用副本中）
      → 有新的 Grok 导出文件就先导入
      → collect_ai_usage.py 读取 Claude、ChatGPT 的用量，写进 data/ai-usage.json
      → 数据有变化就提交并推送到 GitHub 的 main
        → GitHub Pages 几分钟后更新网页
          → 访客打开页面时，usage.js 读取数据文件画出图表
```

日常运行全部是普通脚本，不用 AI，也不消耗任何 token。只有改设计、接新的数据来源、修故障时才需要人（或 AI）动手。

## 文件夹里有什么

| 文件 | 作用 |
|---|---|
| `README.md` | 这份说明 |
| `collect_ai_usage.py` | 统计脚本：读取各处的用量，写进 `data/ai-usage.json` |
| `import_grok_usage.py` | 把 xAI 控制台导出的 Grok 用量明细（CSV）汇总成每天的合计，写进 `data/grok-usage.json` |
| `update_ai_usage.sh` | 定时任务每天运行的脚本：导入、统计、提交、推送 |
| `install.sh` | 在一台 Mac 上安装、重装或停用自动更新 |
| `launchd.plist.template` | 定时任务的模板，由 `install.sh` 填好后放进系统 |
| `data/ai-usage.json` | 网页读的数据：每天各工具的 token 数、ChatGPT 官方累计、各模型的总数 |
| `data/grok-usage.json` | 从 Grok 导出文件汇总出的每日合计 |
| `data/ai-usage-official.json` | 备用的官方累计数，手动维护（见下文） |

网页本身在仓库根目录：`usage.html`（中文）、`en/usage.html`（英文）、`usage.js`（两种语言共用的图表代码）、`styles.css` 里以 `usage-` 开头的样式。

### 本机上还有这些（不在仓库里）

| 位置 | 作用 |
|---|---|
| `~/.ai-usage/<仓库名>/` | 自动更新专用的仓库副本。每次运行前都会重置成线上 main 的样子，不要在里面手动改东西 |
| `~/.ai-usage/inbox/` | Grok 收件箱：把新导出的 CSV 放进来，当晚自动导入 |
| `~/.ai-usage/inbox/imported/` | 已经导入过的 CSV，文件名前面加了导入时间 |
| `~/.ai-usage/update.log` | 每次运行的日志 |
| `~/Library/LaunchAgents/com.<GitHub 用户名>.ai-usage.plist` | 定时任务本身 |

平时编辑网站的那份仓库（比如 `~/Documents/junru`）和自动更新的副本是两份，互不影响。

## 数据从哪来

| 栏目 | 来源 | 自动程度 |
|---|---|---|
| Claude | 本机的会话记录：`~/.claude/projects`（Claude Code）、`~/Library/Application Support/Claude/local-agent-mode-sessions`（Cowork）。另外用 `plan-usage-history.json` 里的额度采样标出"用过但没有记录"的日子 | 全自动 |
| ChatGPT | 通过本机的 `codex` 命令调用官方的 `account/usage/read`，拿到 OpenAI 账号的累计 token 和每天的 token 数，包括云端任务和其他设备上的使用 | 全自动 |
| Grok | xAI 控制台导出的用量明细（`personal-unified-usage-*.csv`），包括 Grok Bot、Grok 对话、Grok Tasks | 半自动：导出要手动，导入是自动的 |

几点说明：

- **token 的算法：** 输入、输出和缓存读写全部加起来。其中大部分是每轮对话都要重新带上的上下文（缓存读取），所以 token 数不等于写了多少字。
- **Claude 只算这台 Mac：** 网页版和手机 App 里的聊天不在本地，统计不到。在 Claude 应用里删除会话，会话记录也会跟着删掉，但已经写进 `data/ai-usage.json` 的数字只增不减，删会话不会让网页上的历史变少。
- **ChatGPT 的兜底：** 官方每日数据缺失的日子（比如读取失败，或者当天的数据还没出来），用本机 `~/.codex` 里的记录代替；较早的对话只有总数，按使用时长分摊到每天，标为估算。
- **Grok 为什么不能全自动：** xAI 的 Management API 有一个用量接口，但 2026 年 10 月实测查不到个人会员的用量（全年返回都是空的），所以只能从控制台导出。

## 日常操作

### 平时什么都不用做

Mac 开着就行。睡眠状态下错过的那次，醒来后会补跑；关机时错过的，下次登录时会跑。

### 更新 Grok

1. 在 xAI 控制台（console.x.ai）的用量页面导出 CSV。时间范围选得越长越好，重复导入同一段时间不会重复计算。
2. 打开收件箱，把文件拖进去：

   ```bash
   open ~/.ai-usage/inbox
   ```

3. 当晚自动导入。想马上更新，就手动运行一次（见下一节）。

### 立刻手动更新一次

```bash
launchctl kickstart gui/$(id -u)/com.niujunr.ai-usage
```

跑完大约要一两分钟，推送后再等几分钟网页才会更新。

### 看最近的运行情况

```bash
tail -20 ~/.ai-usage/update.log
```

正常的一次运行长这样：

```
== 2026-10-20 23:50:01
已写入 ……/ai-usage/data/ai-usage.json：89 天有 token 记录，累计 9,874,604,690 token
已推送
```

数据没变时最后一行是"数据没有变化"，这也是正常的。

### 改每天运行的时间

在网站仓库的根目录运行（例子是改成每天早上 8 点）：

```bash
AI_USAGE_HOUR=8 AI_USAGE_MINUTE=0 zsh ai-usage/install.sh
```

### 手动填官方累计数（备用）

`data/ai-usage-official.json` 里可以手动写官方累计数，自动更新不会改这个文件：

- **ChatGPT（`codex` 那一项）：** 只有自动读取失败、而且数据文件里一次官方数都没有时，页面才用这里的数字。正常情况下不用管。
- **Grok：** 填了 `grok` 一项，页面顶部的「Grok 累计」就改用这个数，图表还是用导入的明细。格式和 `codex` 一样：`{"tokens": 数字, "asOf": "YYYY-MM-DD", "source": "xAI 控制台"}`。

改完提交、推送即可。

## 在新电脑上安装，或者给别人用

### 需要先装好

- macOS（定时任务用的是 macOS 自带的 launchd）
- `git` 和 `python3`：macOS 自带。第一次用时系统可能会提示安装"命令行开发者工具"，点安装就行
- GitHub 命令行工具 `gh`，并且已经登录：`brew install gh`，然后 `gh auth login`
- 要统计 ChatGPT：装好 `codex` 命令，并用 ChatGPT 账号登录过（`codex login status` 显示 "Logged in using ChatGPT"）
- 要统计 Claude：在这台 Mac 上用 Claude 桌面应用 / Claude Code

### 安装

在网站仓库的根目录运行：

```bash
zsh ai-usage/install.sh
```

它会做四件事：建 `~/.ai-usage` 和收件箱；把仓库克隆一份到 `~/.ai-usage/<仓库名>`；给这份副本单独设置提交身份和推送登录（用 `gh` 的登录，不改你电脑上的全局 Git 设置）；安装定时任务并马上跑第一次。可以重复运行，每次都会更新到最新设置。

装完看一下日志，确认最后一行是"已推送"或"数据没有变化"。

### 用在自己的网站上

1. 把这个 `ai-usage/` 文件夹，连同 `usage.html`、`en/usage.html`、`usage.js` 和 `styles.css` 里 `usage-` 开头的样式，复制到你自己的 GitHub Pages 仓库。
2. 删掉 `data/` 里的三个 JSON 文件，从零开始统计（`ai-usage-official.json` 可以留着当格式参考，把数字清掉）。
3. 改页面上的文字：`usage.html`、`en/usage.html`，以及 `usage.js` 开头的 `TEXT`。
4. 在你的仓库根目录运行 `zsh ai-usage/install.sh`。仓库名会自动从 `origin` 推断；不对的话用 `AI_USAGE_REPO=你的用户名/仓库名` 指定。
5. 不用 Grok 的话什么都不用做，没有导入过明细，页面就不会显示 Grok。

## 出问题怎么办

先看两样东西：

```bash
tail -30 ~/.ai-usage/update.log
```

```bash
launchctl print gui/$(id -u)/com.niujunr.ai-usage | grep -E 'state =|last exit code'
```

### 网页上的数字好几天没变

- **日志里没有新的记录：** 说明定时任务没有跑。可能是 Mac 一直关机或没登录；也可能是定时任务没装上，在网站仓库根目录重新运行 `zsh ai-usage/install.sh`。
- **日志里有推送失败、"Authentication failed" 之类的字样：** 一般是 GitHub 登录过期了。运行 `gh auth status` 看看，必要时 `gh auth login` 重新登录，然后手动更新一次。
- **日志写着"已推送"，网页却没变：** GitHub Pages 还在生成，或者网页有大约 10 分钟的缓存。查看生成状态：

  ```bash
  gh api repos/niujunr/junru/pages/builds/latest --jq '.status + " " + .commit[0:7]'
  ```

  显示 `errored` 时，如果紧接着的下一次是 `built`，就没问题：两次推送挨得太近，前一次生成被后一次顶掉了。

### ChatGPT 的数字不动了，其他正常

1. 检查 `codex` 是否还登录着：`codex login status`。没登录就运行 `codex login`。
2. 单独测一下官方接口能不能读到（在网站仓库根目录运行）：

   ```bash
   python3 -c "import sys; sys.path.insert(0, 'ai-usage'); import collect_ai_usage as c; r = c.read_chatgpt_official(); print(r and r['summary'])"
   ```

   打印出 `lifetimeTokens` 等数字就是正常的；打印 `None` 说明没读到。
3. 读不到的这段时间，页面会沿用上一次的官方数据，不会出错。如果是 `codex` 升级后接口改了名字或格式，需要改 `collect_ai_usage.py` 里的 `read_chatgpt_official`。可以用 `codex app-server generate-json-schema --out 某个文件夹` 导出最新的接口说明来对照。

### Claude 某几天没有数字，或者新的日子统计不到

- 已经写进数据文件的日子不会因为删会话而消失。如果历史数字变少了，说明数据文件被改过，查一下记录：`git log --oneline -- ai-usage/data/ai-usage.json`。
- 新的日子统计不到，可能是 Claude 应用改了会话记录的存放位置或格式。对照 `collect_ai_usage.py` 里 `collect_claude` 用到的路径，看看本机的记录还在不在那里。

### Grok 文件放进收件箱了，却没有导入

- 文件还在收件箱里、日志里有"Grok 明细导入失败"：多半是 xAI 改了导出格式。脚本需要 `Event Time`、`Product`、`Usage`、`Model` 这几列。可以手动运行一次看具体报错：

  ```bash
  python3 ai-usage/import_grok_usage.py ~/.ai-usage/inbox/文件名.csv
  ```

  注意：这样手动运行会改平时那份仓库里的 `data/grok-usage.json`，确认没问题后要提交推送。
- 文件必须以 `.csv` 结尾。放在子文件夹里不会被读到。

### 日志里出现 "Operation not permitted"

macOS 不允许后台任务读「文稿」「桌面」「下载」这几个文件夹。副本和收件箱都要放在默认的 `~/.ai-usage` 里，不要用 `AI_USAGE_HOME` 指到那些地方。

### 数据被弄乱了，想恢复

每次自动更新都是一次 Git 提交，可以退回到之前的版本：

```bash
git log --oneline -- ai-usage/data/ai-usage.json
```

找到出问题之前的那次提交，用 `git revert` 撤销出问题的提交，再推送。不要直接删掉数据文件重新统计：本机已经删掉的会话记录无法再算出来，那部分历史会丢失。

### 想暂停或彻底停用

```bash
zsh ai-usage/install.sh --uninstall
```

这只是停用定时任务，`~/.ai-usage` 里的副本、日志和收件箱都会保留。想恢复时重新运行 `zsh ai-usage/install.sh`。

### 换了电脑或重装了系统

在新电脑上装好 `gh`、`codex` 和 Claude，把网站仓库克隆下来，运行 `zsh ai-usage/install.sh`。已经写进数据文件的历史在 GitHub 上，不会丢；旧电脑上的 Claude 会话记录不会跟过来，所以换电脑之后 Claude 只统计新电脑上的使用。

### 千万不要做的事

- 不要在平时那份仓库里直接运行 `update_ai_usage.sh`。它会先把仓库重置成线上的样子，冲掉没提交的改动。脚本里已经加了检查，不在 `~/.ai-usage` 里时会拒绝运行。
- 不要把任何密钥、原始的 Grok CSV 文件放进这个文件夹。仓库是公开的。

## 隐私和安全

- **公开的内容：** 每天各栏的 token 数、模型名称、累计数。不包括文件夹名、对话内容、邮箱或账号 ID。
- **Grok：** 导入时只保留每天、每个产品的合计。原始 CSV 留在本机的 `~/.ai-usage/inbox/imported/`，不会上传。
- **登录凭据：** 推送用的是 `gh` 自己保存的登录；ChatGPT 的官方数据由 `codex` 用它自己的登录去取。这些脚本不读取、也不保存任何密钥或 token。
- **xAI Management Key：** 不需要。实测它查不到个人会员用量，建议在 xAI 控制台删掉，钥匙串里的那条也可以删：`security delete-generic-password -a "$USER" -s xai-management-key`。

## 已知的限制

- Claude 只统计装了定时任务的这一台 Mac。
- ChatGPT 每天的日期按 OpenAI 返回的 `startDate` 划分，可能是按 UTC 切的，跟北京时间会有几个小时的偏差。
- Grok 需要手动导出，而且目前的明细只从 2026 年 10 月 15 日开始。

## 设计上的几个取舍（给以后改它的人）

- **为什么用单独的副本：** 一是 macOS 不让后台任务读「文稿」等文件夹，二是平时编辑网站时可能有没提交的改动，单独一份副本互不干扰。
- **为什么数字只增不减：** 本机记录会因为删会话而消失，所以每天的数字一旦写进数据文件，后续统计只会把它调高、不会调低。
- **为什么 ChatGPT 优先用官方数据：** 本机记录统计不到云端任务和其他设备，而且旧对话的记录不完整。官方接口给的是整个账号的数字。
- **为什么不去抓网页上的数字：** ChatGPT 个人主页和 xAI 控制台都要登录才能看。把登录凭据放进自动脚本既不安全，网页一改也就失效了。
