// 「AI 用量」页的图表和数字，中文页 usage.html 和英文页 en/usage.html 共用。
// 页面语言看 <html lang>，所有显示的文字都在下面的 TEXT 里。
(function () {
  var EN = /^en/i.test(document.documentElement.lang);
  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WD_ZH = '日一二三四五六';
  var WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var TEXT = EN ? {
    total: 'Total',
    estimate: 'ChatGPT figure is an estimate',
    seen: 'Used Claude, but no token record for this day',
    none: 'No use',
    calLabel: function (a, b) { return 'Usage calendar, ' + a + ' to ' + b; },
    heroLabel: function (y, m) { return 'Total since ' + MONTHS_LONG[m - 1] + ' ' + y; },
    heroDays: function (n) { return 'tokens across <strong>' + n + (n === 1 ? ' day' : ' days') + '</strong>'; },
    monthAdded: function (m, v) { return '+' + v + ' in ' + MONTHS_LONG[m - 1]; },
    streak: 'Current streak', peak: 'Busiest day', last30: 'Last 30 days',
    days: function (n) { return n + (n === 1 ? ' day' : ' days'); },
    curveLabel: 'Cumulative tokens over time, stacked by tool',
    curveSub: function (quiet, base) {
      return 'The steeper the curve, the heavier the use.' +
        (quiet ? ' Light use during ' + quiet + ', so the curve is almost flat there.' : '') +
        (base ? ' The ' + base + ' used earlier is counted in the starting point.' : '');
    },
    quietLabel: function (s) { return 'Light use, ' + s; },
    milestone: function (d, v) { return v + ' on ' + d; },
    todayLabel: function (v) { return 'Today ' + v; },
    cumTo: 'Total up to this day',
    thatDay: 'That day',
    thDate: 'Date', thMix: 'Mix', est: 'est.',
    monthHead: function (y, m) { return MONTHS_LONG[m - 1] + ' ' + y; },
    showAll: function (n) { return 'Show all ' + n + ' days'; },
    showLess: function (n) { return 'Show the latest ' + n + ' days'; },
    gptAsOf: function (t, d) { return ' Currently ' + t + ' in total, as of ' + d + '.'; },
    grokAsOf: function (s, t) { return ' The imported export covers ' + s + ', ' + t + ' in total.'; },
    updated: function (u) { return ' Last updated: ' + u + '.'; },
    otherModels: function (n) { return n + ' other models'; },
    thTool: 'Tool', thModel: 'Model', thTokens: 'Tokens',
    loadError: 'Usage data couldn’t be loaded. Please refresh later.',
    modelNames: { 'Grok 对话': 'Grok chat' },
  } : {
    total: '合计',
    estimate: 'ChatGPT 的数字是估算',
    seen: '用过 Claude，但没有当天的 token 记录',
    none: '没用',
    calLabel: function (a, b) { return '使用日历，' + a + ' 到 ' + b; },
    heroLabel: function (y, m) { return '从 ' + y + ' 年 ' + m + ' 月到今天，一共用了'; },
    heroDays: function (n) { return 'token，分布在 <strong>' + n + ' 天</strong>里'; },
    monthAdded: function (m, v) { return m + ' 月新增 ' + v; },
    streak: '连续使用', peak: '单日最高', last30: '最近 30 天',
    days: function (n) { return n + ' 天'; },
    curveLabel: '累计 token 随时间的变化，按工具叠起来',
    curveSub: function (quiet, base) {
      return '曲线越陡，那几天用得越多。' +
        (quiet ? quiet + '用得少，曲线几乎是平的。' : '') +
        (base ? '更早用过的 ' + base + ' 算在起点里。' : '');
    },
    quietLabel: function (s) { return s + '，用得少'; },
    milestone: function (d, v) { return d + ' 破 ' + v; },
    todayLabel: function (v) { return '今天 ' + v; },
    cumTo: '截至这天的累计',
    thatDay: '当天',
    thDate: '日期', thMix: '构成', est: '估算',
    monthHead: function (y, m) { return y + '年' + m + '月'; },
    showAll: function (n) { return '显示全部 ' + n + ' 天'; },
    showLess: function (n) { return '只显示最近 ' + n + ' 天'; },
    gptAsOf: function (t, d) { return '目前累计 ' + t + '，截至 ' + d + '。'; },
    grokAsOf: function (s, t) { return '目前导入的明细覆盖 ' + s + '，共 ' + t + '。'; },
    updated: function (u) { return '最后更新：' + u + '。'; },
    otherModels: function (n) { return '其他 ' + n + ' 个模型'; },
    thTool: '工具', thModel: '模型', thTokens: 'token',
    loadError: '用量数据暂时加载不出来，请稍后刷新。',
    modelNames: {},
  };

  // 按厂商分三栏，数据文件里的各个工具归到对应的厂商下。
  // 颜色写在 styles.css 的 .usage-key-*（图例、圆点、构成条）和 .usage-area-*（累计曲线）里
  var GROUPS = [
    { id: 'claude', name: 'Claude', tools: ['claude_code', 'cowork'] },
    // ChatGPT 有官方每日数据就只用官方数据（已经包含本机的 Codex），没有时退回本机记录
    { id: 'chatgpt', name: 'ChatGPT', tools: ['chatgpt', 'codex'], prefer: true },
    { id: 'grok', name: 'Grok', tools: ['grok'] },
  ];
  var STACK = GROUPS.map(function (g) { return g.id; });
  // 总览、累计曲线和每日明细按用量从大到小排：ChatGPT、Claude、Grok
  var ORDER = ['chatgpt', 'claude', 'grok'];
  var SHOW_DAYS = 10;
  var D = null, OFFICIAL = null;
  var state = { tool: 'all', expanded: false };
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
  // 把 "98.3 亿" / "9.83B" 拆成数字和单位，给总览的大数字用
  function splitNum(n) {
    var s = num(n), m = EN ? s.match(/^([\d.,]+)([KMB]?)$/) : s.match(/^([\d.,]+)\s*(\S*)$/);
    return m ? [m[1], m[2]] : [s, ''];
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
  function rowDate(s) { var d = parseDay(s); return EN ? WD_EN[d.getDay()] + ', ' + md(s) : md(s) + ' 周' + WD_ZH[d.getDay()]; }
  function monthLabel(d) { return EN ? MONTHS[d.getMonth()] : (d.getMonth() + 1) + '月'; }
  function span(a, b) { return EN ? md(a) + '–' + md(b) : md(a) + '到' + md(b); }

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
  // 每家的累计：ChatGPT 优先用官方累计，其次是手动填的官方数，最后是本机记录加起来；Grok 有手动官方数就用它
  function vendorTotals() {
    var t = { claude: 0, chatgpt: 0, grok: 0 };
    Object.keys(D.days).forEach(function (k) { ORDER.forEach(function (id) { t[id] += groupTotal(D.days[k], id); }); });
    var pick = function (id) { var o = OFFICIAL && OFFICIAL[id]; return o && o.tokens ? o : null; };
    var gpt = D.chatgpt && D.chatgpt.lifetime ? { tokens: D.chatgpt.lifetime, asOf: D.chatgpt.asOf } : pick('codex');
    // 官方累计只算到最后一个完整的日子，之后本机多记下的用量也算上，和累计曲线的终点对得上
    if (gpt) t.chatgpt = Math.max(t.chatgpt, gpt.tokens);
    var gk = pick('grok');
    if (gk) t.grok = Math.max(t.grok, gk.tokens);
    return { totals: t, gpt: gpt, grokOfficial: gk };
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
  function keyDot(id) { return '<i class="usage-dot usage-key-' + id + '"></i>'; }
  function dayTip(k) {
    var r = D.days[k], html = '<b>' + dayLabel(k) + '</b>';
    if (r) {
      ORDER.forEach(function (id) { var v = groupTotal(r, id); if (v) html += row(keyDot(id) + group(id).name, num(v)); });
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
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('[data-day], .usage-curve')) hideTip(); });

  // ---------- SVG ----------
  function svg(w, h, label) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('role', 'img'); s.setAttribute('aria-label', label);
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
  function legendHTML() {
    return ORDER.map(function (id) { return '<span><i class="usage-swatch usage-key-' + id + '"></i>' + group(id).name + '</span>'; }).join('');
  }

  // ---------- 总览 ----------
  function renderHero() {
    var v = vendorTotals(), t = v.totals, all = t.chatgpt + t.claude + t.grok;
    var used = usedDays();
    if (D.first) { var f = parseDay(D.first); $('#hero-label').textContent = TEXT.heroLabel(f.getFullYear(), f.getMonth() + 1); }
    var parts = splitNum(all);
    $('#hero-number').innerHTML = esc(parts[0]) + (parts[1] ? '<span>' + esc(parts[1]) + '</span>' : '');
    $('#hero-days').innerHTML = TEXT.heroDays(used.length);

    // 这个月新增多少
    var now = new Date(), prefix = key(now).slice(0, 7), monthSum = 0;
    Object.keys(D.days).forEach(function (k) { if (k.slice(0, 7) === prefix) monthSum += dayTotal(k); });
    var chip = $('#hero-month');
    chip.hidden = !(monthSum > 0);
    chip.textContent = monthSum > 0 ? TEXT.monthAdded(now.getMonth() + 1, num(monthSum)) : '';

    $('#hero-vendors').innerHTML = ORDER.map(function (id) {
      var share = all ? t[id] / all * 100 : 0;
      return '<div class="usage-vendor">' +
        '<span class="usage-vendor-name"><i class="usage-swatch usage-key-' + id + '"></i>' + group(id).name + '</span>' +
        '<span class="usage-vendor-bar"><i class="usage-key-' + id + '" style="width:' + share.toFixed(1) + '%"></i></span>' +
        '<span class="usage-vendor-total">' + num(t[id]) + '</span>' +
        '<span class="usage-vendor-share">' + (share >= 10 ? share.toFixed(0) : share.toFixed(1)) + '%</span>' +
        '</div>';
    }).join('');

    // 连续使用、单日最高、最近 30 天
    var set = {}; used.forEach(function (k) { set[k] = 1; });
    var cur = 0, d = new Date(); d.setHours(0, 0, 0, 0);
    if (!set[key(d)]) d = addDays(d, -1);
    while (set[key(d)]) { cur++; d = addDays(d, -1); }
    var peakDay = null, peak = 0;
    Object.keys(D.days).forEach(function (k) { var x = dayTotal(k); if (x > peak) { peak = x; peakDay = k; } });
    var last30 = 0;
    for (var i = 0; i < 30; i++) last30 += dayTotal(key(addDays(new Date(), -i)));
    $('#hero-mini').innerHTML = [
      [TEXT.streak, TEXT.days(cur)],
      [TEXT.peak, num(peak) + (peakDay ? '<small>' + md(peakDay) + '</small>' : '')],
      [TEXT.last30, num(last30)],
    ].map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('');
  }

  // ---------- 数据说明里的几个数字 ----------
  function renderNotes() {
    var v = vendorTotals(), grok = 0;
    Object.keys(D.days).forEach(function (k) { grok += D.days[k].grok || 0; });
    var gr = D.grok_range, grokSpan = gr && gr.from ? span(gr.from, gr.to) : '';
    $('#official-asof').textContent = v.gpt ? TEXT.gptAsOf(num(v.gpt.tokens), v.gpt.asOf ? ymd(v.gpt.asOf.slice(0, 10)) : '') : '';
    $('#grok-note').hidden = !(v.grokOfficial || grok);
    $('#grok-asof').textContent = grok ? TEXT.grokAsOf(grokSpan, num(grok)) : '';
    var u = D.updated ? D.updated.slice(0, 16) : '';
    $('#updated').textContent = u ? TEXT.updated(u) : '';
  }

  // ---------- 累计曲线 ----------
  // 从最后一段长时间没用（超过 30 天）之后开始画，更早的用量算进起点，图的左边就不会空一大截
  function curveSeries() {
    var used = Object.keys(D.days).filter(function (k) { return dayTotal(k) > 0; }).sort();
    if (!used.length) return null;
    var start = used[0];
    for (var i = 1; i < used.length; i++) if (diff(used[i - 1], used[i]) > 30) start = used[i];
    var base = { claude: 0, chatgpt: 0, grok: 0 };
    used.forEach(function (k) { if (k < start) ORDER.forEach(function (id) { base[id] += groupTotal(D.days[k], id); }); });
    var end = today(), n = diff(start, end) + 1, cum = { claude: base.claude, chatgpt: base.chatgpt, grok: base.grok }, out = [];
    for (var j = 0; j < n; j++) {
      var k = key(addDays(parseDay(start), j)), r = D.days[k];
      ORDER.forEach(function (id) { cum[id] += groupTotal(r, id); });
      out.push({ k: k, day: dayTotal(k), chatgpt: cum.chatgpt, claude: cum.claude, grok: cum.grok, all: cum.chatgpt + cum.claude + cum.grok });
    }
    return { start: start, pts: out, base: base.chatgpt + base.claude + base.grok };
  }
  // 最长的一段"用得少"：至少 21 天，每天都不到单日最高的 10%
  function quietRun(pts) {
    var max = Math.max.apply(null, pts.map(function (p) { return p.day; }).concat([0])), lim = max * 0.1;
    var best = null, runStart = -1;
    for (var i = 0; i <= pts.length; i++) {
      var quiet = i < pts.length && pts[i].day < lim;
      if (quiet && runStart < 0) runStart = i;
      if (!quiet && runStart >= 0) {
        if (!best || i - runStart > best[1] - best[0]) best = [runStart, i];
        runStart = -1;
      }
    }
    return best && best[1] - best[0] >= 21 ? { from: best[0], to: best[1] - 1 } : null;
  }
  function renderCurve() {
    var box = $('#curve'), series = curveSeries();
    $('#curve-legend').innerHTML = legendHTML();
    if (!series) { box.replaceChildren(); return; }
    var pts = series.pts, n = pts.length;
    var W = Math.max(300, box.clientWidth), narrow = W < 560;
    var H = narrow ? 240 : 320, ml = 52, mr = 12, mt = 24, mb = 30;
    var pw = W - ml - mr, ph = H - mt - mb;
    var nt = niceTicks(pts[n - 1].all, 4), top = nt.top;
    var x = function (i) { return ml + (n > 1 ? pw * i / (n - 1) : pw / 2); };
    var y = function (v) { return mt + ph * (1 - v / top); };
    var quiet = quietRun(pts);
    $('#curve-sub').textContent = TEXT.curveSub(quiet ? span(pts[quiet.from].k, pts[quiet.to].k) : '', series.base > 0 ? num(series.base) : '');

    var s = svg(W, H, TEXT.curveLabel);
    var pat = el(el(s, 'defs', {}), 'pattern', { id: 'usage-curve-stripes', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    el(pat, 'rect', { width: 4, height: 4, class: 'usage-chatgpt-bg' });
    el(pat, 'line', { x1: 0, y1: 0, x2: 0, y2: 4, class: 'usage-chatgpt-line' });
    if (quiet) el(s, 'rect', { x: x(quiet.from), y: mt, width: Math.max(1, x(quiet.to) - x(quiet.from)), height: ph, class: 'usage-curve-quiet' });
    nt.ticks.forEach(function (v) {
      el(s, 'line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: v ? 'usage-grid' : 'usage-base' });
      el(s, 'text', { x: ml - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'usage-ax' }, v ? num(v).replace(' ', '') : '0');
    });
    // 月份刻度
    var lastX = -99;
    pts.forEach(function (p, i) {
      var d = parseDay(p.k);
      if ((d.getDate() === 1 || i === 0) && x(i) - lastX > 36) {
        el(s, 'line', { x1: x(i), x2: x(i), y1: mt + ph, y2: mt + ph + 5, class: 'usage-base' });
        el(s, 'text', { x: x(i), y: H - 8, class: 'usage-ax' }, monthLabel(d));
        lastX = x(i);
      }
    });
    // 三层面积，从下往上：ChatGPT、Claude、Grok
    var line = function (fn) { return pts.map(function (p, i) { return x(i).toFixed(1) + ',' + y(fn(p)).toFixed(1); }); };
    var layers = [
      { id: 'chatgpt', up: function (p) { return p.chatgpt; }, low: function () { return 0; } },
      { id: 'claude', up: function (p) { return p.chatgpt + p.claude; }, low: function (p) { return p.chatgpt; } },
      { id: 'grok', up: function (p) { return p.all; }, low: function (p) { return p.chatgpt + p.claude; } },
    ];
    layers.forEach(function (L) {
      el(s, 'path', { d: 'M' + line(L.up).join('L') + 'L' + line(L.low).reverse().join('L') + 'Z', class: 'usage-area-' + L.id });
    });
    el(s, 'path', { d: 'M' + line(function (p) { return p.all; }).join('L'), class: 'usage-curve-line' });

    // 里程碑：累计第一次超过 1 亿、10 亿、50 亿、100 亿……的那天
    var labels = [], marks = [], thresholds = [1e8, 1e9, 5e9, 1e10, 2e10, 5e10, 1e11, 2e11, 5e11, 1e12];
    thresholds.forEach(function (th) {
      if (series.base >= th) return;
      for (var i = 0; i < n; i++) if (pts[i].all >= th) { marks.push({ i: i, v: th, text: TEXT.milestone(md(pts[i].k), num(th)) }); break; }
    });
    var leader = '', dots = '';
    var dot = function (px, py) { return 'M' + (px - 4.5).toFixed(1) + ',' + py.toFixed(1) + 'a4.5,4.5 0 1,0 9,0a4.5,4.5 0 1,0 -9,0'; };
    marks.forEach(function (m, j) {
      var px = x(m.i), py = y(m.v), right = px > ml + pw * 0.6;
      dots += dot(px, py);
      if (narrow) return;
      var dy = -(30 + (j % 2) * 34), dx = right ? -14 : 14;
      leader += 'M' + px.toFixed(1) + ',' + py.toFixed(1) + 'L' + (px + dx * 0.7).toFixed(1) + ',' + (py + dy * 0.7).toFixed(1);
      labels.push({ text: m.text, x: px + dx, y: py + dy, end: right });
    });
    var last = pts[n - 1];
    dots += dot(x(n - 1), y(last.all));
    labels.push({ text: TEXT.todayLabel(num(last.all)), x: x(n - 1) - 12, y: y(last.all) - 2, end: true });
    if (leader) el(s, 'path', { d: leader, class: 'usage-curve-leader' });
    el(s, 'path', { d: dots, class: 'usage-curve-dot' });

    // 悬停时显示竖线和那天的累计
    var cross = el(s, 'line', { x1: 0, x2: 0, y1: mt, y2: mt + ph, class: 'usage-curve-cross', visibility: 'hidden' });
    var hit = el(s, 'rect', { x: ml, y: mt, width: pw, height: ph, class: 'usage-curve-hit' });
    var move = function (e) {
      var rect = s.getBoundingClientRect(), px = e.clientX - rect.left;
      var i = Math.max(0, Math.min(n - 1, Math.round((px - ml) / pw * (n - 1))));
      var p = pts[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      var html = '<b>' + dayLabel(p.k) + '</b><div class="usage-tip-note">' + TEXT.cumTo + '</div>';
      ORDER.forEach(function (id) { if (p[id]) html += row(keyDot(id) + group(id).name, num(p[id])); });
      html += row(TEXT.total, num(p.all)) + row(TEXT.thatDay, num(p.day));
      showTip(e, html);
    };
    var leave = function (e) { if (e.pointerType !== 'touch') { cross.setAttribute('visibility', 'hidden'); hideTip(); } };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);

    var frag = document.createDocumentFragment();
    frag.appendChild(s);
    if (quiet && !narrow) {
      var q = document.createElement('span');
      q.className = 'usage-curve-note';
      q.style.left = ((x(quiet.from) + x(quiet.to)) / 2) + 'px';
      q.style.top = (mt + 8) + 'px';
      q.textContent = TEXT.quietLabel(span(pts[quiet.from].k, pts[quiet.to].k));
      frag.appendChild(q);
    }
    labels.forEach(function (l) {
      var t = document.createElement('span');
      t.className = 'usage-curve-label';
      t.style.left = l.x + 'px';
      t.style.top = l.y + 'px';
      t.style.transform = l.end ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
      t.textContent = l.text;
      frag.appendChild(t);
    });
    box.replaceChildren(frag);
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
    s.style.display = 'block';
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

  // ---------- 每日明细：按月分组，每天一行，构成条按单日最高的那天算长度 ----------
  function renderDaily() {
    var days = Object.keys(D.days).filter(function (k) { return dayTotal(k) > 0; }).sort().reverse();
    var maxDay = Math.max.apply(null, days.map(function (k) { return dayTotal(k); }).concat([1]));
    var head = '<div class="usage-daily-head" role="row"><span role="columnheader">' + TEXT.thDate + '</span><span role="columnheader">' + TEXT.thMix + '</span>' +
      ORDER.map(function (id) { return '<span role="columnheader" class="usage-num">' + group(id).name + '</span>'; }).join('') +
      '<span role="columnheader" class="usage-num">' + TEXT.total + '</span></div>';
    var months = [];
    days.forEach(function (k) {
      var m = k.slice(0, 7);
      if (!months.length || months[months.length - 1].m !== m) months.push({ m: m, days: [] });
      months[months.length - 1].days.push(k);
    });
    var shown = 0, html = head;
    months.forEach(function (mo) {
      var y = +mo.m.slice(0, 4), m = +mo.m.slice(5, 7);
      var sum = mo.days.reduce(function (s, k) { return s + dayTotal(k); }, 0);
      html += '<div class="usage-daily-month' + (shown >= SHOW_DAYS ? ' is-extra' : '') + '" role="row">' +
        '<span role="rowheader"><strong>' + TEXT.monthHead(y, m) + '</strong><small>' + TEXT.days(mo.days.length) + '</small></span>' +
        '<span role="cell" class="usage-strong">' + num(sum) + '</span></div>';
      mo.days.forEach(function (k) {
        var r = D.days[k];
        var mix = ORDER.map(function (id) {
          var v = groupTotal(r, id);
          return v > 0 ? '<i class="usage-key-' + id + '" style="width:' + (v / maxDay * 100).toFixed(2) + '%"></i>' : '';
        }).join('');
        html += '<div class="usage-daily-row' + (shown >= SHOW_DAYS ? ' is-extra' : '') + '" role="row">' +
          '<span role="cell">' + rowDate(k) + (localEstimate(k) ? ' <span class="usage-est">' + TEXT.est + '</span>' : '') + '</span>' +
          '<span role="cell" class="usage-mix">' + mix + '</span>' +
          ORDER.map(function (id) { var v = groupTotal(r, id); return '<span role="cell" class="usage-num">' + (v ? num(v) : '—') + '</span>'; }).join('') +
          '<span role="cell" class="usage-num usage-strong">' + num(dayTotal(k)) + '</span></div>';
        shown++;
      });
    });
    var box = $('#daily'), btn = $('#daily-more');
    box.innerHTML = html;
    box.classList.toggle('is-expanded', state.expanded);
    btn.hidden = days.length <= SHOW_DAYS;
    btn.textContent = state.expanded ? TEXT.showLess(SHOW_DAYS) : TEXT.showAll(days.length);
    btn.setAttribute('aria-expanded', String(state.expanded));
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
        return '<tr><td>' + (g ? keyDot(g.id) + esc(g.name) : '—') + '</td>' +
          '<td>' + esc(TEXT.modelNames[m.name] || m.name) + '<span class="usage-meter"><i style="width:' + (m.tokens / max * 100).toFixed(1) + '%"></i></span></td>' +
          '<td class="usage-num">' + num(m.tokens) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  // ---------- 启动 ----------
  function renderCharts() { renderCurve(); renderCalendar(); }
  $('#tool-chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.tool = b.getAttribute('data-tool');
    Array.prototype.forEach.call(document.querySelectorAll('#tool-chips button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderCalendar();
  });
  $('#daily-more').addEventListener('click', function () { state.expanded = !state.expanded; renderDaily(); });
  bindTips($('#calendar'));

  function getJSON(url) {
    return fetch(url + '?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  // 官方累计数是另一个手动维护的文件，读不到时退回本机记录
  Promise.all([
    getJSON('ai-usage/data/ai-usage.json'),
    getJSON('ai-usage/data/ai-usage-official.json').catch(function () { return null; }),
  ]).then(function (res) {
    var data = res[0]; OFFICIAL = res[1];
    D = data; D.days = D.days || {}; D.seen = D.seen || []; D.estimated = D.estimated || []; D.models = D.models || []; D.tools = D.tools || [];
    renderHero(); renderNotes(); renderModels(); renderDaily(); renderCharts();
    var lastW = document.body.clientWidth, raf = 0;
    window.addEventListener('resize', function () {
      if (document.body.clientWidth === lastW) return; lastW = document.body.clientWidth;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(renderCharts);
    });
  }).catch(function () {
    $('#curve').innerHTML = '<p class="empty-note">' + TEXT.loadError + '</p>';
  });
})();
