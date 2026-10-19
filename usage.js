// 「AI 用量」页的图表和数字，中文页 usage.html 和英文页 en/usage.html 共用。
// 页面语言看 <html lang>，所有显示的文字都在下面的 TEXT 里。
(function () {
  var EN = /^en/i.test(document.documentElement.lang);
  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WD_ZH = '日一二三四五六';
  var WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var TEXT = EN ? {
    total: 'Total',
    estimate: 'ChatGPT figure is an estimate',
    seen: 'Used Claude, but no token record for this day',
    none: 'No use',
    calLabel: function (a, b) { return 'Usage calendar, ' + a + ' to ' + b; },
    barsLabel: 'Daily token usage, stacked by tool',
    barsSub: function (all, n) { return (all ? 'From the first day to today' : 'The last ' + n + ' days') + '. Each bar is one day; days without a bar had no use.'; },
    gptTotal: 'ChatGPT total', grokTotal: 'Grok total', claudeTotal: 'Claude total',
    official: function (d) { return 'Official figure, as of ' + d; },
    officialFrom: function (d, src) { return 'Official figure, as of ' + d + ', from ' + src; },
    grokSource: 'the xAI console',
    grokImport: function (span) { return 'xAI usage export, ' + span; },
    local: 'Local records',
    daysUsed: 'Days using AI',
    days: function (n) { return n + (n === 1 ? ' day' : ' days'); },
    since: function (d, n) { return 'Since ' + d + ', out of ' + n + ' days'; },
    streak: 'Current streak',
    longest: function (n) { return 'Longest streak: ' + (n === 1 ? '1 day' : n + ' days'); },
    gptAsOf: function (t, d) { return ' Currently ' + t + ' in total, as of ' + d + '.'; },
    grokAsOf: function (span, t) { return ' The imported export covers ' + span + ', ' + t + ' in total.'; },
    updated: function (u) { return ' Last updated: ' + u + '.'; },
    otherModels: function (n) { return n + ' other models'; },
    thTool: 'Tool', thModel: 'Model', thTokens: 'Tokens', thDate: 'Date', est: 'est.',
    loadError: 'Usage data couldn’t be loaded. Please refresh later.',
    modelNames: { 'Grok 对话': 'Grok chat' },
  } : {
    total: '合计',
    estimate: 'ChatGPT 的数字是估算',
    seen: '用过 Claude，但没有当天的 token 记录',
    none: '没用',
    calLabel: function (a, b) { return '使用日历，' + a + ' 到 ' + b; },
    barsLabel: '每天的 token 用量，按工具堆叠',
    barsSub: function (all, n) { return (all ? '从第一天到今天' : '最近 ' + n + ' 天') + '，每根柱子是一天，没有柱子的日子是没用。'; },
    gptTotal: 'ChatGPT 累计', grokTotal: 'Grok 累计', claudeTotal: 'Claude 累计',
    official: function (d) { return '官方数，截至 ' + d; },
    officialFrom: function (d, src) { return '官方数，截至 ' + d + '，来自 ' + src; },
    grokSource: 'xAI 控制台',
    grokImport: function (span) { return 'xAI 用量明细，' + span; },
    local: '本机记录',
    daysUsed: '用过 AI 的天数',
    days: function (n) { return n + ' 天'; },
    since: function (d, n) { return '从 ' + d + '起，共 ' + n + ' 天'; },
    streak: '连续使用',
    longest: function (n) { return '最长连续 ' + n + ' 天'; },
    gptAsOf: function (t, d) { return '目前累计 ' + t + '，截至 ' + d + '。'; },
    grokAsOf: function (span, t) { return '目前导入的明细覆盖 ' + span + '，共 ' + t + '。'; },
    updated: function (u) { return '最后更新：' + u + '。'; },
    otherModels: function (n) { return '其他 ' + n + ' 个模型'; },
    thTool: '工具', thModel: '模型', thTokens: 'token', thDate: '日期', est: '估算',
    loadError: '用量数据暂时加载不出来，请稍后刷新。',
    modelNames: {},
  };

  // 按厂商分三栏，数据文件里的各个工具归到对应的厂商下。
  // 颜色写在 styles.css 的 .usage-fill-*（图表）和 .usage-key-*（图例、圆点）里
  var GROUPS = [
    { id: 'claude', name: 'Claude', tools: ['claude_code', 'cowork'] },
    // ChatGPT 有官方每日数据就只用官方数据（已经包含本机的 Codex），没有时退回本机记录
    { id: 'chatgpt', name: 'ChatGPT', tools: ['chatgpt', 'codex'], prefer: true },
    { id: 'grok', name: 'Grok', tools: ['grok'] },
  ];
  var STACK = GROUPS.map(function (g) { return g.id; });
  var D = null, OFFICIAL = null;
  var state = { tool: 'all' };
  var $ = function (s) { return document.querySelector(s); };

  // ---------- 格式化 ----------
  function trim(s) { return s.replace(/\.0+$|(\.\d*?)0+$/, '$1'); }
  function num(n) {
    if (EN) {
      if (n >= 1e9) return trim((n / 1e9).toFixed(n >= 1e10 ? 1 : 2)) + 'B';
      if (n >= 1e6) return trim((n / 1e6).toFixed(n >= 1e8 ? 0 : 1)) + 'M';
      if (n >= 1e3) return trim((n / 1e3).toFixed(n >= 1e5 ? 0 : 1)) + 'K';
      return Math.round(n).toLocaleString('en-US');
    }
    if (n >= 1e8) return trim((n / 1e8).toFixed(n >= 1e10 ? 0 : n >= 1e9 ? 1 : 2)) + ' 亿';
    if (n >= 1e4) return trim((n / 1e4).toFixed(n >= 1e6 ? 0 : 1)) + ' 万';
    return Math.round(n).toLocaleString('zh-CN');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- 日期 ----------
  function parseDay(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function diff(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 864e5); }
  function md(s) { var d = parseDay(s); return EN ? MONTHS[d.getMonth()] + ' ' + d.getDate() : (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function ymd(s) { var d = parseDay(s); return EN ? md(s) + ', ' + d.getFullYear() : d.getFullYear() + '年' + md(s); }
  function dayLabel(s) { var d = parseDay(s); return EN ? WD_EN[d.getDay()] + ', ' + ymd(s) : ymd(s) + ' 周' + WD_ZH[d.getDay()]; }
  function monthLabel(d) { return EN ? MONTHS[d.getMonth()] : (d.getMonth() + 1) + '月'; }
  function span(a, b) { return EN ? md(a) + '–' + md(b) : md(a) + '至' + md(b); }

  // ---------- 派生数据 ----------
  function group(id) { return GROUPS.filter(function (g) { return g.id === id; })[0]; }
  function groupOfTool(tool) { return GROUPS.filter(function (g) { return g.tools.indexOf(tool) >= 0; })[0]; }
  function groupTotal(r, id) {
    var g = group(id); if (!r) return 0;
    if (g.prefer) { for (var i = 0; i < g.tools.length; i++) if (r[g.tools[i]] != null) return r[g.tools[i]]; return 0; }
    return g.tools.reduce(function (s, t) { return s + (r[t] || 0); }, 0);
  }
  function localEstimate(k) { var r = D.days[k]; return r && r.chatgpt == null && r.codex && D.estimated.indexOf(k) >= 0; }
  function dayTotal(k, id) {
    var r = D.days[k]; if (!r) return 0;
    if (id && id !== 'all') return groupTotal(r, id);
    return STACK.reduce(function (s, g) { return s + groupTotal(r, g); }, 0);
  }
  function today() { return key(new Date()); }
  function usedDays() {
    var set = {};
    Object.keys(D.days).forEach(function (k) { if (dayTotal(k) > 0) set[k] = 1; });
    D.seen.forEach(function (k) { set[k] = 1; });
    return Object.keys(set).sort();
  }

  // ---------- 提示框 ----------
  var tip = $('#tip');
  function showTip(e, html) {
    tip.innerHTML = html; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight, x = e.clientX + 14, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = Math.max(8, e.clientX - w - 14);
    if (y + h > innerHeight - 8) y = Math.max(8, e.clientY - h - 12);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function row(a, b) { return '<div class="usage-tip-row"><span>' + a + '</span><span>' + b + '</span></div>'; }
  function dayTip(k) {
    var r = D.days[k], html = '<b>' + dayLabel(k) + '</b>';
    if (r) {
      STACK.forEach(function (id) { var v = groupTotal(r, id); if (v) html += row('<i class="usage-dot usage-key-' + id + '"></i>' + group(id).name, num(v)); });
      html += row(TEXT.total, num(dayTotal(k)));
      if (localEstimate(k)) html += '<div class="usage-tip-note">' + TEXT.estimate + '</div>';
      return html;
    }
    if (D.seen.indexOf(k) >= 0) return html + '<div>' + TEXT.seen + '</div>';
    return html + '<div>' + TEXT.none + '</div>';
  }
  function bindTips(root) {
    var on = function (e) { var t = e.target.closest('[data-day]'); if (t) showTip(e, dayTip(t.getAttribute('data-day'))); else hideTip(); };
    root.addEventListener('pointermove', on);
    root.addEventListener('pointerdown', on);
    root.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') hideTip(); });
  }
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('[data-day]')) hideTip(); });

  // ---------- SVG ----------
  function svg(w, h, label) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); s.style.display = 'block';
    return s;
  }
  function el(parent, tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    parent.appendChild(n); return n;
  }
  function niceTicks(max, n) {
    if (max <= 0) return { top: 1, ticks: [0, 1] };
    var rough = max / n, pow = Math.pow(10, Math.floor(Math.log10(rough)));
    var step = [1, 2, 2.5, 5, 10].map(function (f) { return f * pow; }).filter(function (s) { return s >= rough; })[0];
    var top = Math.ceil(max / step) * step, ticks = [];
    for (var v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { top: top, ticks: ticks };
  }

  // ---------- 总览数字 ----------
  function renderFigures() {
    var claude = 0, codex = 0, grok = 0;
    Object.keys(D.days).forEach(function (k) {
      var r = D.days[k];
      claude += (r.claude_code || 0) + (r.cowork || 0); codex += r.codex || 0; grok += r.grok || 0;
    });
    // ChatGPT 优先用每天自动读取的官方累计，其次是手动填的官方数，最后退回本机记录；Grok 用导入的明细
    var pick = function (id) { var o = OFFICIAL && OFFICIAL[id]; return o && o.tokens ? o : null; };
    var asOf = function (o) { return o.asOf ? ymd(o.asOf.slice(0, 10)) : ''; };
    var cx = pick('codex'), gk = pick('grok');
    var used = usedDays(), total = D.first ? diff(D.first, today()) + 1 : 0;
    var best = 0, run = 0, prev = null;
    used.forEach(function (k) { run = prev && diff(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    var cur = 0, d = new Date(); d.setHours(0, 0, 0, 0);
    var set = {}; used.forEach(function (k) { set[k] = 1; });
    if (!set[key(d)]) d = addDays(d, -1);
    while (set[key(d)]) { cur++; d = addDays(d, -1); }
    var auto = D.chatgpt && D.chatgpt.lifetime ? { tokens: D.chatgpt.lifetime, asOf: D.chatgpt.asOf } : null;
    var gpt = auto || cx;
    var items = [gpt ? [TEXT.gptTotal, num(gpt.tokens), TEXT.official(asOf(gpt))] : [TEXT.gptTotal, num(codex), TEXT.local]];
    var gr = D.grok_range, grokSpan = gr && gr.from ? span(gr.from, gr.to) : '';
    if (gk) items.push([TEXT.grokTotal, num(gk.tokens), TEXT.officialFrom(asOf(gk), EN ? TEXT.grokSource : esc(gk.source || TEXT.grokSource))]);
    else if (grok) items.push([TEXT.grokTotal, num(grok), TEXT.grokImport(grokSpan)]);
    items.push(
      [TEXT.claudeTotal, num(claude), TEXT.local],
      [TEXT.daysUsed, TEXT.days(used.length), D.first ? TEXT.since(ymd(D.first), total) : ''],
      [TEXT.streak, TEXT.days(cur), TEXT.longest(best)]
    );
    $('#official-asof').textContent = gpt ? TEXT.gptAsOf(num(gpt.tokens), asOf(gpt)) : '';
    $('#grok-note').hidden = !(gk || grok);
    $('#grok-asof').textContent = grok ? TEXT.grokAsOf(grokSpan, num(grok)) : '';
    $('#figures').innerHTML = items.map(function (x) {
      return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd><dd class="usage-figure-note">' + x[2] + '</dd></div>';
    }).join('');
    var u = D.updated ? D.updated.slice(0, 16) : '';
    $('#updated').textContent = u ? TEXT.updated(u) : '';
  }

  // ---------- 日历 ----------
  function renderCalendar() {
    var box = $('#calendar');
    var end = parseDay(today());
    var start = D.first ? parseDay(D.first) : end;
    var maxWeeks = 53;
    var gridStart = addDays(start, -((start.getDay() + 6) % 7));
    var weeks = Math.floor(diff(key(gridStart), key(end)) / 7) + 1;
    if (weeks > maxWeeks) { gridStart = addDays(gridStart, (weeks - maxWeeks) * 7); weeks = maxWeeks; start = gridStart; }
    var lw = EN ? 30 : 22, th = 20, gap = 3;
    var cell = Math.max(10, Math.min(20, Math.floor((box.clientWidth - lw) / weeks) - gap));
    var W = lw + weeks * (cell + gap), H = th + 7 * (cell + gap);
    var s = svg(W, H, TEXT.calLabel(key(start), key(end)));
    var pat = el(el(s, 'defs', {}), 'pattern', { id: 'usage-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    el(pat, 'rect', { width: 5, height: 5, class: 'usage-q0' });
    el(pat, 'line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'usage-hatch-line' });

    var vals = Object.keys(D.days).map(function (k) { return dayTotal(k, state.tool); }).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    var q = function (p) { return vals[Math.min(vals.length - 1, Math.floor(p * vals.length))]; };
    var t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
    var level = function (v) { return v <= t1 ? 1 : v <= t2 ? 2 : v <= t3 ? 3 : 4; };

    // 行标签：周一、周三、周五
    [0, 2, 4].forEach(function (i) {
      el(s, 'text', { x: 0, y: th + i * (cell + gap) + cell / 2 + 4, class: 'usage-ax' }, EN ? WD_EN[(i + 1) % 7] : WD_ZH[(i + 1) % 7]);
    });
    var lastLabel = -9;
    for (var w = 0; w < weeks; w++) {
      for (var dow = 0; dow < 7; dow++) {
        var d = addDays(gridStart, w * 7 + dow);
        if (d < start || d > end) continue;
        var k = key(d), v = dayTotal(k, state.tool);
        if ((d.getDate() === 1 || (w === 0 && +d === +start)) && w - lastLabel >= 3) {
          el(s, 'text', { x: lw + w * (cell + gap), y: 12, class: 'usage-ax' }, monthLabel(d));
          lastLabel = w;
        }
        var cls = v > 0 ? 'usage-q' + level(v) : (D.seen.indexOf(k) >= 0 && (state.tool === 'all' || state.tool === 'claude') ? 'usage-hatch' : 'usage-q0');
        el(s, 'rect', { x: lw + w * (cell + gap), y: th + dow * (cell + gap), width: cell, height: cell, rx: 2, class: cls + (k === today() ? ' usage-today' : ''), 'data-day': k });
      }
    }
    box.replaceChildren(s);
    box.scrollLeft = box.scrollWidth;
  }

  // ---------- 每日堆叠柱 ----------
  function renderBars() {
    var box = $('#bars');
    var W = Math.max(280, box.clientWidth), H = 230, ml = 52, mr = 4, mt = 14, mb = 26;
    var end = parseDay(today()), first = D.first ? parseDay(D.first) : end;
    var all = diff(key(first), key(end)) + 1;
    var n = Math.max(7, Math.min(all, Math.floor((W - ml - mr) / 7)));
    var days = [];
    for (var i = n - 1; i >= 0; i--) days.push(key(addDays(end, -i)));
    $('#bars-sub').textContent = TEXT.barsSub(n >= all, n);
    var max = Math.max.apply(null, days.map(function (k) { return dayTotal(k); }).concat([0]));
    var nt = niceTicks(max, 4), top = nt.top;
    var y = function (v) { return mt + (H - mt - mb) * (1 - v / top); };
    var s = svg(W, H, TEXT.barsLabel);
    // ChatGPT 用白灰相间的斜纹，跟 Codex 的标志一样
    var stripes = el(el(s, 'defs', {}), 'pattern', { id: 'usage-chatgpt-stripes', width: 3, height: 3, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    el(stripes, 'rect', { width: 3, height: 3, class: 'usage-chatgpt-bg' });
    el(stripes, 'line', { x1: 0, y1: 0, x2: 0, y2: 3, class: 'usage-chatgpt-line' });
    nt.ticks.forEach(function (v) {
      el(s, 'line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: v ? 'usage-grid' : 'usage-base' });
      el(s, 'text', { x: ml - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'usage-ax' }, v ? num(v).replace(' ', '') : '0');
    });
    var step = (W - ml - mr) / n, bw = Math.max(2, Math.min(24, step - 2));
    var lastLabelX = -99;
    days.forEach(function (k, i) {
      var x = ml + i * step, bx = x + (step - bw) / 2, r = D.days[k] || {}, acc = 0;
      var segs = STACK.filter(function (id) { return groupTotal(r, id) > 0; });
      segs.forEach(function (t, j) {
        var v = groupTotal(r, t), ya = y(acc + v), yb = y(acc);
        // 段与段之间留 2px 白缝：上面的段让出底部 1px，下面的段让出顶部 1px
        if (j > 0) yb -= 1;
        if (j < segs.length - 1) ya += 1;
        if (yb - ya > 0.5) {
          var rad = j === segs.length - 1 ? Math.min(3, bw / 2, yb - ya) : 0;
          el(s, 'path', { d: 'M' + bx + ',' + yb + 'V' + (ya + rad) + 'Q' + bx + ',' + ya + ' ' + (bx + rad) + ',' + ya + 'H' + (bx + bw - rad) + 'Q' + (bx + bw) + ',' + ya + ' ' + (bx + bw) + ',' + (ya + rad) + 'V' + yb + 'Z', class: 'usage-seg usage-fill-' + t });
        }
        acc += v;
      });
      el(s, 'rect', { x: x, y: mt, width: step, height: H - mt - mb, class: 'usage-hit', 'data-day': k });
      var d = parseDay(k);
      if ((d.getDate() === 1 || i === 0) && x - lastLabelX > 40) {
        el(s, 'text', { x: x, y: H - 8, class: 'usage-ax' }, d.getDate() === 1 ? monthLabel(d) : md(k));
        lastLabelX = x;
      }
    });
    box.replaceChildren(s);
    $('#bars-legend').innerHTML = STACK.map(function (t) { return '<span><i class="usage-swatch usage-key-' + t + '"></i>' + group(t).name + '</span>'; }).join('');
  }

  // ---------- 模型表 ----------
  function renderModels() {
    var keep = D.models.length <= 12 ? D.models.length : 10;
    var rows = D.models.slice(0, keep), rest = D.models.slice(keep);
    if (rest.length) rows.push({ tool: null, name: TEXT.otherModels(rest.length), tokens: rest.reduce(function (s, m) { return s + m.tokens; }, 0) });
    var max = rows.length ? rows[0].tokens : 1;
    $('#models').innerHTML = '<thead><tr><th>' + TEXT.thTool + '</th><th>' + TEXT.thModel + '</th><th class="usage-num">' + TEXT.thTokens + '</th></tr></thead><tbody>' +
      rows.map(function (m) {
        var g = m.tool ? groupOfTool(m.tool) : null;
        return '<tr><td>' + (g ? '<i class="usage-dot usage-key-' + g.id + '"></i>' + esc(g.name) : '—') + '</td>' +
          '<td>' + esc(TEXT.modelNames[m.name] || m.name) + '<span class="usage-meter"><i style="width:' + (m.tokens / max * 100).toFixed(1) + '%"></i></span></td>' +
          '<td class="usage-num">' + num(m.tokens) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  // ---------- 每日明细表 ----------
  function renderDaily() {
    var days = Object.keys(D.days).sort().reverse();
    $('#daily').innerHTML = '<thead><tr><th>' + TEXT.thDate + '</th>' + STACK.map(function (id) { return '<th class="usage-num">' + esc(group(id).name) + '</th>'; }).join('') + '<th class="usage-num">' + TEXT.total + '</th></tr></thead><tbody>' +
      days.map(function (k) {
        var r = D.days[k];
        return '<tr><td>' + ymd(k) + (localEstimate(k) ? ' <span class="usage-est">' + TEXT.est + '</span>' : '') + '</td>' +
          STACK.map(function (id) { var v = groupTotal(r, id); return '<td class="usage-num">' + (v ? num(v) : '—') + '</td>'; }).join('') +
          '<td class="usage-num">' + num(dayTotal(k)) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  // ---------- 启动 ----------
  function renderCharts() { renderCalendar(); renderBars(); }
  $('#tool-chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.tool = b.getAttribute('data-tool');
    Array.prototype.forEach.call(document.querySelectorAll('#tool-chips button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderCalendar();
  });
  bindTips($('#calendar')); bindTips($('#bars'));

  function getJSON(url) {
    return fetch(url + '?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  // 官方累计数是另一个手动维护的文件，读不到时退回本机记录
  Promise.all([
    getJSON('data/ai-usage.json'),
    getJSON('data/ai-usage-official.json').catch(function () { return null; }),
  ]).then(function (res) {
    var data = res[0]; OFFICIAL = res[1];
    D = data; D.days = D.days || {}; D.seen = D.seen || []; D.estimated = D.estimated || []; D.models = D.models || []; D.tools = D.tools || [];
    renderFigures(); renderModels(); renderDaily(); renderCharts();
    var lastW = document.body.clientWidth, raf = 0;
    window.addEventListener('resize', function () {
      if (document.body.clientWidth === lastW) return; lastW = document.body.clientWidth;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(renderCharts);
    });
  }).catch(function () {
    $('#calendar').innerHTML = '<p class="empty-note">' + TEXT.loadError + '</p>';
  });
})();
