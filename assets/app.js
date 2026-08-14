/* =========================================================================
   Discovery Bank — mockup logic.
   String templates for rendering, one delegated click handler, screen
   transitions via cloned .screen nodes. No dependencies.
   ========================================================================= */
(function () {
  'use strict';

  var DB = window.DB, icon = window.icon;
  var $ = function (sel) { return document.querySelector(sel); };
  var viewport = $('#viewport'), appbarEl = $('#appbar'), tabbarEl = $('#tabbar'),
      sheetLayer = $('#sheetLayer'), sheetEl = $('#sheet'), toastLayer = $('#toastLayer');

  var STORE_KEY = 'discovery-mock-v1';

  /* Бесплатные выписки в месяц. Заказ ничем не ограничен — цифра только
     показывается в форме, счётчик до неё не блокирует кнопку. */
  var FREE_STATEMENTS = 15;

  /* Автоблокировка как в банковских приложениях:
     ушли из приложения дольше чем на LOCK_AWAY секунд — вход заново;
     не трогали экран LOCK_IDLE секунд — сессия закрывается сама. */
  var LOCK_AWAY = 15;
  var LOCK_IDLE = 5 * 60;
  var SEEN_KEY = 'discovery-mock-seen';

  /* ---------------------------------------------------------------- 1. State */
  var S = {
    screen: 'login',
    params: {},
    stack: [],
    authed: false,
    hide: false,
    frozen: false,
    tx: { q: '', month: 'all', card: 'all' },
    order: null,
    requests: []
  };

  function defaultOrder() {
    return {
      accountId: DB.ACCOUNTS[0].id,
      period: '3m',
      from: null,
      to: null,
      incl: { details: true, tx: true, cats: true },
      format: 'pdf',
      delivery: 'app'
    };
  }

  function save() {
    try {
      if (S.authed) localStorage.setItem(SEEN_KEY, String(Date.now()));
      localStorage.setItem(STORE_KEY, JSON.stringify({
        authed: S.authed, hide: S.hide, frozen: S.frozen,
        requests: S.requests, screen: S.authed ? S.screen : 'login'
      }));
    } catch (e) { /* private mode — nothing to persist */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      S.authed = !!d.authed;
      S.hide = !!d.hide;
      S.frozen = !!d.frozen;
      S.requests = (d.requests || []).map(function (r) {
        r.created = new Date(r.created);
        r.from = new Date(r.from);
        r.to = new Date(r.to);
        if (r.status === 'processing') r.status = 'ready';
        return r;
      });
    } catch (e) { /* corrupted storage is ignored */ }
  }

  /* ---------------------------------------------------------------- 2. Helpers */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* Формат сумм как в референсе: минус идёт после числа, дебет — красным. */
  function amount(v) {
    return 'R ' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function amountSigned(v) { return amount(v) + (v < 0 ? '-' : ''); }
  function money(v, force) { return (S.hide && !force) ? '••••••' : amount(v); }
  function moneySigned(v, force) { return (S.hide && !force) ? '••••••' : amountSigned(v); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dLong(dt) { return pad(dt.getDate()) + ' ' + MONTHS[dt.getMonth()] + ' ' + dt.getFullYear(); }
  function dShort(dt) { return pad(dt.getDate()) + ' ' + MON_SHORT[dt.getMonth()]; }
  function dNum(dt) { return pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear(); }
  function tTime(dt) { return pad(dt.getHours()) + ':' + pad(dt.getMinutes()); }
  function dayHeader(dt) { return WEEKDAYS[dt.getDay()] + ', ' + dLong(dt); }

  function monthStart(y, m) { return new Date(y, m, 1, 0, 0, 0); }
  function monthEnd(y, m) { return new Date(y, m + 1, 0, 23, 59, 59); }
  function cat(id) { return DB.CATEGORIES[id] || { label: id, icon: 'receipt' }; }

  /* ---------------------------------------------------------------- 3. Toasts and sheets */
  function toast(text, ms) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="toast__mark">' + icon('markSolid') + '</span><span>' + esc(text) + '</span>';
    toastLayer.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast--out');
      el.addEventListener('animationend', function () { el.remove(); });
    }, ms || 2400);
  }

  var sheetOpen = false;
  function openSheet(title, html) {
    sheetEl.innerHTML =
      '<div class="sheet__grip"></div>' +
      (title ? '<div class="sheet__title">' + esc(title) + '</div>' : '') +
      '<div class="sheet__body">' + html + '</div>';
    sheetLayer.hidden = false;
    sheetLayer.classList.remove('closing');
    sheetOpen = true;
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheetLayer.classList.add('closing');
    setTimeout(function () {
      sheetLayer.hidden = true;
      sheetLayer.classList.remove('closing');
      sheetEl.innerHTML = '';
    }, 240);
  }

  /* ---------------------------------------------------------------- 4. Shared blocks */
  function plastic(acc, big) {
    var cls = 'plastic' + (acc.art === 'dark' ? ' plastic--dark' : acc.art === 'vault' ? ' plastic--vault' : '') + (big ? ' plastic--big' : '');
    return '<div class="' + cls + '">' +
      '<div class="plastic__top">' +
        '<img class="plastic__logo" src="assets/brand/logo-card.png" alt="">' +
        '<span class="plastic__brand"><b>Discovery</b><i>Bank</i></span></div>' +
      '<span class="plastic__wave">' + icon('wave', { w: 1.8 }) + '</span>' +
      '<div class="plastic__chip"></div>' +
      '<div class="plastic__mark"><img src="assets/brand/logo-card.png" alt=""></div>' +
      (big && acc.pan ? '<div class="plastic__pan">' + esc(acc.pan) + '</div>' : '') +
      '<div class="plastic__foot">' +
        '<span class="plastic__tier">' + esc(acc.tier.toUpperCase()) + '</span>' +
        (acc.network ? '<span class="plastic__net">' + esc(acc.network) + '</span>' : '') +
      '</div></div>';
  }

  /* Мета-блок строки операции: тип, счета, категория — каждая строка отдельно,
     как в приложении-референсе. У расхода сначала «To:», у прихода — «From:». */
  function txMeta(t) {
    var acc = DB.ACCOUNTS[0].number;
    var lines = [t.type];
    var counter = t.from === acc ? t.to : t.from;
    if (counter && counter !== acc) {
      lines = lines.concat(t.amount < 0
        ? ['To: ' + counter, 'From: ' + acc]
        : ['From: ' + counter, 'To: ' + acc]);
    } else {
      lines.push(acc);
    }
    lines.push(cat(t.category).label);
    return lines.map(function (l) { return '<span class="tx__meta">' + esc(l) + '</span>'; }).join('');
  }

  function txRow(t) {
    return '<button class="tx" data-action="tx" data-id="' + t.id + '">' +
      '<span class="tx__ic">' + icon(cat(t.category).icon) + '</span>' +
      '<span class="tx__body">' +
        '<span class="tx__name">' + esc(t.merchant) + '</span>' + txMeta(t) +
      '</span>' +
      '<span class="tx__amt' + (t.amount < 0 ? ' tx__amt--out' : '') + ' num">' + moneySigned(t.amount) + '</span>' +
    '</button>';
  }

  function txGrouped(list) {
    if (!list.length) {
      return '<div class="empty">' + icon('search') + '<p>No transactions found.<br>Try a different period or search term.</p></div>';
    }
    var out = '', last = '';
    list.forEach(function (t) {
      var h = dayHeader(t.date);
      if (h !== last) { out += '<div class="daylabel">' + esc(h) + '</div>'; last = h; }
      out += txRow(t);
    });
    return out;
  }

  function row(o) {
    return '<button class="row' + (o.plain ? ' row--plain' : '') + (o.off ? ' row--off' : '') + '"' +
      (o.action ? ' data-action="' + o.action + '"' : '') +
      (o.id ? ' data-id="' + o.id + '"' : '') + '>' +
      (o.icon ? '<span class="row__ic">' + icon(o.icon) + '</span>' : '') +
      '<span class="row__body"><span class="row__label">' + esc(o.label) + '</span>' +
      (o.sub ? '<span class="row__sub">' + esc(o.sub) + '</span>' : '') + '</span>' +
      (o.meta ? '<span class="row__meta">' + o.meta + '</span>' : '') +
      (o.chev === false ? '' : '<span class="row__chev">' + icon('chevron') + '</span>') +
      '</button>';
  }

  /* ---------------------------------------------------------------- 5. Screen: log in */
  function renderLogin() {
    // Логотипа на экране входа нет — так же, как в референсном приложении
    return '<div class="login">' +
      '<div class="field">' +
        '<input class="field__input" id="f-user" type="text" placeholder="Username" autocomplete="username" spellcheck="false">' +
        '<button class="field__link" data-action="forgot">Forgot username?</button>' +
      '</div>' +
      '<div class="field">' +
        '<input class="field__input" id="f-pass" type="password" placeholder="Password" autocomplete="current-password">' +
        '<button class="field__eye" data-action="toggle-pass">' + icon('eye') + '</button>' +
        '<button class="field__link" data-action="forgot">Forgot password?</button>' +
      '</div>' +
      '<div class="login__spacer"></div>' +
      '<div class="btnrow">' +
        '<button class="btn btn--ghost" data-action="login-clear">Cancel</button>' +
        '<button class="btn btn--primary" data-action="login">Log in</button>' +
      '</div>' +
    '</div>';
  }

  function doLogin() {
    var u = $('#f-user'), p = $('#f-pass');
    if (!u.value.trim() || !p.value) { toast('Please enter your credentials to log in'); return; }
    // номер телефона сверяем по цифрам: +27 66 258 2832 и 0662582832 равнозначны
    var typed = u.value.replace(/[\s()-]/g, '');
    var expect = DB.USER.username;
    var ok = typed === expect || typed === expect.replace(/^\+27/, '0');
    if (!ok || p.value !== DB.USER.password) { toast('Incorrect username or password'); return; }
    S.authed = true;
    S.stack = [];
    save();
    resetIdle();
    go('home', {}, 'fade');
    setTimeout(function () { toast('Welcome back, ' + DB.USER.first); }, 380);
  }

  /* ---------------------------------------------------------------- 6. Screen: dashboard */
  var PRODUCTS = [
    { id: 'bank',   label: 'Bank',   icon: 'bank', on: true },
    { id: 'health', label: 'Health', icon: 'heart' },
    { id: 'life',   label: 'Life',   icon: 'shield' },
    { id: 'invest', label: 'Invest', icon: 'chart' },
    { id: 'insure', label: 'Insure', icon: 'house' }
  ];

  function homeAppbar() {
    return '<div class="appbar__row">' +
        '<div class="appbar__side">' +
          '<button class="iconbtn stack" data-action="inbox">' + icon('mail') +
            '<span class="badge num">167</span></button>' +
        '</div>' +
        '<div class="appbar__title">Bank <span style="width:18px;height:18px;color:var(--ink)">' + icon('chevronUp', { w: 2 }) + '</span></div>' +
        '<div class="appbar__side appbar__side--right">' +
          '<button class="ai-pill" data-action="assistant"><i></i>AI</button>' +
        '</div>' +
      '</div>' +
      '<div class="products">' +
        PRODUCTS.map(function (p) {
          return '<button class="product' + (p.on ? ' product--on' : '') + '" data-action="product" data-id="' + p.id + '">' +
            '<span class="product__ic">' + icon(p.icon) +
              (p.on ? '' : '<span class="product__plus">' + icon('plus') + '</span>') + '</span>' +
            '<span>' + p.label + '</span></button>';
        }).join('') +
      '</div><div class="rule"></div>';
  }

  function renderHome() {
    var total = DB.portfolio(), avail = DB.portfolioAvailable();

    var cards = '<button class="acard" data-action="tab" data-id="accounts">' +
      '<span class="acard__art">' + plastic(DB.ACCOUNTS[0]) + '</span>' +
      '<span class="acard__body">' +
        '<span class="acard__name">Bank Portfolio</span>' +
        '<span class="acard__type">' + DB.ACCOUNTS.length + (DB.ACCOUNTS.length === 1 ? ' account' : ' accounts') + '</span>' +
        '<span class="acard__amt num">' + money(total) + '</span>' +
        '<span class="acard__lbl">Total balance</span>' +
        '<span class="acard__amt acard__amt--2 num">' + money(avail) + '</span>' +
        '<span class="acard__lbl">Your available balance</span>' +
      '</span></button>';

    cards += DB.ACCOUNTS.map(function (a) {
      return '<button class="acard" data-action="account" data-id="' + a.id + '">' +
        '<span class="acard__art">' + plastic(a) + '</span>' +
        '<span class="acard__body">' +
          '<span class="acard__name">' + esc(a.shortName || a.name) + '</span>' +
          '<span class="acard__type">' + esc(a.number) + '</span>' +
          '<span class="acard__amt num">' + moneySigned(a.balance) + '</span>' +
          '<span class="acard__lbl">' + (a.kind === 'credit' ? 'Outstanding balance' : 'Total balance') + '</span>' +
          '<span class="acard__amt acard__amt--2 num">' + money(a.available) + '</span>' +
          '<span class="acard__lbl">' + (a.kind === 'credit' ? 'Available credit' : 'Available balance') + '</span>' +
        '</span></button>';
    }).join('');

    var dots = '<div class="dots" id="dots">' +
      DB.ACCOUNTS.concat([0]).map(function (_, i) {
        return '<span class="dot' + (i === 0 ? ' dot--on' : '') + '"></span>';
      }).join('') + '</div>';

    var mStart = monthStart(DB.TODAY.getFullYear(), DB.TODAY.getMonth());
    var spent = DB.spend(DB.txFor('all', mStart, DB.TODAY));
    var pct = Math.min(100, Math.round(spent / DB.BUDGET * 100));

    var behaviours = DB.BEHAVIOURS.map(function (b) {
      return '<button class="behaviour' + (b.on ? ' behaviour--on' : '') + '" data-action="behaviour" data-id="' + b.id + '">' +
        '<span class="ring" style="--p:' + b.p + ';--arc:' + (b.on ? 'var(--magenta)' : 'var(--navy)') + '">' +
          '<span class="ring__pip"></span><span class="ring__ic">' + icon(b.icon) + '</span></span>' +
        '<span>' + b.label + '</span></button>';
    }).join('');

    return '<div class="hello">' +
        '<span class="avatar">' + DB.USER.initials + '</span>' +
        '<span><span class="hello__name">' + DB.USER.first + ' ' + DB.USER.last + '</span>' +
        '<span class="hello__sub">Client since ' + DB.USER.since + ' · ' + DB.USER.tier + '</span></span>' +
      '</div>' +

      '<div class="sechead"><h2>Accounts</h2>' +
        '<button class="iconbtn" data-action="hide">' + icon(S.hide ? 'eyeOff' : 'eye') + '</button></div>' +
      '<div class="carousel" id="carousel">' + cards + '</div>' + dots +

      '<div class="momentum">' +
        '<div class="momentum__head">' +
          '<span class="momentum__title">Vitality Money</span>' +
          '<button class="momentum__status" data-action="momentum">Bronze Status' + icon('chevron', { w: 2 }) + '</button>' +
        '</div>' +
        '<div class="panel"><div class="panel__title">Financial Behaviours</div>' +
          '<div class="behaviours">' + behaviours + '</div></div>' +
        '<div class="panel"><div class="panel__title">Financial Analyser</div>' +
          '<div class="analyser">' +
            '<div class="donut" style="--p:' + pct + '"><span class="donut__pct num">' + pct + '%</span></div>' +
            '<div><div class="analyser__amt num">' + money(DB.BUDGET) + '</div>' +
              '<div class="analyser__lbl">Monthly budget</div>' +
              '<div class="legend">' +
                '<span class="legend__i"><i class="legend__sw"></i>Spent ' + money(spent) + '</span>' +
                '<span class="legend__i"><i class="legend__sw legend__sw--track"></i>Left ' + money(Math.max(0, DB.BUDGET - spent)) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="actions">' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('swap') + '</span><span>Transfer</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('payshap') + '</span><span>PayShap</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('bolt') + '</span><span>Pay bills</span></button>' +
        '<button class="action" data-action="statements"><span class="action__ic">' + icon('doc') + '</span><span>Statement</span></button>' +
      '</div>' +

      '<div class="sechead" style="padding-top:18px"><h2 style="font-size:19px">Recent transactions</h2>' +
        '<button class="sechead__link" data-action="tab" data-id="transact">See all</button></div>' +
      DB.TX.slice(0, 5).map(txRow).join('');
  }

  /* ---------------------------------------------------------------- 7. Screen: accounts */
  function renderAccounts() {
    var rows = DB.ACCOUNTS.map(function (a) {
      return '<button class="row" data-action="account" data-id="' + a.id + '">' +
        '<span class="row__ic">' + icon(a.kind === 'credit' ? 'cards' : a.kind === 'savings' ? 'piggy' : 'bank') + '</span>' +
        '<span class="row__body"><span class="row__label">' + esc(a.shortName || a.name) + '</span>' +
          '<span class="row__sub">' + esc(a.type) + ' · ' + esc(a.number) + '</span></span>' +
        '<span class="row__meta"><span class="num">' + moneySigned(a.balance) + '</span>' +
          '<span class="row__sub num">' + money(a.available) + ' available</span></span>' +
        '<span class="row__chev">' + icon('chevron') + '</span></button>';
    }).join('');

    return '<div class="sechead"><h2>Portfolio</h2>' +
        '<button class="iconbtn" data-action="hide">' + icon(S.hide ? 'eyeOff' : 'eye') + '</button></div>' +
      '<div style="padding:0 20px 16px">' +
        '<div class="acard" style="display:block;padding:16px">' +
          '<div class="acard__lbl">Total balance</div>' +
          '<div class="t-display num" style="margin-top:2px">' + money(DB.portfolio()) + '</div>' +
          '<div class="acard__lbl" style="margin-top:10px">Your available balance ' + money(DB.portfolioAvailable()) + '</div>' +
        '</div></div>' +
      '<div class="group"><div class="group__head">My accounts</div>' + rows + '</div>' +
      '<div class="group"><div class="group__head">Documents</div>' +
        row({ icon: 'doc', label: 'Order a statement', sub: 'PDF or CSV by email', action: 'order' }) +
        row({ icon: 'docs', label: 'My statements', sub: S.requests.length ? S.requests.length + ' requests' : 'No requests yet', action: 'statements' }) +
      '</div>';
  }

  function renderAccount(p) {
    var a = DB.account(p.id);
    if (!a) return '<div class="empty"><p>Account not found</p></div>';

    var kv = [
      ['Account number', a.number],
      ['Account type', a.type],
      ['Branch code', DB.BANK.branch],
      ['SWIFT', DB.BANK.swift],
      ['Currency', DB.BANK.currency]
    ];
    if (a.kind === 'savings') kv.push(['Interest rate', a.rate.toFixed(2) + '% p.a.']);
    if (a.kind === 'credit') {
      kv.push(['Credit limit', amount(a.limit)]);
      kv.push(['Interest rate', a.rate.toFixed(2) + '% p.a.']);
    }

    return '<div class="cards-hero">' + plastic(a, true) + '</div>' +
      '<div style="padding:16px 20px 4px;text-align:center">' +
        '<div class="acard__lbl">' + (a.kind === 'credit' ? 'Outstanding balance' : 'Total balance') + '</div>' +
        '<div class="t-display num">' + moneySigned(a.balance) + '</div>' +
        '<div class="acard__lbl" style="margin-top:4px">' +
          (a.kind === 'credit' ? 'Available credit ' : 'Your available balance ') + money(a.available) + '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('swap') + '</span><span>Transfer</span></button>' +
        '<button class="action" data-action="details" data-id="' + a.id + '"><span class="action__ic">' + icon('receipt') + '</span><span>Details</span></button>' +
        '<button class="action" data-action="order-for" data-id="' + a.id + '"><span class="action__ic">' + icon('doc') + '</span><span>Statement</span></button>' +
        '<button class="action" data-action="freeze"><span class="action__ic">' + icon('lock') + '</span><span>' + (S.frozen ? 'Unfreeze' : 'Freeze') + '</span></button>' +
      '</div>' +
      '<div class="hr"></div>' +
      '<div class="kvlist">' + kv.map(function (r) {
        return '<div class="kv"><span class="kv__k">' + esc(r[0]) + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="sechead" style="padding-top:8px"><h2 style="font-size:19px">Transactions</h2>' +
        '<button class="sechead__link" data-action="history-for" data-id="' + a.id + '">See all</button></div>' +
      txGrouped(DB.txFor(a.id).slice(0, 12));
  }

  /* ---------------------------------------------------------------- 8. Screen: history */
  function filteredTx() {
    var from = null, to = null;
    if (S.tx.month !== 'all') {
      var parts = S.tx.month.split('-');
      from = monthStart(+parts[0], +parts[1]);
      to = monthEnd(+parts[0], +parts[1]);
    }
    var list = DB.txFor(null, from, to);
    if (S.tx.card !== 'all') list = list.filter(function (t) { return t.card === S.tx.card; });
    var q = S.tx.q.trim().toLowerCase();
    if (q) {
      list = list.filter(function (t) {
        return t.merchant.toLowerCase().indexOf(q) !== -1 ||
               cat(t.category).label.toLowerCase().indexOf(q) !== -1 ||
               t.type.toLowerCase().indexOf(q) !== -1 ||
               t.ref.toLowerCase().indexOf(q) !== -1;
      });
    }
    return list;
  }

  function renderTransact() {
    var list = filteredTx(), tot = DB.totals(list);

    var monthChips = '<button class="chip' + (S.tx.month === 'all' ? ' chip--on' : '') + '" data-action="m" data-id="all">All months</button>' +
      DB.monthList().map(function (m) {
        var k = m.year + '-' + m.month;
        return '<button class="chip' + (S.tx.month === k ? ' chip--on' : '') + '" data-action="m" data-id="' + k + '">' +
          MONTHS[m.month] + '</button>';
      }).join('');

    var accChips = '<button class="chip' + (S.tx.card === 'all' ? ' chip--on' : '') + '" data-action="a" data-id="all">All cards</button>' +
      DB.CARDS.map(function (c) {
        return '<button class="chip' + (S.tx.card === c.last4 ? ' chip--on' : '') + '" data-action="a" data-id="' + c.last4 + '">' +
          '***' + c.last4 + '</button>';
      }).join('');

    return '<div class="searchbar"><div class="search">' + icon('search') +
        '<input id="f-q" type="search" placeholder="Search transactions" value="' + esc(S.tx.q) + '">' +
        '<button data-action="filter-sheet" style="color:var(--navy)">' + icon('filter') + '</button>' +
      '</div></div>' +
      '<div class="chips">' + monthChips + '</div>' +
      '<div class="chips" style="padding-top:0">' + accChips + '</div>' +
      '<div class="summary">' +
        '<div class="summary__i"><div class="summary__lbl">Money in</div>' +
          '<div class="summary__val num">' + money(tot.in) + '</div></div>' +
        '<div class="summary__i"><div class="summary__lbl">Money out</div>' +
          '<div class="summary__val num">' + money(tot.out) + '</div></div>' +
      '</div>' +
      '<div style="padding:0 20px 12px"><button class="btn btn--quiet btn--wide" data-action="order-current">' +
        icon('doc') + 'Statement for this selection</button></div>' +
      txGrouped(list);
  }

  function openTx(id) {
    var t = DB.TX.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var a = DB.account(t.accountId), c = cat(t.category);
    var rows = [
      ['Account', a.number],
      ['Category', c.label],
      ['Date', dLong(t.date) + ', ' + tTime(t.date)],
      ['Type', t.type],
      ['Reference', t.ref],
      ['Balance after', amountSigned(t.balanceAfter)]
    ];
    if (t.card) rows.splice(1, 0, ['Card', '***' + t.card]);
    if (t.from) rows.splice(3, 0, ['From', t.from]);
    if (t.to) rows.splice(t.from ? 4 : 3, 0, ['To', t.to]);
    if (t.note) rows.splice(3, 0, ['Description', t.note]);

    openSheet(null,
      '<div style="display:flex;align-items:flex-start;gap:13px;margin-bottom:14px">' +
        '<span class="tx__ic" style="width:46px;height:46px;flex:0 0 46px">' + icon(c.icon) + '</span>' +
        '<span style="flex:1 1 auto;min-width:0">' +
          '<span class="t-section" style="display:block">' + esc(t.merchant) + '</span>' +
          '<span class="t-cap">' + esc(c.label) + '</span></span>' +
        '<span class="t-hero num"' + (t.amount < 0 ? ' style="color:var(--debit)"' : '') + '>' + amountSigned(t.amount) + '</span>' +
      '</div>' +
      '<div class="kvlist" style="padding:0">' + rows.map(function (r) {
        return '<div class="kv"><span class="kv__k">' + esc(r[0]) + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="btnrow" style="margin-top:16px">' +
        '<button class="btn btn--ghost" data-action="soon">Dispute</button>' +
        '<button class="btn btn--primary" data-action="proof" data-id="' + t.id + '">Proof of payment</button>' +
      '</div>');
  }

  /* ---------------------------------------------------------------- 9. Screen: cards */
  function renderCards() {
    var a = DB.ACCOUNTS[0];
    return '<div class="cards-hero">' + plastic(a, true) +
        '<div style="text-align:center">' +
          '<div class="t-section">' + esc(DB.CARDS[0].name) + '</div>' +
          '<div class="t-cap">' + esc(DB.CARDS[0].pan) + ' · ' + (S.frozen ? 'Frozen' : 'Active') + '</div>' +
        '</div></div>' +
      '<div class="actions">' +
        '<button class="action" data-action="freeze"><span class="action__ic">' + icon('lock') + '</span><span>' + (S.frozen ? 'Unfreeze' : 'Freeze') + '</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('settings') + '</span><span>Limits</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('globe') + '</span><span>Travel</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('bell') + '</span><span>Alerts</span></button>' +
      '</div>' +
      '<div class="group" style="margin-top:12px"><div class="group__head">All cards</div>' +
        DB.CARDS.map(function (c) {
          return row({
            icon: 'cards', label: c.name, sub: c.kind + ' · ***' + c.last4,
            meta: '<span class="num">' + money(a.available) + '</span>',
            action: 'card', id: c.last4
          });
        }).join('') +
      '</div>' +
      '<div class="group"><div class="group__head">Security</div>' +
        row({ icon: 'lock', label: 'Change PIN', action: 'soon' }) +
        row({ icon: 'shield', label: 'Virtual card', action: 'soon' }) +
        row({ icon: 'bolt', label: 'One-click payments', action: 'soon' }) +
      '</div>';
  }

  /* ---------------------------------------------------------------- 10. Screen: more */
  function renderMore() {
    return '<div class="group" style="border-top:0">' +
        row({ icon: 'travel', label: 'Travel', action: 'soon' }) +
        row({ icon: 'payshap', label: 'PayShap', action: 'soon' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Discovery Pay</div>' +
        row({ icon: 'seal', label: 'Contact Payments', action: 'soon' }) +
        row({ icon: 'heart', label: 'Health Pay', action: 'soon' }) +
        row({ icon: 'tick', label: 'Vitality Pay', action: 'soon' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Document repository</div>' +
        row({ icon: 'doc', label: 'Statements', sub: 'Order and request history', action: 'statements' }) +
        row({ icon: 'docs', label: 'Other Documents', action: 'soon' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Manage</div>' +
        row({ icon: 'plus', label: 'Add Account', action: 'soon' }) +
        row({ icon: 'settings', label: 'Channel settings', off: true }) +
        row({ icon: 'bell', label: 'Notifications', action: 'soon' }) +
        row({ icon: 'user', label: 'Profile and details', action: 'profile' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Help</div>' +
        row({ icon: 'info', label: 'How to use this app', sub: 'Step-by-step guide for first-time users', action: 'guide' }) +
      '</div>' +
      '<div style="position:sticky;bottom:0;padding:14px 20px 16px;background:linear-gradient(180deg,rgba(255,255,255,0),var(--surface) 34%)">' +
        '<button class="btn btn--primary btn--wide" data-action="logout">Log out</button></div>';
  }

  /* ---------------------------------------------------------------- 10b. Screen: guide */
  /* Инструкция для первого запуска. Пути к настройкам — для Galaxy A54
     на Android 16 (One UI 8); формулировки в других сборках могут
     отличаться на слово, но разделы называются так же. */
  function renderGuide() {
    function sec(n, title, html) {
      return '<section class="guide__sec">' +
        '<div class="guide__h"><span class="guide__n">' + n + '</span>' +
        '<h3>' + title + '</h3></div>' + html + '</section>';
    }
    function ol(items) { return '<ol>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ol>'; }

    return '<div class="guide">' +
      '<p class="guide__lead">A short walkthrough for your first time in the app. ' +
      'Written for a Galaxy A54 on Android 16 (One UI 8) — other Android phones work the same way, ' +
      'the settings may just be named slightly differently.</p>' +

      sec(1, 'Put the app on your Home screen', 
        '<p>The app opens in the browser, but it can live on the Home screen like any other app — ' +
        'full screen, without the address bar.</p>' + ol([
        'Open the app link in <b>Chrome</b> (or Samsung Internet).',
        'In Chrome tap <b>⋮</b> in the top right corner → <b>Add to Home screen</b> → <b>Install</b>, then confirm.',
        'In Samsung Internet tap <b>☰</b> in the bottom right corner → <b>Add page to</b> → <b>Home screen</b> → <b>Add</b>.',
        'The <b>Discovery Bank</b> icon appears on the Home screen and in the app list.',
        'Open it from the icon — the app runs full screen and remembers you between sessions.',
        'To remove it later, press and hold the icon → <b>Remove</b>.'
      ]) + '<p class="guide__note">If Chrome offers <b>Add shortcut</b> instead of <b>Install</b>, ' +
        'reload the page and try again — the shortcut is just a bookmark and opens with the address bar.</p>') +

      sec(2, 'Log in and log out', ol([
        'Tap the <b>Discovery Bank</b> icon on your Home screen.',
        'In <b>Username</b> type your mobile number: <b>+27 66 258 2832</b>. The short form <b>0662582832</b> works too.',
        'In <b>Password</b> type your 4-digit code. The eye icon on the right shows what you typed.',
        'Tap <b>Log in</b>. You are greeted by name and the Home screen opens.',
        'To leave: bottom bar → <b>More</b> → scroll down → <b>Log out</b> → confirm. Your data stays, only the session ends.'
      ]) + '<p class="guide__note">If the phone keyboard covers the buttons, swipe down on the screen to hide it.</p>') +

      sec(3, 'The app locks itself', 
        '<p>Your money is protected even if you put the phone down or hand it to someone.</p>' + ol([
        'Switch to another app, take a call or lock the screen for more than <b>15 seconds</b> — ' +
          'coming back you have to log in again.',
        'Leave the app open but do not touch it for <b>5 minutes</b> — the session closes by itself.',
        'Close the app completely — the next start always begins with the login screen.',
        'While the app is in the background the screen is covered, so no balances show up in the recent-apps list.'
      ]) + '<p class="guide__note">The same happens when you jump to your email app from a statement: come back ' +
        'and log in again. Nothing is lost — the statement is waiting in <b>More → Statements</b>.</p>') +

      sec(4, 'Save your password and unlock with biometrics', 
        '<p>The app runs on the phone\'s browser engine, so it does not ask for a fingerprint itself — ' +
        'your phone\'s password manager does that for you.</p>' + ol([
        'The first time you log in, Samsung Pass or Google offers <b>Save password</b> — tap <b>Save</b>.',
        'Next time, tap the <b>Username</b> field. A suggestion bar appears above the keyboard — tap your saved entry.',
        'The phone asks you to confirm: put your finger on the fingerprint sensor in the lower part of the screen. Both fields fill in.',
        'To choose which manager fills passwords: <b>Settings → General management → Passwords, passkeys and autofill → Autofill service</b>.',
        'To check that biometrics are set up: <b>Settings → Security and privacy → Biometrics</b>.'
      ]) + '<p class="guide__note">The A54 has a fingerprint sensor and face recognition. Face recognition on this model uses the ' +
        'front camera and counts as less secure, so password managers usually accept the fingerprint only. ' +
        'Face ID is an Apple feature and does not exist on Samsung phones.</p>') +

      sec(5, 'Check your balance', ol([
        'Open the <b>Home</b> tab in the bottom bar.',
        'Under <b>Accounts</b> the first card is <b>Bank Portfolio</b>: <b>Total balance</b> on top, <b>Your available balance</b> below.',
        'Swipe the card to the left to see the account itself.',
        'The eye icon next to the word <b>Accounts</b> hides and shows all amounts — handy in public.',
        'Tap a card to open the account: balance, account number, branch code and SWIFT.'
      ])) +

      sec(6, 'Look through your transactions', ol([
        'Open the <b>Transact</b> tab. Newest operations are on top, grouped by day.',
        'The first row of chips filters by month, the second by card (<b>***2740</b> or <b>***9441</b>).',
        '<b>Money in</b> and <b>Money out</b> above the list recalculate for whatever you selected.',
        'Tap any operation to see the details: card, category, date and time, type, reference and the balance after it.'
      ])) +

      sec(7, 'Find one specific transaction', 
        '<p>Example: the incoming SWIFT transfer from August.</p>' + ol([
        'Open the <b>Transact</b> tab and tap <b>Search transactions</b>.',
        'Type <b>SWIFT</b> — the list narrows down to incoming transfers.',
        'Find <b>Inward SWIFT RO26Kt3Vd80 Wise Payments</b>, 13 August 2026, <b>R 28,717.18</b>.',
        'Tap it: the card shows <b>From: Wise Payments</b>, <b>To: 14902470882</b>, the reference number and the balance after the transfer.',
        'Search also accepts a reference number or a category name, for example <b>Income</b>.'
      ]) + '<p class="guide__note">If you know the month, tap its chip first — the list gets shorter and the search is faster.</p>') +

      sec(8, 'Create a statement', ol([
        'Open <b>More → Statements</b>. The same screen is one tap away from <b>Home → Statement</b>.',
        'Tap <b>Order a statement</b>.',
        '<b>Period</b>: <b>Last month</b>, <b>3 months</b> (three full calendar months) or <b>Custom</b>.',
        'For <b>Custom</b> tap <b>From</b>, pick a day in the calendar, then tap <b>To</b> and pick the closing day.',
        'Under <b>What to include</b> keep account details, transaction history and the category summary — or switch off what you do not need.',
        'Choose the <b>Format</b> (PDF or CSV) and <b>Delivery</b>: <b>In the app</b> is the default.',
        'Tap <b>Order statement</b>. The request appears as <b>Processing</b> and turns into <b>Ready</b> in a moment.',
        'Tap the ready request — the statement opens.',
        '<b>Print / PDF</b> opens the Android print dialog: choose <b>Save as PDF</b> and the file lands in <b>Downloads</b>.',
        '<b>Email</b> opens your mail app with the statement summary already filled in. Attach the PDF you saved if you need the document itself.'
      ])) +

    '</div>';
  }

  /* ---------------------------------------------------------------- 11. Statements */
  function periodOf(o) {
    var t = DB.TODAY;
    if (o.period === '1m') {
      var m = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      return { from: monthStart(m.getFullYear(), m.getMonth()), to: monthEnd(m.getFullYear(), m.getMonth()) };
    }
    if (o.period === '3m') {
      // именно три полных месяца, текущий неполный не берём
      var s = new Date(t.getFullYear(), t.getMonth() - 3, 1);
      var e = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      return { from: monthStart(s.getFullYear(), s.getMonth()), to: monthEnd(e.getFullYear(), e.getMonth()) };
    }
    var f = o.from || monthStart(t.getFullYear(), t.getMonth());
    var e = o.to || t;
    // конец дня, чтобы операции последней даты попали в выписку
    e = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59);
    return { from: new Date(f.getFullYear(), f.getMonth(), f.getDate()), to: e > t ? t : e };
  }

  function periodLabel(o) {
    var p = periodOf(o);
    if (o.period === '1m') return MONTHS[p.from.getMonth()] + ' ' + p.from.getFullYear();
    if (o.period === '3m') {
      return MONTHS[p.from.getMonth()] + ' — ' + MONTHS[p.to.getMonth()] + ' ' + p.to.getFullYear();
    }
    return dShort(p.from) + ' — ' + dShort(p.to) + ' ' + p.to.getFullYear();
  }

  function renderOrder() {
    var o = S.order, a = DB.account(o.accountId), p = periodOf(o);
    var n = DB.txFor(o.accountId, p.from, p.to).length;

    function check(id, on, title, sub, kind) {
      return '<button class="check" role="checkbox" aria-checked="' + (on ? 'true' : 'false') + '" data-action="' + id + '">' +
        '<span class="' + (kind === 'radio' ? 'radio' : 'box') + '">' + (kind === 'radio' ? '' : icon('check', { w: 2.6 })) + '</span>' +
        '<span class="picker__body"><span class="check__t">' + esc(title) + '</span>' +
        (sub ? '<span class="check__s">' + esc(sub) + '</span>' : '') + '</span></button>';
    }

    return '<div class="form">' +
      '<label class="form__lbl">Account</label>' +
      '<button class="picker" data-action="pick-account">' +
        '<span style="color:var(--magenta);width:28px">' + icon(a.kind === 'credit' ? 'cards' : a.kind === 'savings' ? 'piggy' : 'bank') + '</span>' +
        '<span class="picker__body"><span class="picker__t">' + esc(a.name) + '</span>' +
          '<span class="picker__s">' + esc(a.type) + ' · ' + esc(a.number) + '</span></span>' +
        '<span class="picker__chev">' + icon('chevron') + '</span></button>' +

      '<label class="form__lbl">Period</label>' +
      '<div class="segmented">' +
        '<button data-action="p" data-id="1m" aria-pressed="' + (o.period === '1m') + '">Last month</button>' +
        '<button data-action="p" data-id="3m" aria-pressed="' + (o.period === '3m') + '">3 months</button>' +
        '<button data-action="p" data-id="custom" aria-pressed="' + (o.period === 'custom') + '">Custom</button>' +
      '</div>' +
      (o.period === 'custom'
        ? '<div class="btnrow" style="margin-top:10px">' +
            '<button class="picker" data-action="pick-from"><span class="picker__body">' +
              '<span class="picker__s">From</span><span class="picker__t">' + dNum(p.from) + '</span></span>' +
              '<span class="picker__chev">' + icon('calendar') + '</span></button>' +
            '<button class="picker" data-action="pick-to"><span class="picker__body">' +
              '<span class="picker__s">To</span><span class="picker__t">' + dNum(p.to) + '</span></span>' +
              '<span class="picker__chev">' + icon('calendar') + '</span></button>' +
          '</div>'
        : '') +
      '<div class="note" style="margin-top:10px">Period: <b>' + esc(periodLabel(o)) + '</b> · transactions in this statement: <b>' + n + '</b></div>' +

      '<label class="form__lbl">What to include</label>' +
      check('i-details', o.incl.details, 'Account details', 'Number, branch code, SWIFT, balances') +
      check('i-tx', o.incl.tx, 'Transaction history', 'Date, description, reference, balance') +
      check('i-cats', o.incl.cats, 'Category summary', 'Spend breakdown for the period') +

      '<label class="form__lbl">Format</label>' +
      check('f-pdf', o.format === 'pdf', 'PDF', 'Bank-certified layout', 'radio') +
      check('f-csv', o.format === 'csv', 'CSV', 'For accounting and spreadsheets', 'radio') +

      '<label class="form__lbl">Delivery</label>' +
      check('d-email', o.delivery === 'email', 'By email', DB.USER.emailMasked, 'radio') +
      check('d-app', o.delivery === 'app', 'In the app', 'Kept for 12 months', 'radio') +

      '<div class="note">Your first ' + FREE_STATEMENTS + ' statements each month are <b>free</b>. Used ' +
        Math.min(FREE_STATEMENTS, S.requests.length) + ' of ' + FREE_STATEMENTS +
        '. Ready within 2 minutes.</div>' +

      '<div style="margin-top:18px"><button class="btn btn--primary btn--wide" data-action="submit-order">' +
        'Order statement</button></div>' +
    '</div>';
  }

  function submitOrder() {
    var o = S.order;
    if (!o.incl.details && !o.incl.tx && !o.incl.cats) { toast('Select at least one section'); return; }
    var p = periodOf(o);
    if (p.from > p.to) { toast('The start date is after the end date'); return; }

    var req = {
      id: 'st' + Date.now(),
      accountId: o.accountId,
      from: p.from,
      to: p.to,
      label: periodLabel(o),
      incl: JSON.parse(JSON.stringify(o.incl)),
      format: o.format,
      delivery: o.delivery,
      created: new Date(DB.TODAY),
      status: 'processing',
      ref: 'ST-' + String(Math.floor(Math.random() * 900000) + 100000)
    };
    S.requests.unshift(req);
    save();
    go('statements', {}, 'push');
    toast('Request ' + req.ref + ' received');

    setTimeout(function () {
      var r = S.requests.filter(function (x) { return x.id === req.id; })[0];
      if (!r) return;
      r.status = 'ready';
      save();
      if (S.screen === 'statements') repaint();
      toast(o.delivery === 'email' ? 'Statement sent to ' + DB.USER.emailMasked : 'Your statement is ready');
    }, 2600);
  }

  function renderStatements() {
    var reqs = S.requests.length
      ? S.requests.map(function (r) {
          var a = DB.account(r.accountId);
          var ready = r.status === 'ready';
          return '<button class="row" data-action="open-doc" data-id="' + r.id + '">' +
            '<span class="row__ic">' + icon(r.format === 'csv' ? 'docs' : 'doc') + '</span>' +
            '<span class="row__body"><span class="row__label">' + esc(a.name) + '</span>' +
              '<span class="row__sub">' + esc(r.label) + ' · ' + r.format.toUpperCase() + ' · ' + esc(r.ref) + '</span></span>' +
            '<span class="row__meta"><span class="pill' + (ready ? ' pill--ready' : '') + '">' +
              (ready ? icon('check', { w: 2.6 }) + 'Ready' : '<span class="spin">' + icon('refresh', { w: 2 }) + '</span>Processing') +
            '</span></span>' +
            '<span class="row__chev">' + icon('chevron') + '</span></button>';
        }).join('')
      : '<div class="empty">' + icon('docs') + '<p>No requests yet.<br>Order a statement and it will appear here.</p></div>';

    var quick = DB.ACCOUNTS.map(function (a) {
      return row({ icon: 'bolt', label: a.name, sub: 'Last 3 months, PDF', action: 'quick', id: a.id });
    }).join('');

    return '<div style="padding:16px 20px 4px">' +
        '<button class="btn btn--primary btn--wide" data-action="order">' + icon('plus') + 'Order a statement</button>' +
      '</div>' +
      '<div class="group" style="margin-top:12px"><div class="group__head">My requests</div>' + reqs + '</div>' +
      '<div class="group"><div class="group__head">Quick statement</div>' + quick + '</div>' +
      '<div class="note" style="margin:14px 20px 0">Statements are generated from data as at ' + dLong(DB.TODAY) +
        '. The document contains your account details, turnover and balances for the period.</div>';
  }

  /* ---------------------------------------------------------------- 12. Statement document */
  /* Бланк повторяет форму выписки Discovery: знак справа сверху, заголовок,
     TAX INVOICE, адрес и параметры в две колонки, градиентная линейка,
     account summary, transaction timeline, строка VAT, держатели карт и
     подвал с реквизитами банка. */

  /* В документе формат сумм свой: разряды через пробел, минус перед R */
  function docAmt(v) {
    var n = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '- ' : '') + 'R' + n.replace(/,/g, ' ');
  }
  function dPlain(dt) { return dt.getDate() + ' ' + MONTHS[dt.getMonth()] + ' ' + dt.getFullYear(); }

  function docLogo() {
    return '<div class="st__logo">' +
      '<img src="assets/brand/logo-statement.png" alt="Discovery Bank"></div>';
  }

  function renderDoc(p) {
    var r = S.requests.filter(function (x) { return x.id === p.id; })[0];
    if (!r) return '<div class="empty"><p>Statement not found</p></div>';

    var a = DB.ACCOUNTS[0];
    var asc = DB.txFor(null, r.from, r.to).slice().reverse();
    var open = DB.openingBalanceAt(a.id, r.from);
    var close = asc.length ? asc[asc.length - 1].balanceAfter : open;
    var vat = asc.reduce(function (sum, t) { return t.category === 'fees' ? sum - t.amount : sum; }, 0);
    // номер выписки: помесячно, май 2026 — пятнадцатая
    var stNo = (r.to.getFullYear() - 2025) * 12 + (r.to.getMonth() + 1) - 2;

    var head =
      docLogo() +
      '<h1 class="st__h1">' + esc(a.name) + ' statement</h1>' +
      '<div class="st__tax">TAX INVOICE</div>' +
      '<div class="st__cols">' +
        '<div class="st__addr">' + esc(DB.USER.formal) + '<br>' +
          DB.USER.address.map(esc).join('<br>') + '</div>' +
        '<div class="st__meta">' +
          [['Statement number', String(stNo)],
           ['Statement date', dPlain(r.to)],
           ['Statement period', dPlain(r.from) + ' - ' + dPlain(r.to)],
           ['Overdraft limit', 'R0.00'],
           ['Minimum amount due', 'R0.00']].map(function (row) {
            return '<div class="st__mrow"><span>' + esc(row[0]) + '</span>' +
              '<b class="num">' + esc(row[1]) + '</b></div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="st__rule"></div>';

    var summary = r.incl.details
      ? '<div class="st__h2">Your account summary</div>' +
        '<div class="st__srow"><span>Opening balance on</span><span class="num">' + dPlain(r.from) + '</span>' +
          '<span class="num st__r">' + docAmt(open) + '</span></div>' +
        '<div class="st__srow"><span>Closing balance on</span><span class="num">' + dPlain(r.to) + '</span>' +
          '<span class="num st__r">' + docAmt(close) + '</span></div>' +
        '<div class="st__acc"><b>' + esc(a.name) + '</b><b class="num">' + esc(a.number) + '</b></div>'
      : '';

    var feeMark = '<span class="st__vatmark">' + icon('seal', { w: 2 }) + '</span>';

    var rows = asc.map(function (t) {
      return '<tr>' +
        '<td class="num">' + dPlain(t.date) + '</td>' +
        '<td class="num">' + (t.card ? '***' + esc(t.card) : '') + '</td>' +
        '<td>' + esc(t.type) + '</td>' +
        '<td>' + esc(t.merchant) + '</td>' +
        '<td class="st__vatcell">' + (t.category === 'fees' ? feeMark : '') + '</td>' +
        '<td class="r num">' + docAmt(t.amount) + '</td>' +
      '</tr>';
    }).join('');

    var table = r.incl.tx
      ? '<div class="st__h2 st__h2--tt">Transaction timeline</div>' +
        '<div class="st__scroll"><table class="st__table"><thead><tr>' +
          '<th>Date</th><th>Card no.</th><th>Type</th><th>Details</th><th></th><th class="r">Amount</th>' +
        '</tr></thead><tbody>' +
          '<tr class="st__bold"><td></td><td></td><td></td><td>Opening balance</td><td></td>' +
            '<td class="r num">' + docAmt(open) + '</td></tr>' +
          rows +
          '<tr class="st__bold"><td></td><td></td><td></td><td>Closing balance</td><td></td>' +
            '<td class="r num">' + docAmt(close) + '</td></tr>' +
          '<tr class="st__vat"><td>Total VAT</td><td class="num">' +
            vat.toFixed(2) + '</td><td colspan="4">' + feeMark +
            '<span class="st__vatlbl">= fees charged (VAT incl.)</span></td></tr>' +
        '</tbody></table></div>'
      : '';

    var cats = DB.byCategory(asc);
    var maxCat = cats.length ? cats[0].total : 1;
    var catBlock = r.incl.cats && cats.length
      ? '<div class="st__h2 st__h2--tt">Debits by category</div>' +
        '<div class="bars">' + cats.slice(0, 7).map(function (c) {
          return '<div><div class="bar__top"><span>' + esc(cat(c.category).label) + '</span>' +
            '<span class="num">' + docAmt(c.total) + '</span></div>' +
            '<div class="bar__track"><div class="bar__fill" style="width:' +
              Math.round(c.total / maxCat * 100) + '%"></div></div></div>';
        }).join('') + '</div>'
      : '';

    var holders = '<div class="st__holders">' + DB.CARDS.map(function (c) {
      return '<div class="st__hrow"><span class="num">***' + esc(c.last4) + '</span>' +
        '<span>' + esc(DB.USER.cardName) + '</span></div>';
    }).join('') + '</div>';

    var foot =
      '<div class="st__rule st__rule--foot"></div>' +
      '<div class="st__foot">' +
        '<div>' + esc(DB.BANK.address) + ' | ' + esc(DB.BANK.support) + '</div>' +
        '<p>' + esc(DB.BANK.legalLine) + '</p>' +
        '<span class="st__seal"><img src="assets/brand/logo-seal.png" alt=""></span>' +
      '</div>';

    var bar = '<div class="docbar">' +
      '<a class="btn btn--ghost" id="doc-mail" href="' + esc(mailtoFor(r)) + '">' + icon('share') + 'Email</a>' +
      '<button class="btn btn--primary" data-action="print">' + icon('print') + 'Print / PDF</button>' +
    '</div>';

    return '<div class="st">' + head + summary + table + catBlock + holders + foot + '</div>' + bar;
  }

  /* ---------------------------------------------------------------- 12b. Календарь и почта */

  /* Выбор дат выписки: месячная сетка с ограничением по доступному периоду.
     from не может быть позже to, обе даты лежат внутри истории счёта. */
  var CAL = { which: 'from', view: null };
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function calBounds() {
    var p = periodOf(S.order);
    return CAL.which === 'from'
      ? { min: dayStart(DB.PERIOD_START), max: dayStart(p.to) }
      : { min: dayStart(p.from), max: dayStart(DB.TODAY) };
  }

  function calendarHtml() {
    var b = calBounds();
    var v = CAL.view;
    var y = v.getFullYear(), m = v.getMonth();
    var first = new Date(y, m, 1);
    var lead = (first.getDay() + 6) % 7;              // неделя начинается с понедельника
    var days = new Date(y, m + 1, 0).getDate();
    var current = CAL.which === 'from' ? periodOf(S.order).from : periodOf(S.order).to;

    var prevOk = new Date(y, m, 0) >= b.min;
    var nextOk = new Date(y, m + 1, 1) <= b.max;

    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="cal__cell"></span>';
    for (var d = 1; d <= days; d++) {
      var date = new Date(y, m, d);
      var off = date < b.min || date > b.max;
      var on = sameDate(date, dayStart(current));
      cells += '<button class="cal__cell cal__day' + (on ? ' cal__day--on' : '') + '"' +
        (off ? ' disabled' : ' data-action="cal-pick" data-id="' + y + '-' + m + '-' + d + '"') +
        '>' + d + '</button>';
    }

    return '<div class="cal">' +
      '<div class="cal__head">' +
        '<button class="cal__nav"' + (prevOk ? ' data-action="cal-prev"' : ' disabled') + '>' + icon('chevronL', { w: 2 }) + '</button>' +
        '<span class="cal__title">' + MONTHS[m] + ' ' + y + '</span>' +
        '<button class="cal__nav"' + (nextOk ? ' data-action="cal-next"' : ' disabled') + '>' + icon('chevron', { w: 2 }) + '</button>' +
      '</div>' +
      '<div class="cal__grid cal__grid--wd">' + WD.map(function (w) {
        return '<span class="cal__wd">' + w + '</span>';
      }).join('') + '</div>' +
      '<div class="cal__grid">' + cells + '</div>' +
      '<p class="cal__hint">Available history: ' + dPlain(DB.PERIOD_START) + ' — ' + dPlain(DB.TODAY) + '</p>' +
    '</div>';
  }

  function openCalendar(which) {
    CAL.which = which;
    var p = periodOf(S.order);
    var cur = which === 'from' ? p.from : p.to;
    CAL.view = new Date(cur.getFullYear(), cur.getMonth(), 1);
    openSheet(which === 'from' ? 'Statement start date' : 'Statement end date', calendarHtml());
  }

  function calShift(step) {
    CAL.view = new Date(CAL.view.getFullYear(), CAL.view.getMonth() + step, 1);
    var body = sheetEl.querySelector('.sheet__body');
    if (body) body.innerHTML = calendarHtml();
  }

  /* Письмо с выпиской: ссылка mailto отдаётся системе как есть, поэтому на
     телефоне открывается обычный выбор почтового приложения. */
  function mailtoFor(r) {
    var a = DB.ACCOUNTS[0];
    var list = DB.txFor(null, r.from, r.to);
    var tot = DB.totals(list);
    var open = DB.openingBalanceAt(a.id, r.from);
    var asc = list.slice().reverse();
    var close = asc.length ? asc[asc.length - 1].balanceAfter : open;

    var subject = DB.BANK.name + ' statement ' + r.ref;
    var body = [
      DB.BANK.name + ' — ' + a.name,
      'Account ' + a.number,
      'Statement ' + r.ref,
      'Period: ' + dPlain(r.from) + ' - ' + dPlain(r.to),
      '',
      'Opening balance: ' + docAmt(open),
      'Money in: ' + docAmt(tot.in),
      'Money out: ' + docAmt(-tot.out),
      'Closing balance: ' + docAmt(close),
      'Transactions: ' + list.length,
      '',
      'Generated in the ' + DB.BANK.name + ' app on ' + dPlain(DB.TODAY) + '.'
    ].join('\n');

    return 'mailto:' + encodeURIComponent(DB.USER.email) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  /* ---------------------------------------------------------------- 13. Screen registry */
  var SCREENS = {
    login:      { chrome: false, title: 'Log in', render: renderLogin, flush: true },
    home:       { tab: 'home', appbar: homeAppbar, render: renderHome },
    accounts:   { tab: 'accounts', title: 'Accounts', render: renderAccounts },
    account:    { tab: 'accounts', title: function (p) { var a = DB.account(p.id); return a ? (a.shortName || a.name) : 'Account'; }, back: true, render: renderAccount },
    transact:   { tab: 'transact', title: 'Transaction history', render: renderTransact },
    cards:      { tab: 'cards', title: 'Cards', render: renderCards },
    more:       { tab: 'more', title: 'More', render: renderMore, flush: true },
    statements: { tab: 'more', title: 'Statements', back: true, render: renderStatements },
    order:      { tab: 'more', title: 'Order a statement', back: true, render: renderOrder },
    guide:      { tab: 'more', title: 'How to use this app', back: true, render: renderGuide },
    doc:        { title: 'Statement', back: true, render: renderDoc, noTabs: true, flush: true }
  };

  var TABS = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'accounts', label: 'Accounts', icon: 'accounts' },
    { id: 'transact', label: 'Transact', icon: 'transact' },
    { id: 'cards', label: 'Cards', icon: 'cards' },
    { id: 'more', label: 'More', icon: 'more' }
  ];

  /* ---------------------------------------------------------------- 14. Router */
  function paintChrome() {
    var def = SCREENS[S.screen];

    if (def.appbar) {
      appbarEl.innerHTML = def.appbar();
    } else if (def.chrome === false) {
      appbarEl.innerHTML = '<div class="appbar__row"><div class="appbar__title">' +
        esc(typeof def.title === 'function' ? def.title(S.params) : def.title) + '</div></div><div class="rule"></div>';
    } else {
      var title = typeof def.title === 'function' ? def.title(S.params) : (def.title || '');
      appbarEl.innerHTML = '<div class="appbar__row">' +
        '<div class="appbar__side">' +
          (def.back ? '<button class="iconbtn" data-action="back">' + icon('chevronL', { w: 2 }) + '</button>' : '') +
        '</div>' +
        '<div class="appbar__title">' + esc(title) + '</div>' +
        '<div class="appbar__side appbar__side--right">' +
          (S.screen === 'transact' ? '<button class="iconbtn" data-action="hide">' + icon(S.hide ? 'eyeOff' : 'eye') + '</button>' : '') +
        '</div>' +
      '</div><div class="rule"></div>';
    }

    var noTabs = !S.authed || def.noTabs;
    // класс поднимает тосты над нижней панелью; на экране выписки её роль
    // играет docbar, поэтому ориентируемся только на авторизацию
    document.getElementById('phone').classList.toggle('phone--notabs', !S.authed);
    if (noTabs) {
      tabbarEl.innerHTML = '';
    } else {
      tabbarEl.innerHTML = TABS.map(function (t) {
        return '<button class="tab' + (def.tab === t.id ? ' tab--on' : '') + '" data-action="tab" data-id="' + t.id + '">' +
          icon(t.icon) + '<span>' + t.label + '</span></button>';
      }).join('');
    }
  }

  function paint(dir) {
    var def = SCREENS[S.screen];
    paintChrome();

    // страховка: в живой разметке всегда ровно один «старый» экран
    var existing = [].slice.call(viewport.querySelectorAll('.screen'));
    while (existing.length > 1) existing.shift().remove();
    var old = existing[0];

    var next = document.createElement('section');
    next.className = 'screen' + (def.flush ? ' screen--flush' : '');
    next.innerHTML = def.render(S.params);

    var inCls = dir === 'pop' ? 'anim-pop-in' : dir === 'fade' ? 'anim-fade-in' : 'anim-push-in';
    var outCls = dir === 'pop' ? 'anim-pop-out' : dir === 'fade' ? 'anim-fade-out' : 'anim-push-out';

    if (old && dir !== 'none') {
      // сбрасываем классы прошлой анимации: иначе выигрывает правило, которое
      // ниже в CSS, animationend не наступает и экран остаётся висеть слоем
      old.className = 'screen' + (old.classList.contains('screen--flush') ? ' screen--flush' : '');
      old.classList.add(outCls);
      var kill = function () { old.remove(); };
      old.addEventListener('animationend', kill);
      setTimeout(kill, 420);
      next.classList.add(inCls);
    } else if (old) {
      old.remove();
    }
    viewport.appendChild(next);
    hook(S.screen, next);
  }

  function repaint() { paint('none'); }

  function go(screen, params, dir) {
    if (dir === 'push') S.stack.push({ screen: S.screen, params: S.params });
    if (dir === 'tab' || dir === 'fade') S.stack = [];
    S.screen = screen;
    S.params = params || {};
    save();
    paint(dir === 'push' ? 'push' : dir === 'pop' ? 'pop' : dir === 'none' ? 'none' : 'fade');
  }

  function back() {
    var prev = S.stack.pop();
    if (prev) { S.screen = prev.screen; S.params = prev.params; save(); paint('pop'); }
    else go('home', {}, 'fade');
  }

  /* ---------------------------------------------------------------- 15. Post-paint hooks */
  function hook(screen, root) {
    if (screen === 'home') {
      var car = root.querySelector('#carousel'), dots = root.querySelector('#dots');
      if (car && dots) {
        car.addEventListener('scroll', function () {
          var card = car.querySelector('.acard');
          if (!card) return;
          var i = Math.round(car.scrollLeft / (card.offsetWidth + 12));
          [].forEach.call(dots.children, function (d, n) { d.classList.toggle('dot--on', n === i); });
        }, { passive: true });
      }
    }
    if (screen === 'transact') {
      var q = root.querySelector('#f-q');
      if (q) {
        // перерисовываем только ленту, чтобы не терять фокус в поле ввода
        q.addEventListener('input', function () {
          S.tx.q = q.value;
          var list = filteredTx();
          var nodes = [].slice.call(root.children);
          var start = nodes.indexOf(root.querySelector('.summary')) + 2;
          for (var i = nodes.length - 1; i >= start; i--) nodes[i].remove();
          var frag = document.createElement('div');
          frag.innerHTML = txGrouped(list);
          while (frag.firstChild) root.appendChild(frag.firstChild);
          var sum = root.querySelector('.summary'), tot = DB.totals(list);
          if (sum) {
            sum.children[0].querySelector('.summary__val').textContent = money(tot.in);
            sum.children[1].querySelector('.summary__val').textContent = money(tot.out);
          }
        });
      }
    }
    if (screen === 'doc') {
      var mail = root.querySelector('#doc-mail');
      if (mail) mail.addEventListener('click', function () { toast('Opening your email app'); });
    }
    if (screen === 'login') {
      var pass = root.querySelector('#f-pass'), user = root.querySelector('#f-user');
      if (pass) pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
      if (user && pass) user.addEventListener('keydown', function (e) { if (e.key === 'Enter') pass.focus(); });
    }
  }

  /* ---------------------------------------------------------------- 16. Actions */
  var ACTIONS = {
    /* — auth — */
    login: doLogin,
    'login-clear': function () { $('#f-user').value = ''; $('#f-pass').value = ''; },
    'toggle-pass': function (el) {
      var p = $('#f-pass'), show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      el.innerHTML = icon(show ? 'eyeOff' : 'eye');
    },
    forgot: function () { toast('Account recovery is not available in this demo'); },
    logout: function () {
      openSheet('Log out?',
        '<p class="t-body" style="color:var(--ink-2);margin-bottom:16px">Your session will end. The mockup data stays as it is.</p>' +
        '<div class="btnrow"><button class="btn btn--ghost" data-action="sheet-close">Stay</button>' +
        '<button class="btn btn--primary" data-action="logout-yes">Log out</button></div>');
    },
    'logout-yes': function () {
      closeSheet();
      S.authed = false;
      S.stack = [];
      save();
      go('login', {}, 'fade');
      setTimeout(function () { toast('You have been logged out'); }, 340);
    },

    /* — navigation — */
    tab: function (el) {
      var id = el.dataset.id;
      if (id === S.screen) { viewport.querySelector('.screen').scrollTo({ top: 0, behavior: 'smooth' }); return; }
      go(id, {}, 'fade');
    },
    back: back,
    account: function (el) { go('account', { id: el.dataset.id }, 'push'); },
    statements: function () { go('statements', {}, 'push'); },
    guide: function () { go('guide', {}, 'push'); },
    order: function () { S.order = S.order || defaultOrder(); go('order', {}, 'push'); },
    'order-for': function (el) {
      S.order = defaultOrder();
      S.order.accountId = el.dataset.id;
      go('order', {}, 'push');
    },
    'order-current': function () {
      S.order = defaultOrder();
      if (S.tx.month !== 'all') {
        var p = S.tx.month.split('-');
        S.order.period = 'custom';
        S.order.from = monthStart(+p[0], +p[1]);
        S.order.to = monthEnd(+p[0], +p[1]);
      }
      go('order', {}, 'push');
    },
    'history-for': function () {
      S.tx.card = 'all';
      S.tx.month = 'all';
      S.tx.q = '';
      go('transact', {}, 'fade');
    },

    /* — dashboard — */
    hide: function () { S.hide = !S.hide; save(); repaint(); },
    inbox: function () { toast('167 unread messages'); },
    assistant: function () { toast('The AI assistant is coming in a later version'); },
    product: function (el) {
      var p = PRODUCTS.filter(function (x) { return x.id === el.dataset.id; })[0];
      toast(p.on ? 'You are already in Bank' : p.label + ' is not linked to this profile yet');
    },
    momentum: function () { toast('Bronze Status · 2 more behaviours to reach Silver'); },
    behaviour: function (el) {
      var b = DB.BEHAVIOURS.filter(function (x) { return x.id === el.dataset.id; })[0];
      toast(b.label + ' — ' + b.p + '% complete');
    },
    soon: function () { toast('This section is not part of the mockup'); },
    profile: function () {
      openSheet('Profile',
        '<div class="kvlist" style="padding:0">' +
        [['Name', DB.USER.first + ' ' + DB.USER.last],
         ['Client no.', DB.USER.client],
         ['ID number', DB.USER.idMasked],
         ['Email', DB.USER.emailMasked],
         ['Mobile', DB.USER.phoneMasked],
         ['Address', DB.USER.address.join(', ')]].map(function (r) {
          return '<div class="kv"><span class="kv__k">' + r[0] + '</span><span class="kv__v">' + esc(r[1]) + '</span></div>';
        }).join('') + '</div>');
    },
    freeze: function () {
      S.frozen = !S.frozen;
      save();
      repaint();
      toast(S.frozen ? 'Card frozen' : 'Card unfrozen');
    },
    details: function (el) {
      var a = DB.account(el.dataset.id);
      openSheet('Account details',
        '<div class="kvlist" style="padding:0">' +
        [['Beneficiary', DB.USER.first + ' ' + DB.USER.last],
         ['Bank', DB.BANK.legal],
         ['Account', a.number],
         ['Type', a.type],
         ['Branch code', DB.BANK.branch],
         ['SWIFT', DB.BANK.swift]].map(function (r) {
          return '<div class="kv"><span class="kv__k">' + r[0] + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn btn--primary btn--wide" style="margin-top:16px" data-action="copy">Copy details</button>');
    },
    copy: function () { closeSheet(); toast('Account details copied'); },
    card: function (el) {
      var c = DB.CARDS.filter(function (x) { return x.last4 === el.dataset.id; })[0];
      if (!c) return;
      var used = DB.TX.filter(function (t) { return t.card === c.last4; });
      openSheet(c.name,
        '<div class="kvlist" style="padding:0">' +
        [['Card number', c.pan],
         ['Card type', c.kind],
         ['Linked account', DB.ACCOUNTS[0].number],
         ['Status', S.frozen ? 'Frozen' : 'Active'],
         ['Transactions', String(used.length)]].map(function (r) {
          return '<div class="kv"><span class="kv__k">' + r[0] + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn btn--ghost btn--wide" style="margin-top:16px" data-action="soon">Card settings</button>');
    },

    /* — history — */
    tx: function (el) { openTx(el.dataset.id); },
    proof: function () { closeSheet(); toast('Proof of payment sent by email'); },
    m: function (el) { S.tx.month = el.dataset.id; repaint(); },
    a: function (el) { S.tx.card = el.dataset.id; repaint(); },
    'filter-sheet': function () {
      openSheet('Filters',
        '<p class="t-cap" style="margin-bottom:12px">Clear the month, card and search term.</p>' +
        '<button class="btn btn--ghost btn--wide" data-action="filter-reset">Reset filters</button>');
    },
    'filter-reset': function () {
      S.tx = { q: '', month: 'all', card: 'all' };
      closeSheet();
      repaint();
      toast('Filters cleared');
    },

    /* — statement order — */
    'pick-account': function () {
      openSheet('Select an account', DB.ACCOUNTS.map(function (a) {
        return '<button class="check" role="radio" aria-checked="' + (S.order.accountId === a.id) + '" data-action="set-account" data-id="' + a.id + '">' +
          '<span class="radio"></span><span class="picker__body">' +
          '<span class="check__t">' + esc(a.name) + '</span>' +
          '<span class="check__s">' + esc(a.type) + ' · ' + esc(a.number) + '</span></span></button>';
      }).join(''));
    },
    'set-account': function (el) { S.order.accountId = el.dataset.id; closeSheet(); repaint(); },
    p: function (el) {
      S.order.period = el.dataset.id;
      if (el.dataset.id === 'custom' && !S.order.from) {
        var t = DB.TODAY;
        S.order.from = monthStart(t.getFullYear(), t.getMonth() - 1);
        S.order.to = new Date(t);
      }
      repaint();
    },
    'pick-from': function () { openCalendar('from'); },
    'pick-to': function () { openCalendar('to'); },
    'cal-prev': function () { calShift(-1); },
    'cal-next': function () { calShift(1); },
    'cal-pick': function (el) {
      var p = el.dataset.id.split('-');
      var d = new Date(+p[0], +p[1], +p[2]);
      if (CAL.which === 'from') S.order.from = d;
      else S.order.to = new Date(+p[0], +p[1], +p[2], 23, 59, 59);
      closeSheet();
      repaint();
    },
    'i-details': function () { S.order.incl.details = !S.order.incl.details; repaint(); },
    'i-tx': function () { S.order.incl.tx = !S.order.incl.tx; repaint(); },
    'i-cats': function () { S.order.incl.cats = !S.order.incl.cats; repaint(); },
    'f-pdf': function () { S.order.format = 'pdf'; repaint(); },
    'f-csv': function () { S.order.format = 'csv'; repaint(); },
    'd-email': function () { S.order.delivery = 'email'; repaint(); },
    'd-app': function () { S.order.delivery = 'app'; repaint(); },
    'submit-order': submitOrder,

    /* — statements — */
    quick: function (el) {
      var t = DB.TODAY;
      var from = monthStart(t.getFullYear(), t.getMonth() - 2);
      var req = {
        id: 'st' + Date.now(),
        accountId: el.dataset.id,
        from: from,
        to: new Date(t),
        label: dShort(from) + ' — ' + dShort(t) + ' ' + t.getFullYear(),
        incl: { details: true, tx: true, cats: true },
        format: 'pdf',
        delivery: 'app',
        created: new Date(t),
        status: 'ready',
        ref: 'ST-' + String(Math.floor(Math.random() * 900000) + 100000)
      };
      S.requests.unshift(req);
      save();
      go('doc', { id: req.id }, 'push');
    },
    'open-doc': function (el) {
      var r = S.requests.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!r) return;
      if (r.status !== 'ready') { toast('Your statement is still being prepared'); return; }
      go('doc', { id: r.id }, 'push');
    },
    print: function () { window.print(); },

    /* — sheet — */
    'sheet-close': closeSheet
  };

  /* ---------------------------------------------------------------- 16b. Автоблокировка */
  var idleTimer = null, awayAt = 0;
  var privacyEl = document.getElementById('privacy');

  function privacy(on) {
    if (privacyEl) privacyEl.hidden = !on;
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    if (!S.authed) return;
    idleTimer = setTimeout(function () { lockSession('idle'); }, LOCK_IDLE * 1000);
  }

  function lockSession(reason) {
    if (!S.authed) return;
    S.authed = false;
    S.stack = [];
    clearTimeout(idleTimer);
    try { localStorage.removeItem(SEEN_KEY); } catch (e) { /* приватный режим */ }
    save();
    go('login', {}, 'fade');
    setTimeout(function () {
      toast(reason === 'idle'
        ? 'Session timed out. Please log in again.'
        : 'You left the app, so it locked. Please log in again.');
    }, 340);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      awayAt = Date.now();
      if (S.authed) { save(); privacy(true); }
      clearTimeout(idleTimer);
    } else {
      privacy(false);
      if (S.authed && awayAt && Date.now() - awayAt > LOCK_AWAY * 1000) lockSession('away');
      else resetIdle();
    }
  });

  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, resetIdle, { passive: true });
  });

  /* ---------------------------------------------------------------- 17. Delegation */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
  });

  /* ---------------------------------------------------------------- 18. Boot */
  load();

  // приложение закрывали дольше, чем на LOCK_AWAY, — просим войти заново
  var lockedOnBoot = false;
  if (S.authed) {
    var seen = 0;
    try { seen = +(localStorage.getItem(SEEN_KEY) || 0); } catch (e) { /* приватный режим */ }
    if (!seen || Date.now() - seen > LOCK_AWAY * 1000) { S.authed = false; lockedOnBoot = true; }
  }

  S.order = defaultOrder();
  S.screen = S.authed ? 'home' : 'login';
  paint('none');
  resetIdle();
  if (lockedOnBoot) setTimeout(function () { toast('Session closed for your security. Please log in again.'); }, 500);

  var clock = $('#clock');
  function tick() {
    var d = new Date();
    clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  tick();
  setInterval(tick, 20000);
})();
