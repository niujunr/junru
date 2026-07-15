# 中文个人主页与 Projects 时间线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将五页静态个人主页中文化，并将 Projects 改为可替换图片的响应式纵向时间线。

**Architecture:** 保留原生 HTML 文件和单一共享 `styles.css`。页面文字直接写入 HTML；Projects 使用语义化 `article` 节点、日期列、时间线列和内容列。图片初版使用 CSS 深灰占位框，后续可以换成普通 `img`。

**Tech Stack:** 原生 HTML5、CSS3、Python 3 标准库 `html.parser`（仅作临时验证）。

## Global Constraints

- 不新增前端框架、包管理文件、构建配置或工作流。
- 继续公开邮箱和 LinkedIn；不得写入电话或微信。
- 全部可见界面文字使用中文；姓名 `Junru Niu` 与 `牛君儒` 保留。
- 使用白色背景、深灰正文、蓝色单一强调色；不使用渐变、复杂动画或卡片墙。
- Projects 的三个节点只能使用明确的占位文字，不得虚构项目事实。
- 页面可直接双击 HTML 文件打开，并在不大于 720px 时保持单栏可读。

## File Structure

- `index.html`：首页中文文字、中文动态、中文联系方式标题。
- `experience.html`：中文工作经历文字和中文导航。
- `projects.html`：三条中文占位时间线。
- `notes.html`：中文空状态和中文导航。
- `cv.html`：中文简历文字和中文导航。
- `styles.css`：时间线桌面与移动端样式。
- `/private/tmp/check_chinese_timeline.py`：一次性验证脚本，不提交。

## Tasks

### Task 1: 写入并运行会失败的静态页面检查

**Files:**
- Create: `/private/tmp/check_chinese_timeline.py`
- Test: `/private/tmp/check_chinese_timeline.py`

**Interfaces:**
- Consumes: 五个 HTML 页面与 `styles.css`。
- Produces: 退出码 `0` 表示中文导航、隐私与时间线结构均存在。

- [ ] **Step 1: 创建临时验证脚本**

```python
from pathlib import Path

root = Path.cwd()
pages = [root / x for x in ["index.html", "experience.html", "projects.html", "notes.html", "cv.html"]]
for page in pages:
    text = page.read_text(encoding="utf-8")
    for label in ["首页", "经历", "项目", "随笔", "简历"]:
        assert label in text, f"{page.name} missing navigation label: {label}"
    assert "13948721090" not in text, f"{page.name} exposes phone"
    assert "微信" not in text, f"{page.name} exposes WeChat"

projects = (root / "projects.html").read_text(encoding="utf-8")
assert projects.count('class="timeline-item"') == 3, "Projects needs three timeline nodes"
assert projects.count('class="project-image-placeholder"') == 3, "Projects needs three image placeholders"
assert "项目图片待补充" in projects, "Projects needs Chinese image placeholder copy"

css = (root / "styles.css").read_text(encoding="utf-8")
for selector in [".timeline", ".timeline-item", ".project-image-placeholder", "@media (max-width: 720px)"]:
    assert selector in css, f"styles.css missing {selector}"

print("Chinese navigation, privacy, and timeline contract passed")
```

- [ ] **Step 2: 验证其会失败**

Run: `python3 /private/tmp/check_chinese_timeline.py`

Expected: 以 `index.html missing navigation label: 首页` 失败。

### Task 2: 将五页界面文字改为中文

**Files:**
- Modify: `index.html`
- Modify: `experience.html`
- Modify: `projects.html`
- Modify: `notes.html`
- Modify: `cv.html`

**Interfaces:**
- Consumes: 现有共享导航、个人照片、邮箱与 LinkedIn。
- Produces: 五页一致的中文导航和中文可见文字；链接不变。

- [ ] **Step 1: 将每页导航替换为以下结构**

```html
<nav class="site-nav" aria-label="主导航">
  <a href="index.html">首页</a>
  <a href="experience.html">经历</a>
  <a href="projects.html">项目</a>
  <a href="notes.html">随笔</a>
  <a href="cv.html">简历</a>
</nav>
```

当前页链接继续保留 `class="active" aria-current="page"`。

- [ ] **Step 2: 用以下首页文字替换英文身份与简介**

```html
<p class="identity">追觅科技集团总裁助理、政府关系副总裁；追创创投投资者关系负责人。</p>
<p>牛君儒现就职于追觅科技与追创创投，参与集团战略、重大产业项目、政府及国资合作，以及投资者关系相关工作。</p>
<p>其工作涉及产业落地、基金合作、生态投资与国际市场拓展；持续关注 AI 与机器人、智能家居、先进制造、工业软件及核心供应链。</p>
<a class="text-link" href="cv.html">查看简历 →</a>
```

将首页栏目名改为“关注领域”“动态”“联系”，把三条动态改为中文月度表述，照片 `alt` 改为“牛君儒肖像”。

- [ ] **Step 3: 翻译其余页面的标题、正文、职位名称、教育信息、页脚与空状态**

随笔页使用：

