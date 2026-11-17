/**
 * Client module for the comic-forge plugin.
 *
 * Registers two slots, mirroring how dsh-client-ui-plugin-manager wires a
 * left-sidebar entry to a full main page:
 *   - `sidebar.panellist`  → the left-sidebar entry (icon + label). Clicking it
 *     activates this plugin's panel via ctx.layout.selectPanel(PANEL_ID).
 *   - `main` (key: PANEL_ID) → the plugin's full page shown in the main area.
 *
 * Both slots declare `locale: NS`. The dictionaries are registered in apply()
 * via ctx.locale.register(NS, { zh, en }) — exactly as dsh-client-ui-plugin-manager
 * does — and all visible text is resolved at render time with t = ctx.locale.bind(NS).
 *
 * Resources are registered inside apply(); each effect returns a disposer so the
 * host can tear them down cleanly.
 */
window.__ModuleLoader__.load({
  id: '@local/comic-forge',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // Locale dictionaries. Prefer the exported JSON files; if the client
    // `require` can't resolve a package ./locale/*.json export, fall back to
    // the embedded copy below so text always resolves. (Built-in plugins inline
    // their dictionaries; this keeps both paths working.)
    const FALLBACK = {
      en: {
        meta: { title: 'Comic workbench' },
        panel: 'Comics',
        project: { title: 'Night Train, Ep. 1', subtitle: 'Urban fantasy · 24 panels · about 8 pages · saved 2 min ago' },
        action: { history: 'History', continue: 'Continue', fix: 'Fix' },
        stage: { outline: 'Outline', characters: 'Characters', storyboard: 'Storyboard', render: 'Batch render', layout: 'Layout', export: 'Export' },
        meta: { outline: '3 acts · 1200 words', characters: '3 characters · locked', storyboard: '24 panels · 31 lines', render: '18 / 24 rendered', export: 'PDF / long strip' },
        state: { done: 'Done', doing: 'In progress', todo: 'Not started', locked: 'Locked' },
        chip: { logline: '1 logline', acts: '3 acts', lockOn: 'Character lock on', turnaround: '3 turnarounds', boardFields: 'Panels · dialogue · camera', pages: '8 pages', templates: '2 layout templates', formats: 'PDF / long strip / per-page', dpi: '300 DPI', consistency: 'Consistency 0.80' },
        q: { done: 'done', rendering: 'rendering', drift: 'character drift', queued: 'queued' },
        side: { consistency: 'Character consistency', engine: 'Render engine' },
        char: { lock: 'Character lock', lin: 'Lin Wan', 'lin.role': 'Lead · conductor', shen: 'Shen Mo', 'shen.role': 'Mysterious passenger', zhou: 'Lao Zhou', 'zhou.role': 'Train driver' },
        engine: { imagegen: 'dsh-image-gen', comfyui: 'ComfyUI' },
        style: { mono: 'B&W screentone' },
        next: { eyebrow: 'Next up', body: "Panel 19 shows character drift (Lin Wan's hair color shifted). Raise consistency strength and retry that panel." },
      },
      zh: {
        meta: { title: '漫画工作台' },
        panel: '漫画台',
        project: { title: '《夜行电车》第 1 话', subtitle: '都市怪谈 · 24 格 · 预计 8 页 · 最近保存 2 分钟前' },
        action: { history: '生成记录', continue: '继续制作', fix: '去处理' },
        stage: { outline: '故事大纲', characters: '人物设定', storyboard: '分镜脚本', render: '批量生图', layout: '排版台词', export: '导出' },
        meta: { outline: '3 幕 · 1200 字', characters: '3 个角色 · 已锁定', storyboard: '24 格 · 31 句台词', render: '18 / 24 已生成', export: 'PDF / 长图' },
        state: { done: '已完成', doing: '进行中', todo: '待开始', locked: '已锁定' },
        chip: { logline: '1 句 logline', acts: '3 幕结构', lockOn: '角色锁 开', turnaround: '三视图 3 套', boardFields: '格子 · 台词 · 镜头', pages: '8 页', templates: '2 套布局模板', formats: 'PDF / 长图 / 分页', dpi: '300 DPI', consistency: '一致性 0.80' },
        q: { done: '已完成', rendering: '生成中', drift: '角色漂移', queued: '排队中' },
        side: { consistency: '角色一致性', engine: '生成引擎' },
        char: { lock: '角色锁', lin: '林晚', 'lin.role': '主角 · 列车员', shen: '沈默', 'shen.role': '神秘乘客', zhou: '老周', 'zhou.role': '电车司机' },
        engine: { imagegen: 'dsh-image-gen', comfyui: 'ComfyUI' },
        style: { mono: '黑白网屏' },
        next: { eyebrow: '下一步', body: '格子 19 检测到角色漂移（林晚发色偏移），建议提高一致性强度后重试该格。' },
      },
    };

    function loadDict(lang) {
      const injected = (typeof window !== 'undefined' && window.__COMIC_FORGE_LOCALE__) || null;
      if (injected && injected[lang]) return injected[lang];
      const paths = ['./locale/' + lang + '.json', '@local/comic-forge/locale/' + lang + '.json'];
      for (const pth of paths) {
        try {
          const m = require(pth);
          return (m && m.default) ? m.default : m;
        } catch (e) { /* try next */ }
      }
      return FALLBACK[lang];
    }
    const dictionaries = { en: loadDict('en'), zh: loadDict('zh') };

    const PANEL_ID = 'comic-forge';
    const NS = 'ui-plugin-comic-forge';

    // Project data. Try the snapshot module; if the browser require can't
    // resolve it, fall back to a minimal embedded set so the page still
    // renders and the sidebar entry is never taken down by a data failure.
    const FALLBACK_DATA = { projects: [
      { id: 'night', name: '夜行电车', color: '#3b4a66', open: true, subs: [
        { id: 'ep1', name: '第 1 话 · 末班车', state: { overall: 0, counts: { panelsDone: 0, panelsTotal: 0, issues: 0 }, stages: {} }, outline: { acts: [] }, characters: [], board: [], renders: [] },
      ]},
      { id: 'shan', name: '山海食堂', color: '#7a5c3e', open: false, subs: [] },
    ]};
    let DATA = FALLBACK_DATA;
    try {
      const injected = (typeof window !== 'undefined' && window.__COMIC_FORGE_DATA__) || null;
      let m = null;
      if (injected) m = injected;
      else {
        for (const pth of ['./data.cjs', '@local/comic-forge/data.cjs']) {
          try { m = require(pth); break; } catch (e) { /* try next */ }
        }
      }
      if (m) DATA = (m && m.default) ? m.default : m;
    } catch (e) {
      // keep FALLBACK_DATA
    }

    /* ------------------------------------------------------------------ *
     * Scoped styles. Every selector is prefixed with [data-slot="main"] so
     * we never touch host chrome. Local ink vars guarantee contrast on both
     * light and dark themes.
     * ------------------------------------------------------------------ */
    const STYLE = `
      [data-slot="main"]{ --cf-accent:#2f5fc4; --cf-muted:#5b5f66; --cf-danger:#b4372a; --cf-warn-bg:#fdf3f1; --cf-warn-line:#e6c4bc; }
      [data-theme="dark"] [data-slot="main"]{ --cf-accent:#9dbaff; --cf-muted:#b7bcc3; --cf-danger:#ff9b8c; --cf-warn-bg:rgba(255,155,140,.10); --cf-warn-line:rgba(255,155,140,.35); }
      [data-slot="main"] .cf{ display:flex; height:100%; min-height:0; overflow:hidden; }
      [data-slot="main"] .cf-nav{ width:176px; flex:none; border-right:1px solid var(--dsh-line); padding:14px 10px; display:flex; flex-direction:column; gap:3px; background:var(--dsh-side); }
      [data-slot="main"] .cf-nav-b{ font-size:15px; font-weight:700; color:var(--dsh-fg); padding:0 10px 12px; letter-spacing:-.01em; }
      [data-slot="main"] .cf-nav-r{ height:34px; display:flex; align-items:center; gap:8px; padding:0 10px; border-radius:var(--dsh-radius-md); color:var(--cf-muted); font-size:13px; cursor:pointer; }
      [data-slot="main"] .cf-nav-r.on{ background:var(--dsh-hover); color:var(--dsh-fg); font-weight:500; }
      [data-slot="main"] .cf-nav-sec{ margin-top:12px; padding:0 10px 6px; font-size:11px; color:var(--cf-muted); }
      [data-slot="main"] .cf-tree{ width:264px; flex:none; border-right:1px solid var(--dsh-line); padding:16px 10px; overflow:auto; }
      [data-slot="main"] .cf-tree-h{ display:flex; align-items:center; justify-content:space-between; padding:0 8px 12px; }
      [data-slot="main"] .cf-tree-h b{ font-size:13px; color:var(--dsh-fg); }
      [data-slot="main"] .cf-tree-h span{ font-size:12px; color:var(--cf-accent); cursor:pointer; }
      [data-slot="main"] .cf-pn{ border-radius:var(--dsh-radius-md); padding:8px 10px; margin-bottom:4px; }
      [data-slot="main"] .cf-pn-row{ display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; color:var(--dsh-fg); }
      [data-slot="main"] .cf-cv{ width:24px; height:24px; border-radius:6px; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; flex:none; }
      [data-slot="main"] .cf-car{ margin-left:auto; color:var(--cf-muted); font-size:11px; }
      [data-slot="main"] .cf-subs{ margin:6px 0 0 16px; border-left:2px solid var(--dsh-line); padding-left:10px; }
      [data-slot="main"] .cf-sn{ display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:var(--dsh-radius-sm); font-size:13px; color:var(--cf-muted); cursor:pointer; }
      [data-slot="main"] .cf-sn:hover{ background:var(--dsh-hover); }
      [data-slot="main"] .cf-sn.on{ background:var(--cf-accent); color:#fff; }
      [data-slot="main"] .cf-sn-st{ margin-left:auto; font-size:11px; padding:1px 7px; border-radius:999px; background:var(--dsh-hover); color:var(--cf-muted); }
      [data-slot="main"] .cf-sn.on .cf-sn-st{ background:rgba(255,255,255,.25); color:#fff; }
      [data-slot="main"] .cf-wf{ flex:1; min-width:0; overflow:auto; padding:22px 28px 32px; display:flex; flex-direction:column; gap:18px; }
      [data-slot="main"] .cf-top{ display:flex; align-items:flex-start; gap:12px; }
      [data-slot="main"] .cf-top h1{ font-size:20px; font-weight:600; letter-spacing:-.01em; color:var(--dsh-fg); }
      [data-slot="main"] .cf-top-sub{ font-size:13px; color:var(--cf-muted); }
      [data-slot="main"] .cf-top-sp{ flex:1; }
      [data-slot="main"] .cf-btn{ height:32px; padding:0 14px; border-radius:var(--dsh-radius-sm); border:1px solid var(--dsh-line); background:var(--dsh-card); color:var(--dsh-fg); font:500 13px/1 var(--dsh-font); cursor:pointer; white-space:nowrap; }
      [data-slot="main"] .cf-btn:hover{ background:var(--dsh-hover); }
      [data-slot="main"] .cf-btn.pri{ background:var(--dsh-btn); color:var(--dsh-btn-fg); border-color:transparent; }
      [data-slot="main"] .cf-btn.pri:hover{ opacity:.9; }
      [data-slot="main"] .cf-hero{ display:flex; align-items:center; gap:26px; border:1px solid var(--dsh-line); border-radius:var(--dsh-radius-lg); background:var(--dsh-card); padding:16px 20px; }
      [data-slot="main"] .cf-hero-big{ font-size:34px; font-weight:600; letter-spacing:-.03em; color:var(--dsh-fg); }
      [data-slot="main"] .cf-hero-big small{ font-size:14px; color:var(--cf-muted); font-weight:400; margin-left:3px; }
      [data-slot="main"] .cf-hero-l{ font-size:12px; color:var(--cf-muted); }
      [data-slot="main"] .cf-hero-s b{ display:block; font-size:18px; font-weight:600; color:var(--dsh-fg); }
      [data-slot="main"] .cf-hero-sp{ flex:1; }
      [data-slot="main"] .cf-rib{ border:1px solid var(--dsh-line); border-radius:var(--dsh-radius-lg); background:var(--dsh-card); padding:18px 20px; }
      [data-slot="main"] .cf-rib-t{ font-size:12px; color:var(--cf-muted); margin-bottom:16px; }
      [data-slot="main"] .cf-track{ display:flex; align-items:flex-start; }
      [data-slot="main"] .cf-stage{ display:flex; flex-direction:column; align-items:center; gap:8px; flex:none; width:72px; cursor:pointer; }
      [data-slot="main"] .cf-stage-b{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; background:var(--dsh-hover); color:var(--cf-muted); }
      [data-slot="main"] .cf-stage.done .cf-stage-b{ background:var(--dsh-btn); color:var(--dsh-btn-fg); }
      [data-slot="main"] .cf-stage.doing .cf-stage-b{ background:var(--cf-accent); color:#fff; box-shadow:0 0 0 4px color-mix(in srgb, var(--cf-accent) 22%, transparent); }
      [data-slot="main"] .cf-stage.sel .cf-stage-b{ box-shadow:0 0 0 4px color-mix(in srgb, var(--cf-accent) 30%, transparent); }
      [data-slot="main"] .cf-stage-n{ font-size:12px; font-weight:500; text-align:center; color:var(--cf-muted); line-height:1.3; }
      [data-slot="main"] .cf-stage.doing .cf-stage-n{ color:var(--cf-accent); font-weight:600; }
      [data-slot="main"] .cf-stage.done .cf-stage-n{ color:var(--dsh-fg); }
      [data-slot="main"] .cf-conn{ flex:1; height:3px; border-radius:2px; background:var(--dsh-line); margin-top:16px; }
      [data-slot="main"] .cf-conn.done{ background:var(--dsh-btn); }
      [data-slot="main"] .cf-editor{ border:1px solid var(--dsh-line); border-radius:var(--dsh-radius-lg); background:var(--dsh-card); padding:18px 20px; }
      [data-slot="main"] .cf-ed-h{ display:flex; align-items:center; gap:10px; margin-bottom:14px; }
      [data-slot="main"] .cf-ed-tag{ font-size:11px; font-weight:600; color:var(--cf-accent); background:color-mix(in srgb, var(--cf-accent) 12%, transparent); padding:2px 9px; border-radius:999px; }
      [data-slot="main"] .cf-ed-t{ font-size:16px; font-weight:600; color:var(--dsh-fg); }
      [data-slot="main"] .cf-ed-sp{ flex:1; }
      [data-slot="main"] .cf-ed-hint{ font-size:12px; color:var(--cf-muted); }
      [data-slot="main"] .cf-items{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
      [data-slot="main"] .cf-item{ border:1px solid var(--dsh-line); border-radius:var(--dsh-radius-md); padding:12px; background:var(--dsh-bg); cursor:pointer; }
      [data-slot="main"] .cf-item:hover{ background:var(--dsh-hover); }
      [data-slot="main"] .cf-item .it{ font-size:13px; font-weight:500; color:var(--dsh-fg); margin-bottom:3px; }
      [data-slot="main"] .cf-item .im{ font-size:12px; color:var(--cf-muted); }
      [data-slot="main"] .cf-item.warn{ border-color:var(--cf-warn-line); background:var(--cf-warn-bg); }
      [data-slot="main"] .cf-item.warn .im{ color:var(--cf-danger); }
      [data-slot="main"] .cf-item.add{ border-style:dashed; color:var(--cf-muted); text-align:center; }
      @media (max-width:1100px){
        [data-slot="main"] .cf-nav{ display:none; }
        [data-slot="main"] .cf-tree{ width:220px; }
        [data-slot="main"] .cf-items{ grid-template-columns:repeat(2,1fr); }
      }
    `;

    /* ------------------------------------------------------------------ *
     * Icons (line icons, stroke=currentColor, inherit host theme)
     * ------------------------------------------------------------------ */
    const svgProps = (inner, size) => ({
      viewBox: '0 0 24 24', width: size || 16, height: size || 16, fill: 'none',
      stroke: 'currentColor', 'stroke-width': 1.75,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': true, dangerouslySetInnerHTML: { __html: inner },
    });
    const I = {
      grid: '<rect x="3.5" y="4.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="4.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 14v6M14 17h6"/>',
      doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 5M21 20a6 6 0 0 0-4-5.6"/>',
      board: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
      layout: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>',
      export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    };
    const icon = (k, size) => h('svg', svgProps(I[k], size));

    /* ------------------------------------------------------------------ *
     * Building blocks
     * ------------------------------------------------------------------ */
    function Dot({ tone, glyph }) {
      return h('span', { className: 'cf-dot ' + tone }, glyph);
    }

    function Stage({ n, name, meta, state, pct }) {
      return h('div', { className: 'cf-step ' + state },
        h('div', { className: 'cf-step-top' },
          h('span', { className: 'cf-num' }, String(n)),
          h('span', { className: 'cf-step-name' }, name)),
        h('div', { className: 'cf-step-meta' }, meta),
        h('div', { className: 'cf-bar' }, h('i', { style: { width: pct + '%' } })));
    }

    function Card({ icon: ic, title, pill, pillTone, doing, children }) {
      return h('div', { className: 'cf-card' + (doing ? ' cf-card-doing' : '') },
        h('div', { className: 'cf-card-head' },
          h('span', { className: 'cf-ico' }, icon(ic)),
          h('div', null, h('div', { className: 'cf-card-t' }, title)),
          h('span', { className: 'cf-pill ' + (pillTone || '') }, pill)),
        children);
    }

    function Chip({ on, children }) {
      return h('span', { className: 'cf-chip' + (on ? ' on' : '') }, children);
    }

    function Panel({ title, children }) {
      return h('div', { className: 'cf-panel' },
        h('div', { className: 'cf-panel-t' }, title), children);
    }

    /* Character portrait placeholder (geometric, theme-neutral) */
    function Portrait({ bg, fg }) {
      return h('span', { className: 'cf-av' },
        h('svg', { viewBox: '0 0 34 34', 'aria-hidden': true },
          h('rect', { width: 34, height: 34, fill: bg }),
          h('circle', { cx: 17, cy: 14, r: 6.5, fill: fg }),
          h('path', { d: 'M5 34c0-7 5.4-11 12-11s12 4 12 11z', fill: fg })));
    }

    /* ------------------------------------------------------------------ *
     * Main page. `t` resolves locale keys to strings for the active language.
     * ------------------------------------------------------------------ */
    /* ------------------------------------------------------------------ *
     * Main page. Chinese strings are written inline so the page renders
     * correctly without depending on the locale service resolving keys.
     * ------------------------------------------------------------------ */
    function ComicForgePage() {
      // Selected sub-task and which pipeline step is open for editing.
      const [sub, setSub] = React.useState('ep1');
      const [step, setStep] = React.useState(4);

      const projects = DATA.projects;
      const withSubs = projects.filter((pr) => pr.subs && pr.subs.length);
      const fallback = withSubs[0] || { name: '', subs: [{ id: '', name: '' }] };
      const cur = projects.find((pr) => pr.subs.some((x) => x.id === sub)) || fallback;
      const subObj = cur.subs.find((x) => x.id === sub) || cur.subs[0] || {};
      const st = subObj.state || {};
      const stages = st.stages || {};
      const counts = st.counts || {};

      const STEPN = ['故事大纲', '人物设定', '分镜脚本', '批量生图', '排版台词', '导出'];
      const KEY = ['outline', 'characters', 'storyboard', 'render', 'layout', 'export'];
      const steps = STEPN.map((nm, i) => {
        const sg = stages[KEY[i]] || {};
        return { n: i + 1, name: nm, state: sg.state || 'todo', pct: sg.progress || 0 };
      });

      function buildItems(n) {
        if (n === 1) {
          const ol = subObj.outline || {};
          const acts = (ol.acts || []).map((a) => ({ t: a.title, m: (a.range || '') + ' · ' + String(a.text || '').length + ' 字' }));
          return acts.length ? acts.concat([{ t: '＋ 新建大纲', m: '', add: true }]) : [{ t: '暂无大纲', m: '回会话说「写大纲」生成', add: false }];
        }
        if (n === 2) {
          const cs = (subObj.characters || []).map((c) => ({ t: c.name, m: c.role + ' · ' + (c.look || '').slice(0, 18) + '…', port: ['#dfe6f2', '#93a9ce'] }));
          return cs.length ? cs.concat([{ t: '＋ 新建角色', m: '', add: true }]) : [{ t: '暂无角色', m: '回会话说「做角色设定」生成' }];
        }
        if (n === 3) {
          const bd = subObj.board || [];
          const heads = bd.length ? [{ t: '共 ' + bd.length + ' 格', m: '台词 ' + bd.filter((x) => x.line).length + ' 句 · 镜头已标' }] : [{ t: '暂无分镜', m: '回会话说「拆分镜」生成' }];
          return heads.concat(bd.slice(0, 5).map((x) => ({ t: '格 ' + x.n, m: x.cam + (x.line ? ' · 「' + x.line + '」' : '') })));
        }
        if (n === 4) {
          const rs = subObj.renders || [];
          if (!rs.length) return [{ t: '暂无生图', m: '回会话说「批量生图」生成' }];
          const lab = { done: '已完成', doing: '生成中', warn: '角色漂移 · 建议重试', wait: '排队中' };
          return rs.map((r) => ({ t: '格子 ' + r.from + (r.to > r.from ? '–' + r.to : ''), m: lab[r.state] || r.state, warn: r.state === 'warn' }));
        }
        if (n === 5) return [{ t: (st.format || {}).pages || 8 + ' 页排版', m: '等生图完成' }, { t: '＋ 选择布局模板', m: '', add: true }];
        return [{ t: 'PDF / 长图', m: ((st.format || {}).dpi || 300) + ' DPI' }, { t: '＋ 导出', m: '', add: true }];
      }

      const subName = subObj.name || '';
      const curStep = steps.find((x) => x.n === step);
      const tagText = { done: '已完成', doing: '进行中', todo: '未开始' }[curStep.state] || '';
      const items = buildItems(step);

      const nav = h('nav', { className: 'cf-nav' },
        h('div', { className: 'cf-nav-b' }, '漫画工作台'),
        h('div', { className: 'cf-nav-r on' }, '项目'),
        h('div', { className: 'cf-nav-r' }, '模板库'),
        h('div', { className: 'cf-nav-sec' }, '最近'),
        h('div', { className: 'cf-nav-r' }, '夜行电车'),
        h('div', { className: 'cf-nav-r' }, '山海食堂'));

      const tree = h('aside', { className: 'cf-tree' },
        h('div', { className: 'cf-tree-h' }, h('b', null, '项目 / 子任务'), h('span', null, '＋ 新建')),
        projects.map((pr) => h('div', { className: 'cf-pn', key: pr.id },
          h('div', { className: 'cf-pn-row' },
            h('span', { className: 'cf-cv', style: { background: pr.color } }, pr.name[0]),
            pr.name,
            h('span', { className: 'cf-car' }, pr.open ? '▾' : '▸')),
          pr.open ? h('div', { className: 'cf-subs' },
            pr.subs.map((s) => h('div', {
              key: s.id,
              className: 'cf-sn' + (s.id === sub ? ' on' : ''),
              onClick: () => { setSub(s.id); setStep(1); },
            }, s.name, h('span', { className: 'cf-sn-st' }, s.pct >= 100 ? '完成' : s.pct + '%')))) : null)));

      const track = [];
      steps.forEach((s, i) => {
        if (i > 0) track.push(h('div', { key: 'c' + s.n, className: 'cf-conn' + (s.state === 'done' || s.state === 'doing' ? ' done' : '') }));
        track.push(h('div', {
          key: 's' + s.n,
          className: 'cf-stage ' + s.state + (s.n === step ? ' sel' : ''),
          onClick: () => setStep(s.n),
          title: '编辑：' + s.name,
        }, h('span', { className: 'cf-stage-b' }, s.state === 'done' ? '✓' : String(s.n)),
           h('span', { className: 'cf-stage-n' }, s.name)));
      });

      const editor = h('section', { className: 'cf-editor' },
        h('div', { className: 'cf-ed-h' },
          h('span', { className: 'cf-ed-tag' }, tagText),
          h('span', { className: 'cf-ed-t' }, '第 ' + step + ' 步 · ' + curStep.name),
          h('span', { className: 'cf-ed-sp' }),
          h('span', { className: 'cf-ed-hint' }, '点下面的条目进入编辑')),
        h('div', { className: 'cf-items' },
          items.map((it, i) => {
            const kids = [];
            if (it.port) kids.push(h(Portrait, { bg: it.port[0], fg: it.port[1] }));
            kids.push(h('div', { className: 'it' }, it.t));
            if (it.m) kids.push(h('div', { className: 'im' }, it.m));
            return h('div', { key: i, className: 'cf-item' + (it.warn ? ' warn' : '') + (it.add ? ' add' : '') }, kids);
          })));

      const wf = h('main', { className: 'cf-wf' },
        h('div', { className: 'cf-top' },
          h('div', null,
            h('h1', null, cur.name + ' · ' + subName),
            h('div', { className: 'cf-top-sub' }, '都市怪谈 · 24 格 · 预计 8 页')),
          h('div', { className: 'cf-top-sp' }),
          h('button', { className: 'cf-btn', type: 'button' }, '＋ 新增子任务'),
          h('button', { className: 'cf-btn pri', type: 'button' }, '继续制作')),
        h('div', { className: 'cf-hero' },
          h('div', null, h('div', { className: 'cf-hero-big' }, String(st.overall != null ? st.overall : 0), h('small', null, '%')), h('div', { className: 'cf-hero-l' }, '整体进度')),
          h('div', { className: 'cf-hero-s' }, h('b', null, steps.filter((x) => x.state === 'done').length + ' / 6'), h('div', { className: 'cf-hero-l' }, '已完成阶段')),
          h('div', { className: 'cf-hero-s' }, h('b', null, (counts.panelsDone != null ? counts.panelsDone : 0) + ' / ' + (counts.panelsTotal != null ? counts.panelsTotal : 0)), h('div', { className: 'cf-hero-l' }, '已生成格子')),
          h('div', { className: 'cf-hero-s' }, h('b', null, String(counts.issues != null ? counts.issues : 0)), h('div', { className: 'cf-hero-l' }, '待处理问题')),
          h('div', { className: 'cf-hero-sp' })),
        h('div', { className: 'cf-rib' },
          h('div', { className: 'cf-rib-t' }, '制作流水线 · 点任意阶段进入编辑'),
          h('div', { className: 'cf-track' }, track)),
        editor);

      return h('div', { className: 'cf' }, nav, tree, wf);
    }

    /* ------------------------------------------------------------------ *
     * Sidebar entry icon
     * ------------------------------------------------------------------ */
    function EntryIcon() {
      return icon('grid');
    }

    /* Error boundary: renders the real error on the page instead of a blank panel. */
    class ComicForgeBoundary extends React.Component {
      constructor(props) { super(props); this.state = { err: null }; }
      static getDerivedStateFromError(err) { return { err }; }
      componentDidCatch(err, info) {
        if (typeof console !== 'undefined') console.error('[comic-forge] render error', err, info);
      }
      render() {
        if (this.state.err) {
          const msg = (this.state.err && this.state.err.message) ? this.state.err.message : String(this.state.err);
          const stack = (this.state.err && this.state.err.stack) ? String(this.state.err.stack) : '';
          return h('div', { style: { padding: '20px', color: '#b4372a', font: '13px/1.5 monospace', whiteSpace: 'pre-wrap' } },
            h('div', { style: { fontWeight: 700, marginBottom: '8px' } }, '漫画台渲染出错'),
            h('div', null, msg),
            stack ? h('div', { style: { marginTop: '8px', color: '#6b6f76' } }, stack.slice(0, 1200)) : null);
        }
        return this.props.children;
      }
    }

    /* ------------------------------------------------------------------ *
     * Slot wiring
     * ------------------------------------------------------------------ */
    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        // Register dictionaries first (as plugin-manager does), then bind t.
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'comic-forge: dictionaries');
        const t = ctx.locale.bind(NS);
        const label = t('panel'); // resolve now; the entry shows a plain string

        // Scoped styles for the plugin page. Injected once, removed on dispose.
        ctx.effect(() => {
          if (typeof document === 'undefined') return undefined;
          const el = document.createElement('style');
          el.setAttribute('data-comic-forge', 'styles');
          el.textContent = STYLE;
          document.head.appendChild(el);
          return () => { el.remove(); };
        }, 'comic-forge: styles');

        ctx.effect(() => {
          // Left-sidebar entry row. Activates this plugin's panel on click.
          const disposeEntry = ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label, locale: NS },
              EntryIcon));

          // Full main page, keyed to the same panel id so selectPanel renders it.
          // Register as a component (h) so React.useState runs inside a render.
          const disposeMain = ctx.slots.inject('main', () =>
            ctx.slots.register(
              { name: 'main', key: PANEL_ID, locale: NS },
              () => h(ComicForgeBoundary, null, h(ComicForgePage, { t }))));

          return () => { disposeEntry(); disposeMain(); };
        }, 'comic-forge: slots');
      },
    };
  },
});