```html
<h1 class="page-title">随笔</h1>
<p class="page-lead">这里将陆续整理公开的思考与记录。</p>
<p class="empty-note">暂未发布公开随笔。</p>
```

每页页脚使用：

```html
<footer class="site-footer">© 2026 牛君儒</footer>
```

- [ ] **Step 4: 运行临时检查**

Run: `python3 /private/tmp/check_chinese_timeline.py`

Expected: 以 `Projects needs three timeline nodes` 失败。

### Task 3: 实现 Projects 纵向时间线与图片占位框

**Files:**
- Modify: `projects.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `.page`、`.page-title`、`.page-lead`、`--ink`、`--muted`、`--accent`、`--rule`。
- Produces: `.timeline`、`.timeline-item`、`.timeline-date`、`.timeline-marker`、`.timeline-content`、`.project-image-placeholder`。

- [ ] **Step 1: 在 `projects.html` 中使用以下节点结构并连续写入三次**

```html
<article class="timeline-item">
  <time class="timeline-date" datetime="2024-12">2024.12</time>
  <div class="timeline-marker" aria-hidden="true"></div>
  <div class="timeline-content">
    <h2>[项目名称待补充]</h2>
    <p>[待补充：项目公开介绍]</p>
    <div class="project-image-placeholder" role="img" aria-label="项目图片待补充">项目图片待补充</div>
  </div>
</article>
```

用 `<section class="timeline" aria-label="项目时间线">` 包住三条节点；三条时间依次为 `2024.12`、`2024.03`、`2023.04`。将页标题和引言替换为：

```html
<h1 class="page-title">项目</h1>
<p class="page-lead">以下为项目展示的时间线版式。具体公开信息将在确认后补充。</p>
```

- [ ] **Step 2: 在 `.entry` 样式之后加入完整桌面时间线样式**

```css
.timeline { margin-top: 3.25rem; }
.timeline-item { display: grid; grid-template-columns: 7rem 1.5rem minmax(0, 1fr); column-gap: 1.6rem; position: relative; padding: 0 0 4rem; }
.timeline-item:last-child { padding-bottom: 0; }
.timeline-date { color: var(--muted); font-size: 0.92rem; line-height: 1.4; padding-top: 0.25rem; }
.timeline-marker { position: relative; }
.timeline-marker::before { position: absolute; top: 0.45rem; left: 50%; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--accent); content: ""; transform: translateX(-50%); }
.timeline-item:not(:last-child) .timeline-marker::after { position: absolute; top: 1.35rem; bottom: -4rem; left: 50%; width: 1px; background: var(--rule); content: ""; transform: translateX(-50%); }
.timeline-content h2 { margin: 0 0 0.65rem; font-size: 1.35rem; }
.timeline-content p { max-width: 42rem; color: var(--muted); }
.project-image-placeholder { display: grid; width: min(100%, 42rem); aspect-ratio: 16 / 9; margin-top: 1.3rem; place-items: center; color: #d7d7d7; background: #242424; font-size: 0.9rem; letter-spacing: 0.04em; }
```

- [ ] **Step 3: 在现有移动端媒体查询中加入以下规则**

```css
.timeline-item { grid-template-columns: 1.5rem minmax(0, 1fr); column-gap: 1.05rem; padding-bottom: 3rem; }
.timeline-date { grid-column: 2; grid-row: 1; padding-top: 0; }
.timeline-marker { grid-column: 1; grid-row: 1 / span 2; }
.timeline-content { grid-column: 2; grid-row: 2; margin-top: 0.35rem; }
.timeline-item:not(:last-child) .timeline-marker::after { bottom: -3rem; }
.project-image-placeholder { width: 100%; }
```

- [ ] **Step 4: 验证实现通过**

Run: `python3 /private/tmp/check_chinese_timeline.py && git diff --check`

Expected: 输出 `Chinese navigation, privacy, and timeline contract passed`，并以退出码 `0` 结束。

### Task 4: 提交、推送并检查线上页面

**Files:**
- Modify: `index.html`
- Modify: `experience.html`
- Modify: `projects.html`
- Modify: `notes.html`
- Modify: `cv.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: 前三个任务的静态页面与验证。
- Produces: `origin/main` 上的页面改动，现有 GitHub Pages 分支部署自动发布。

- [ ] **Step 1: 检查 CSS 链接、头像与隐私**

Run: `for page in index.html experience.html projects.html notes.html cv.html; do rg -q 'href="styles.css"' "$page" || exit 1; done; test -s assets/junru-niu.jpg; ! rg -n --glob '*.html' '13948721090|微信' .`

Expected: 退出码 `0`。

- [ ] **Step 2: 提交改动**

Run: `git add index.html experience.html projects.html notes.html cv.html styles.css && git commit -m "Translate site and add projects timeline"`

Expected: 创建一个只包含六个网站文件的提交。

- [ ] **Step 3: 推送并检查上线响应**

Run: `git push origin main && curl -I --max-time 20 https://niujunr.github.io/junru/`

Expected: 推送成功，GitHub Pages 完成更新后返回 `HTTP/2 200`。
