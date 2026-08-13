/* =========================================================================
   Meridian Bank — логика макета.
   Рендер строками, один делегированный обработчик, переходы между экранами
   через клоны .screen. Никаких зависимостей.
   ========================================================================= */
(function () {
  'use strict';

  var DB = window.DB, icon = window.icon;
  var $ = function (sel) { return document.querySelector(sel); };
  var viewport = $('#viewport'), appbarEl = $('#appbar'), tabbarEl = $('#tabbar'),
      sheetLayer = $('#sheetLayer'), sheetEl = $('#sheet'), toastLayer = $('#toastLayer');

  var STORE_KEY = 'meridian-mock-v1';

  /* ---------------------------------------------------------------- 1. Состояние */
  var S = {
    screen: 'login',
    params: {},
    stack: [],
    authed: false,
    hide: false,
    frozen: false,
    tx: { q: '', month: 'all', account: 'all' },
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
      delivery: 'email'
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        authed: S.authed, hide: S.hide, frozen: S.frozen,
        requests: S.requests, screen: S.authed ? S.screen : 'login'
      }));
    } catch (e) { /* приватный режим — просто не сохраняем */ }
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
    } catch (e) { /* повреждённое хранилище игнорируем */ }
  }

  /* ---------------------------------------------------------------- 2. Утилиты */
  var MON_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var MON_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var MON_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function amount(v) {
    var n = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-' : '') + 'R ' + n;
  }
  function money(v, force) { return (S.hide && !force) ? '••••••' : amount(v); }
  function signed(v) { return (v > 0 ? '+' : '') + amount(v); }

  function dLong(dt) { return dt.getDate() + ' ' + MON_GEN[dt.getMonth()] + ' ' + dt.getFullYear(); }
  function dShort(dt) { return dt.getDate() + ' ' + MON_SHORT[dt.getMonth()]; }
  function dNum(dt) {
    return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear();
  }
  function tTime(dt) { return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0'); }
  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

  function dayHeader(dt) {
    var t = DB.TODAY, y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
    if (sameDay(dt, t)) return 'Сегодня, ' + dt.getDate() + ' ' + MON_GEN[dt.getMonth()];
    if (sameDay(dt, y)) return 'Вчера, ' + dt.getDate() + ' ' + MON_GEN[dt.getMonth()];
    return dt.getDate() + ' ' + MON_GEN[dt.getMonth()] + ' ' + dt.getFullYear();
  }

  function monthStart(y, m) { return new Date(y, m, 1, 0, 0, 0); }
  function monthEnd(y, m) { return new Date(y, m + 1, 0, 23, 59, 59); }
  function cat(id) { return DB.CATEGORIES[id] || { label: id, icon: 'receipt' }; }

  /* ---------------------------------------------------------------- 3. Тосты и шиты */
  function toast(text, ms) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="toast__mark">' + icon('mark', { w: 1.8 }) + '</span><span>' + esc(text) + '</span>';
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

  /* ---------------------------------------------------------------- 4. Общие блоки */
  function plastic(acc, big) {
    var cls = 'plastic' + (acc.art === 'dark' ? ' plastic--dark' : acc.art === 'vault' ? ' plastic--vault' : '') + (big ? ' plastic--big' : '');
    return '<div class="' + cls + '">' +
      '<div class="plastic__top">' + icon('mark', { w: 1.5 }) + '<span class="plastic__brand">Meridian</span></div>' +
      '<span class="plastic__wave">' + icon('wave', { w: 1.8 }) + '</span>' +
      '<div class="plastic__chip"></div>' +
      (big ? '' : '<div class="plastic__mark">' + icon('mark', { w: 1.1 }) + '</div>') +
      (big && acc.pan ? '<div class="plastic__pan">' + esc(acc.pan) + '</div>' : '') +
      '<div class="plastic__foot">' +
        '<span class="plastic__tier">' + esc(acc.tier.toUpperCase()) + '</span>' +
        (acc.network ? '<span class="plastic__net">' + esc(acc.network) + '</span>' : '') +
      '</div></div>';
  }

  function txRow(t, opts) {
    opts = opts || {};
    var c = cat(t.category), inn = t.amount >= 0;
    return '<button class="tx" data-action="tx" data-id="' + t.id + '">' +
      '<span class="tx__ic">' + icon(c.icon) + '</span>' +
      '<span class="tx__body">' +
        '<span class="tx__name">' + esc(t.merchant) + '</span>' +
        '<span class="tx__meta">' + esc(c.label) + ' · ' + tTime(t.date) +
          (opts.showAccount ? ' · ' + esc(DB.account(t.accountId).name) : '') + '</span>' +
      '</span>' +
      '<span class="tx__amt' + (inn ? ' tx__amt--in' : '') + '"><span class="num">' + money(t.amount) + '</span>' +
        (opts.balance ? '<span class="tx__bal num">' + money(t.balanceAfter) + '</span>' : '') +
      '</span></button>';
  }

  function txGrouped(list, opts) {
    if (!list.length) {
      return '<div class="empty">' + icon('search') + '<p>Ничего не найдено.<br>Измените период или условия поиска.</p></div>';
    }
    var out = '', last = '';
    list.forEach(function (t) {
      var h = dayHeader(t.date);
      if (h !== last) { out += '<div class="daylabel">' + esc(h) + '</div>'; last = h; }
      out += txRow(t, opts);
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

  /* ---------------------------------------------------------------- 5. Экран: вход */
  function renderLogin() {
    return '<div class="login">' +
      '<div class="login__brand">' +
        '<span class="login__mark">' + icon('mark', { w: 1.3 }) + '</span>' +
        '<span class="login__name">' + DB.BANK.name + '</span>' +
      '</div>' +
      '<div class="field">' +
        '<input class="field__input" id="f-user" type="text" placeholder="Логин" autocomplete="username" spellcheck="false">' +
        '<button class="field__link" data-action="forgot">Забыли логин?</button>' +
      '</div>' +
      '<div class="field">' +
        '<input class="field__input" id="f-pass" type="password" placeholder="Пароль" autocomplete="current-password">' +
        '<button class="field__eye" data-action="toggle-pass">' + icon('eye') + '</button>' +
        '<button class="field__link" data-action="forgot">Забыли пароль?</button>' +
      '</div>' +
      '<div class="login__spacer"></div>' +
      '<div class="login__hint">Демо-доступ: <b>thandi</b> / <b>demo1234</b>. Данные вымышленные, платежи не проводятся.</div>' +
      '<div class="btnrow">' +
        '<button class="btn btn--ghost" data-action="login-clear">Отмена</button>' +
        '<button class="btn btn--primary" data-action="login">Войти</button>' +
      '</div>' +
    '</div>';
  }

  function doLogin() {
    var u = $('#f-user'), p = $('#f-pass');
    if (!u.value.trim() || !p.value) { toast('Введите логин и пароль'); return; }
    if (u.value.trim().toLowerCase() !== DB.USER.username || p.value !== DB.USER.password) {
      toast('Неверный логин или пароль'); return;
    }
    S.authed = true;
    S.stack = [];
    save();
    go('home', {}, 'fade');
    setTimeout(function () { toast('Добро пожаловать, ' + DB.USER.first); }, 380);
  }

  /* ---------------------------------------------------------------- 6. Экран: дашборд */
  var PRODUCTS = [
    { id: 'bank',   label: 'Банк',      icon: 'bank',   on: true },
    { id: 'health', label: 'Здоровье',  icon: 'heart' },
    { id: 'life',   label: 'Жизнь',     icon: 'shield' },
    { id: 'invest', label: 'Инвестиции',icon: 'chart' },
    { id: 'insure', label: 'Страховка', icon: 'house' }
  ];

  function homeAppbar() {
    return '<div class="appbar__row">' +
        '<div class="appbar__side">' +
          '<button class="iconbtn stack" data-action="inbox">' + icon('mail') +
            '<span class="badge num">167</span></button>' +
        '</div>' +
        '<div class="appbar__title">Банк ' + '<span style="width:18px;height:18px;color:var(--ink)">' + icon('chevronUp', { w: 2 }) + '</span></div>' +
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
        '<span class="acard__name">Банковский портфель</span>' +
        '<span class="acard__type">' + DB.ACCOUNTS.length + ' счёта</span>' +
        '<span class="acard__amt num">' + money(total) + '</span>' +
        '<span class="acard__lbl">Общий баланс</span>' +
        '<span class="acard__amt acard__amt--2 num">' + money(avail) + '</span>' +
        '<span class="acard__lbl">Доступно</span>' +
      '</span></button>';

    cards += DB.ACCOUNTS.map(function (a) {
      return '<button class="acard" data-action="account" data-id="' + a.id + '">' +
        '<span class="acard__art">' + plastic(a) + '</span>' +
        '<span class="acard__body">' +
          '<span class="acard__name">' + esc(a.name) + '</span>' +
          '<span class="acard__type">' + esc(a.type) + ' · ' + esc(a.last4) + '</span>' +
          '<span class="acard__amt num">' + money(a.balance) + '</span>' +
          '<span class="acard__lbl">' + (a.kind === 'credit' ? 'Задолженность' : 'Баланс') + '</span>' +
          '<span class="acard__amt acard__amt--2 num">' + money(a.available) + '</span>' +
          '<span class="acard__lbl">' + (a.kind === 'credit' ? 'Доступный лимит' : 'Доступно') + '</span>' +
        '</span></button>';
    }).join('');

    var dots = '<div class="dots" id="dots">' +
      DB.ACCOUNTS.concat([0]).map(function (_, i) {
        return '<span class="dot' + (i === 0 ? ' dot--on' : '') + '"></span>';
      }).join('') + '</div>';

    /* расход за текущий месяц против бюджета */
    var mStart = monthStart(DB.TODAY.getFullYear(), DB.TODAY.getMonth());
    var mTx = DB.txFor('all', mStart, DB.TODAY);
    var spent = DB.spend(mTx);
    var pct = Math.min(100, Math.round(spent / DB.BUDGET * 100));

    var behaviours = DB.BEHAVIOURS.map(function (b) {
      return '<button class="behaviour' + (b.on ? ' behaviour--on' : '') + '" data-action="behaviour" data-id="' + b.id + '">' +
        '<span class="ring" style="--p:' + b.p + ';--arc:' + (b.on ? 'var(--magenta)' : 'var(--navy)') + '">' +
          '<span class="ring__pip"></span><span class="ring__ic">' + icon(b.icon) + '</span></span>' +
        '<span>' + b.label + '</span></button>';
    }).join('');

    var recent = DB.TX.slice(0, 5).map(function (t) { return txRow(t, { showAccount: true }); }).join('');

    return '<div class="hello">' +
        '<span class="avatar">' + DB.USER.initials + '</span>' +
        '<span><span class="hello__name">' + DB.USER.first + ' ' + DB.USER.last + '</span>' +
        '<span class="hello__sub">Клиент с ' + DB.USER.since + ' · ' + DB.USER.tier + '</span></span>' +
      '</div>' +

      '<div class="sechead"><h2>Счета</h2>' +
        '<button class="iconbtn" data-action="hide">' + icon(S.hide ? 'eyeOff' : 'eye') + '</button></div>' +
      '<div class="carousel" id="carousel">' + cards + '</div>' + dots +

      '<div class="momentum">' +
        '<div class="momentum__head">' +
          '<span class="momentum__title">Momentum Money</span>' +
          '<button class="momentum__status" data-action="momentum">Статус Bronze' + icon('chevron', { w: 2 }) + '</button>' +
        '</div>' +
        '<div class="panel"><div class="panel__title">Финансовые привычки</div>' +
          '<div class="behaviours">' + behaviours + '</div></div>' +
        '<div class="panel"><div class="panel__title">Финансовый анализатор</div>' +
          '<div class="analyser">' +
            '<div class="donut" style="--p:' + pct + '"><span class="donut__pct num">' + pct + '%</span></div>' +
            '<div><div class="analyser__amt num">' + money(DB.BUDGET) + '</div>' +
              '<div class="analyser__lbl">Бюджет на месяц</div>' +
              '<div class="legend">' +
                '<span class="legend__i"><i class="legend__sw"></i>Потрачено ' + money(spent) + '</span>' +
                '<span class="legend__i"><i class="legend__sw legend__sw--track"></i>Осталось ' + money(Math.max(0, DB.BUDGET - spent)) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="actions">' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('swap') + '</span><span>Перевод</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('payshap') + '</span><span>PayShap</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('bolt') + '</span><span>Платежи</span></button>' +
        '<button class="action" data-action="statements"><span class="action__ic">' + icon('doc') + '</span><span>Выписка</span></button>' +
      '</div>' +

      '<div class="sechead" style="padding-top:18px"><h2 style="font-size:19px">Последние операции</h2>' +
        '<button class="sechead__link" data-action="tab" data-id="transact">Вся история</button></div>' +
      recent;
  }

  /* ---------------------------------------------------------------- 7. Экран: счета */
  function renderAccounts() {
    var total = DB.portfolio();
    var rows = DB.ACCOUNTS.map(function (a) {
      return '<button class="row" data-action="account" data-id="' + a.id + '">' +
        '<span class="row__ic">' + icon(a.kind === 'credit' ? 'cards' : a.kind === 'savings' ? 'piggy' : 'bank') + '</span>' +
        '<span class="row__body"><span class="row__label">' + esc(a.name) + '</span>' +
          '<span class="row__sub">' + esc(a.type) + ' · ' + esc(a.number) + '</span></span>' +
        '<span class="row__meta"><span class="num">' + money(a.balance) + '</span>' +
          '<span class="row__sub num">' + money(a.available) + ' доступно</span></span>' +
        '<span class="row__chev">' + icon('chevron') + '</span></button>';
    }).join('');

    return '<div class="sechead"><h2>Портфель</h2>' +
        '<button class="iconbtn" data-action="hide">' + icon(S.hide ? 'eyeOff' : 'eye') + '</button></div>' +
      '<div style="padding:0 20px 16px">' +
        '<div class="acard" style="display:block;padding:16px">' +
          '<div class="acard__lbl">Общий баланс</div>' +
          '<div class="t-display num" style="margin-top:2px">' + money(total) + '</div>' +
          '<div class="acard__lbl" style="margin-top:10px">Доступно ' + money(DB.portfolioAvailable()) + '</div>' +
        '</div></div>' +
      '<div class="group"><div class="group__head">Мои счета</div>' + rows + '</div>' +
      '<div class="group"><div class="group__head">Документы</div>' +
        row({ icon: 'doc', label: 'Заказать выписку', sub: 'PDF или CSV на e-mail', action: 'order' }) +
        row({ icon: 'docs', label: 'Мои выписки', sub: S.requests.length ? S.requests.length + ' заявок' : 'Заявок пока нет', action: 'statements' }) +
      '</div>';
  }

  function renderAccount(p) {
    var a = DB.account(p.id);
    if (!a) return '<div class="empty"><p>Счёт не найден</p></div>';
    var list = DB.txFor(a.id).slice(0, 12);

    var kv = [
      ['Номер счёта', a.number],
      ['Тип', a.type],
      ['Код филиала', DB.BANK.branch],
      ['SWIFT', DB.BANK.swift],
      ['Валюта', DB.BANK.currency]
    ];
    if (a.kind === 'savings') kv.push(['Ставка', a.rate.toFixed(2).replace('.', ',') + '% годовых']);
    if (a.kind === 'credit') {
      kv.push(['Кредитный лимит', amount(a.limit)]);
      kv.push(['Ставка', a.rate.toFixed(2).replace('.', ',') + '% годовых']);
    }

    return '<div class="cards-hero">' + plastic(a, true) + '</div>' +
      '<div style="padding:16px 20px 4px;text-align:center">' +
        '<div class="acard__lbl">' + (a.kind === 'credit' ? 'Задолженность' : 'Текущий баланс') + '</div>' +
        '<div class="t-display num">' + money(a.balance) + '</div>' +
        '<div class="acard__lbl" style="margin-top:4px">' +
          (a.kind === 'credit' ? 'Доступный лимит ' : 'Доступно ') + money(a.available) + '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('swap') + '</span><span>Перевод</span></button>' +
        '<button class="action" data-action="details" data-id="' + a.id + '"><span class="action__ic">' + icon('receipt') + '</span><span>Реквизиты</span></button>' +
        '<button class="action" data-action="order-for" data-id="' + a.id + '"><span class="action__ic">' + icon('doc') + '</span><span>Выписка</span></button>' +
        '<button class="action" data-action="freeze"><span class="action__ic">' + icon('lock') + '</span><span>' + (S.frozen ? 'Разблок.' : 'Заморозить') + '</span></button>' +
      '</div>' +
      '<div class="hr"></div>' +
      '<div class="kvlist">' + kv.map(function (r) {
        return '<div class="kv"><span class="kv__k">' + esc(r[0]) + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="sechead" style="padding-top:8px"><h2 style="font-size:19px">Операции</h2>' +
        '<button class="sechead__link" data-action="history-for" data-id="' + a.id + '">Вся история</button></div>' +
      txGrouped(list, { balance: true });
  }

  /* ---------------------------------------------------------------- 8. Экран: история */
  function filteredTx() {
    var from = null, to = null;
    if (S.tx.month !== 'all') {
      var parts = S.tx.month.split('-');
      from = monthStart(+parts[0], +parts[1]);
      to = monthEnd(+parts[0], +parts[1]);
    }
    var list = DB.txFor(S.tx.account, from, to);
    var q = S.tx.q.trim().toLowerCase();
    if (q) {
      list = list.filter(function (t) {
        return t.merchant.toLowerCase().indexOf(q) !== -1 ||
               cat(t.category).label.toLowerCase().indexOf(q) !== -1 ||
               t.ref.toLowerCase().indexOf(q) !== -1;
      });
    }
    return list;
  }

  function renderTransact() {
    var list = filteredTx(), tot = DB.totals(list);
    var months = DB.monthList();

    var monthChips = '<button class="chip' + (S.tx.month === 'all' ? ' chip--on' : '') + '" data-action="m" data-id="all">Все месяцы</button>' +
      months.map(function (m) {
        var k = m.year + '-' + m.month;
        return '<button class="chip' + (S.tx.month === k ? ' chip--on' : '') + '" data-action="m" data-id="' + k + '">' +
          MON_NOM[m.month] + '</button>';
      }).join('');

    var accChips = '<button class="chip' + (S.tx.account === 'all' ? ' chip--on' : '') + '" data-action="a" data-id="all">Все счета</button>' +
      DB.ACCOUNTS.map(function (a) {
        return '<button class="chip' + (S.tx.account === a.id ? ' chip--on' : '') + '" data-action="a" data-id="' + a.id + '">' +
          esc(a.name) + '</button>';
      }).join('');

    return '<div class="searchbar"><div class="search">' + icon('search') +
        '<input id="f-q" type="search" placeholder="Поиск по операциям" value="' + esc(S.tx.q) + '">' +
        '<button data-action="filter-sheet" style="color:var(--navy)">' + icon('filter') + '</button>' +
      '</div></div>' +
      '<div class="chips">' + monthChips + '</div>' +
      '<div class="chips" style="padding-top:0">' + accChips + '</div>' +
      '<div class="summary">' +
        '<div class="summary__i"><div class="summary__lbl">Поступления</div>' +
          '<div class="summary__val num" style="color:var(--credit)">' + money(tot.in) + '</div></div>' +
        '<div class="summary__i"><div class="summary__lbl">Расходы</div>' +
          '<div class="summary__val num">' + money(tot.out) + '</div></div>' +
      '</div>' +
      '<div style="padding:0 20px 12px"><button class="btn btn--quiet btn--wide" data-action="order-current">' +
        icon('doc') + 'Выписка за выбранный период</button></div>' +
      txGrouped(list, { showAccount: S.tx.account === 'all', balance: S.tx.account !== 'all' });
  }

  function openTx(id) {
    var t = DB.TX.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var a = DB.account(t.accountId), c = cat(t.category);
    var rows = [
      ['Счёт', a.name + ' · ' + a.last4],
      ['Категория', c.label],
      ['Дата', dLong(t.date) + ', ' + tTime(t.date)],
      ['Канал', t.channel],
      ['Референс', t.ref],
      ['Баланс после', amount(t.balanceAfter)]
    ];
    if (t.note) rows.splice(2, 0, ['Назначение', t.note]);

    openSheet(null,
      '<div style="display:flex;align-items:center;gap:13px;margin-bottom:14px">' +
        '<span class="tx__ic" style="width:46px;height:46px;flex:0 0 46px">' + icon(c.icon) + '</span>' +
        '<span style="flex:1 1 auto;min-width:0">' +
          '<span class="t-section" style="display:block">' + esc(t.merchant) + '</span>' +
          '<span class="t-cap">' + esc(c.label) + '</span></span>' +
        '<span class="t-hero num"' + (t.amount >= 0 ? ' style="color:var(--credit)"' : '') + '>' + amount(t.amount) + '</span>' +
      '</div>' +
      '<div class="kvlist" style="padding:0">' + rows.map(function (r) {
        return '<div class="kv"><span class="kv__k">' + esc(r[0]) + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="btnrow" style="margin-top:16px">' +
        '<button class="btn btn--ghost" data-action="soon">Оспорить</button>' +
        '<button class="btn btn--primary" data-action="proof" data-id="' + t.id + '">Подтверждение</button>' +
      '</div>');
  }

  /* ---------------------------------------------------------------- 9. Экран: карты */
  function renderCards() {
    var a = DB.account('ac-everyday'), c = DB.account('ac-credit');
    return '<div class="cards-hero">' + plastic(a, true) +
        '<div style="text-align:center">' +
          '<div class="t-section">' + esc(a.name) + '</div>' +
          '<div class="t-cap">' + esc(a.pan) + ' · ' + (S.frozen ? 'Заморожена' : 'Активна') + '</div>' +
        '</div></div>' +
      '<div class="actions">' +
        '<button class="action" data-action="freeze"><span class="action__ic">' + icon('lock') + '</span><span>' + (S.frozen ? 'Разблок.' : 'Заморозить') + '</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('settings') + '</span><span>Лимиты</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('globe') + '</span><span>Поездки</span></button>' +
        '<button class="action" data-action="soon"><span class="action__ic">' + icon('bell') + '</span><span>Уведомления</span></button>' +
      '</div>' +
      '<div class="group" style="margin-top:12px"><div class="group__head">Все карты</div>' +
        row({ icon: 'cards', label: a.name, sub: 'Дебетовая · ' + a.last4, meta: '<span class="num">' + money(a.available) + '</span>', action: 'account', id: a.id }) +
        row({ icon: 'cards', label: c.name, sub: 'Кредитная · ' + c.last4, meta: '<span class="num">' + money(c.available) + '</span>', action: 'account', id: c.id }) +
      '</div>' +
      '<div class="group"><div class="group__head">Безопасность</div>' +
        row({ icon: 'lock', label: 'Сменить PIN', action: 'soon' }) +
        row({ icon: 'shield', label: 'Виртуальная карта', action: 'soon' }) +
        row({ icon: 'bolt', label: 'Оплата в один клик', action: 'soon' }) +
      '</div>';
  }

  /* ---------------------------------------------------------------- 10. Экран: ещё */
  function renderMore() {
    return '<div class="group" style="border-top:0">' +
        row({ icon: 'travel', label: 'Путешествия', action: 'soon' }) +
        row({ icon: 'payshap', label: 'PayShap', action: 'soon' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Meridian Pay</div>' +
        row({ icon: 'seal', label: 'Платежи по контактам', action: 'soon' }) +
        row({ icon: 'heart', label: 'Health Pay', action: 'soon' }) +
        row({ icon: 'tick', label: 'Momentum Pay', action: 'soon' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Хранилище документов</div>' +
        row({ icon: 'doc', label: 'Выписки', sub: 'Заказ и история заявок', action: 'statements' }) +
        row({ icon: 'docs', label: 'Прочие документы', action: 'soon' }) +
      '</div>' +
      '<div class="group"><div class="group__head">Управление</div>' +
        row({ icon: 'plus', label: 'Добавить счёт', action: 'soon' }) +
        row({ icon: 'settings', label: 'Настройки каналов', off: true }) +
        row({ icon: 'bell', label: 'Уведомления', action: 'soon' }) +
        row({ icon: 'user', label: 'Профиль и данные', action: 'profile' }) +
      '</div>' +
      '<div style="position:sticky;bottom:0;padding:14px 20px 16px;background:linear-gradient(180deg,rgba(255,255,255,0),var(--surface) 34%)">' +
        '<button class="btn btn--primary btn--wide" data-action="logout">Выйти</button></div>';
  }

  /* ---------------------------------------------------------------- 11. Выписки */
  function periodOf(o) {
    var t = DB.TODAY;
    if (o.period === '1m') {
      var m = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      return { from: monthStart(m.getFullYear(), m.getMonth()), to: monthEnd(m.getFullYear(), m.getMonth()) };
    }
    if (o.period === '3m') {
      var s = new Date(t.getFullYear(), t.getMonth() - 2, 1);
      return { from: monthStart(s.getFullYear(), s.getMonth()), to: t };
    }
    var f = o.from || monthStart(t.getFullYear(), t.getMonth());
    var e = o.to || t;
    return { from: f, to: e > t ? t : e };
  }

  function periodLabel(o) {
    var p = periodOf(o);
    if (o.period === '1m') return MON_NOM[p.from.getMonth()] + ' ' + p.from.getFullYear();
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
      '<label class="form__lbl">Счёт</label>' +
      '<button class="picker" data-action="pick-account">' +
        '<span style="color:var(--magenta);width:28px">' + icon(a.kind === 'credit' ? 'cards' : a.kind === 'savings' ? 'piggy' : 'bank') + '</span>' +
        '<span class="picker__body"><span class="picker__t">' + esc(a.name) + '</span>' +
          '<span class="picker__s">' + esc(a.type) + ' · ' + esc(a.number) + '</span></span>' +
        '<span class="picker__chev">' + icon('chevron') + '</span></button>' +

      '<label class="form__lbl">Период</label>' +
      '<div class="segmented">' +
        '<button data-action="p" data-id="1m" aria-pressed="' + (o.period === '1m') + '">Прошлый месяц</button>' +
        '<button data-action="p" data-id="3m" aria-pressed="' + (o.period === '3m') + '">3 месяца</button>' +
        '<button data-action="p" data-id="custom" aria-pressed="' + (o.period === 'custom') + '">Свой</button>' +
      '</div>' +
      (o.period === 'custom'
        ? '<div class="btnrow" style="margin-top:10px">' +
            '<button class="picker" data-action="pick-from"><span class="picker__body">' +
              '<span class="picker__s">С</span><span class="picker__t">' + dNum(p.from) + '</span></span>' +
              '<span class="picker__chev">' + icon('calendar') + '</span></button>' +
            '<button class="picker" data-action="pick-to"><span class="picker__body">' +
              '<span class="picker__s">По</span><span class="picker__t">' + dNum(p.to) + '</span></span>' +
              '<span class="picker__chev">' + icon('calendar') + '</span></button>' +
          '</div>'
        : '') +
      '<div class="note" style="margin-top:10px">Период: <b>' + esc(periodLabel(o)) + '</b> · операций в выписке: <b>' + n + '</b></div>' +

      '<label class="form__lbl">Что включить</label>' +
      check('i-details', o.incl.details, 'Реквизиты счёта', 'Номер, филиал, SWIFT, остатки') +
      check('i-tx', o.incl.tx, 'История транзакций', 'Дата, описание, референс, баланс') +
      check('i-cats', o.incl.cats, 'Сводка по категориям', 'Разбивка расходов за период') +

      '<label class="form__lbl">Формат</label>' +
      check('f-pdf', o.format === 'pdf', 'PDF', 'Заверенная банком форма', 'radio') +
      check('f-csv', o.format === 'csv', 'CSV', 'Для бухгалтерии и таблиц', 'radio') +

      '<label class="form__lbl">Доставка</label>' +
      check('d-email', o.delivery === 'email', 'На e-mail', DB.USER.emailMasked, 'radio') +
      check('d-app', o.delivery === 'app', 'В приложении', 'Хранится 12 месяцев', 'radio') +

      '<div class="note">Первые 3 выписки в месяц — <b>бесплатно</b>. Использовано ' +
        Math.min(3, S.requests.length) + ' из 3. Готовность — до 2 минут.</div>' +

      '<div style="margin-top:18px"><button class="btn btn--primary btn--wide" data-action="submit-order">' +
        'Заказать выписку</button></div>' +
    '</div>';
  }

  function submitOrder() {
    var o = S.order;
    if (!o.incl.details && !o.incl.tx && !o.incl.cats) { toast('Выберите хотя бы один раздел'); return; }
    var p = periodOf(o);
    if (p.from > p.to) { toast('Дата начала позже даты окончания'); return; }

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
    toast('Заявка ' + req.ref + ' принята');

    setTimeout(function () {
      var r = S.requests.filter(function (x) { return x.id === req.id; })[0];
      if (!r) return;
      r.status = 'ready';
      save();
      if (S.screen === 'statements') repaint();
      toast(o.delivery === 'email' ? 'Выписка отправлена на ' + DB.USER.emailMasked : 'Выписка готова');
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
              (ready ? icon('check', { w: 2.6 }) + 'Готова' : '<span class="spin">' + icon('refresh', { w: 2 }) + '</span>Готовится') +
            '</span></span>' +
            '<span class="row__chev">' + icon('chevron') + '</span></button>';
        }).join('')
      : '<div class="empty">' + icon('docs') + '<p>Заявок пока нет.<br>Закажите выписку — она появится здесь.</p></div>';

    var quick = DB.ACCOUNTS.map(function (a) {
      return row({ icon: 'bolt', label: a.name, sub: 'Последние 3 месяца, PDF', action: 'quick', id: a.id });
    }).join('');

    return '<div style="padding:16px 20px 4px">' +
        '<button class="btn btn--primary btn--wide" data-action="order">' + icon('plus') + 'Заказать выписку</button>' +
      '</div>' +
      '<div class="group" style="margin-top:12px"><div class="group__head">Мои заявки</div>' + reqs + '</div>' +
      '<div class="group"><div class="group__head">Быстрая выписка</div>' + quick + '</div>' +
      '<div class="note" style="margin:14px 20px 0">Выписка формируется по данным на ' + dLong(DB.TODAY) +
        '. Документ содержит реквизиты счёта, обороты и остатки за период.</div>';
  }

  /* ---------------------------------------------------------------- 12. Документ выписки */
  function renderDoc(p) {
    var r = S.requests.filter(function (x) { return x.id === p.id; })[0];
    if (!r) return '<div class="empty"><p>Выписка не найдена</p></div>';
    var a = DB.account(r.accountId);
    var list = DB.txFor(r.accountId, r.from, r.to);
    var asc = list.slice().reverse();
    var tot = DB.totals(list);
    var open = DB.openingBalanceAt(r.accountId, r.from);
    var close = asc.length ? asc[asc.length - 1].balanceAfter : open;
    var cats = DB.byCategory(list);
    var maxCat = cats.length ? cats[0].total : 1;

    var head =
      '<div class="doc__head">' +
        '<div class="doc__brand">' + icon('mark', { w: 1.4 }) + '<b>' + DB.BANK.name + '</b></div>' +
        '<div class="doc__kind"><b>Выписка по счёту</b>' + esc(r.ref) + '<br>от ' + dNum(r.created) + '</div>' +
      '</div>';

    var details = r.incl.details
      ? '<div class="doc__grid">' +
          '<div class="doc__block"><h4>Клиент</h4><p>' + DB.USER.first + ' ' + DB.USER.last + '<br>' +
            DB.USER.address.map(esc).join('<br>') + '<br>Клиент № ' + DB.USER.client + '</p></div>' +
          '<div class="doc__block"><h4>Банк</h4><p>' + DB.BANK.legal + '<br>' + DB.BANK.address + '<br>' +
            DB.BANK.reg + '</p></div>' +
          '<div class="doc__block"><h4>Счёт</h4>' +
            '<div class="doc__kv"><span>Название</span><b>' + esc(a.name) + '</b></div>' +
            '<div class="doc__kv"><span>Номер</span><b class="num">' + esc(a.number) + '</b></div>' +
            '<div class="doc__kv"><span>Тип</span><b>' + esc(a.type) + '</b></div>' +
            '<div class="doc__kv"><span>Филиал</span><b class="num">' + DB.BANK.branch + '</b></div>' +
            '<div class="doc__kv"><span>SWIFT</span><b class="num">' + DB.BANK.swift + '</b></div>' +
          '</div>' +
          '<div class="doc__block"><h4>Период</h4>' +
            '<div class="doc__kv"><span>С</span><b class="num">' + dNum(r.from) + '</b></div>' +
            '<div class="doc__kv"><span>По</span><b class="num">' + dNum(r.to) + '</b></div>' +
            '<div class="doc__kv"><span>Валюта</span><b>' + DB.BANK.currency + '</b></div>' +
            '<div class="doc__kv"><span>Операций</span><b class="num">' + list.length + '</b></div>' +
          '</div>' +
        '</div>'
      : '';

    var table = r.incl.tx
      ? '<div class="doc__sec">История транзакций</div>' +
        '<table class="doc__table"><thead><tr>' +
          '<th>Дата</th><th>Описание</th><th>Сумма</th><th>Остаток</th>' +
        '</tr></thead><tbody>' +
        (asc.length ? asc.map(function (t) {
          return '<tr><td class="num">' + dNum(t.date) + '</td>' +
            '<td>' + esc(t.merchant) + '<br><span style="color:var(--ink-3)">' +
              esc(cat(t.category).label) + ' · ' + esc(t.channel) + ' · ' + esc(t.ref) + '</span></td>' +
            '<td class="r num' + (t.amount >= 0 ? ' in' : '') + '">' + signed(t.amount) + '</td>' +
            '<td class="r num">' + amount(t.balanceAfter) + '</td></tr>';
        }).join('') : '<tr><td colspan="4" style="padding:16px 22px;color:var(--ink-3)">За период операций нет</td></tr>') +
        '</tbody></table>'
      : '';

    var summary =
      '<div class="doc__tot">' +
        '<div class="doc__kv"><span>Остаток на начало периода</span><b class="num">' + amount(open) + '</b></div>' +
        '<div class="doc__kv"><span>Поступления</span><b class="num">' + amount(tot.in) + '</b></div>' +
        '<div class="doc__kv"><span>Списания</span><b class="num">' + amount(-tot.out) + '</b></div>' +
        '<div class="doc__kv"><span>Комиссии банка</span><b class="num">' + amount(tot.fees) + '</b></div>' +
        '<div class="doc__kv" style="border-top:1px solid var(--line-2);margin-top:6px;padding-top:6px">' +
          '<span>Остаток на конец периода</span><b class="num">' + amount(close) + '</b></div>' +
      '</div>';

    var catBlock = r.incl.cats && cats.length
      ? '<div class="doc__sec">Списания по категориям</div>' +
        '<div class="bars">' + cats.slice(0, 7).map(function (c) {
          return '<div><div class="bar__top"><span>' + esc(cat(c.category).label) + '</span>' +
            '<span class="num">' + amount(c.total) + '</span></div>' +
            '<div class="bar__track"><div class="bar__fill" style="width:' + Math.round(c.total / maxCat * 100) + '%"></div></div></div>';
        }).join('') + '</div>'
      : '';

    var foot = '<div class="doc__foot">Документ сформирован автоматически ' + dLong(r.created) +
      ' и действителен без подписи. ' + DB.BANK.legal + ', ' + DB.BANK.reg +
      '. Вопросы — ' + DB.BANK.support + '. Это демонстрационный макет: данные вымышленные.</div>';

    var bar = '<div class="docbar">' +
      '<button class="btn btn--ghost" data-action="send-doc" data-id="' + r.id + '">' + icon('share') + 'На e-mail</button>' +
      '<button class="btn btn--primary" data-action="print">' + icon('print') + 'Печать / PDF</button>' +
    '</div>';

    return '<div class="doc">' + head + details + table + summary + catBlock + foot + '</div>' + bar;
  }

  /* ---------------------------------------------------------------- 13. Реестр экранов */
  var SCREENS = {
    login:      { chrome: false, title: 'Вход', render: renderLogin, flush: true },
    home:       { tab: 'home', appbar: homeAppbar, render: renderHome },
    accounts:   { tab: 'accounts', title: 'Счета', render: renderAccounts },
    account:    { tab: 'accounts', title: function (p) { var a = DB.account(p.id); return a ? a.name : 'Счёт'; }, back: true, render: renderAccount },
    transact:   { tab: 'transact', title: 'История операций', render: renderTransact },
    cards:      { tab: 'cards', title: 'Карты', render: renderCards },
    more:       { tab: 'more', title: 'Ещё', render: renderMore, flush: true },
    statements: { tab: 'more', title: 'Выписки', back: true, render: renderStatements },
    order:      { tab: 'more', title: 'Заказать выписку', back: true, render: renderOrder },
    doc:        { title: 'Выписка', back: true, render: renderDoc, noTabs: true, flush: true }
  };

  var TABS = [
    { id: 'home', label: 'Главная', icon: 'home' },
    { id: 'accounts', label: 'Счета', icon: 'accounts' },
    { id: 'transact', label: 'Операции', icon: 'transact' },
    { id: 'cards', label: 'Карты', icon: 'cards' },
    { id: 'more', label: 'Ещё', icon: 'more' }
  ];

  /* ---------------------------------------------------------------- 14. Роутер и отрисовка */
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
    // класс двигает тосты выше нижней панели; на экране выписки её роль
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
    var base = 'screen' + (def.flush ? ' screen--flush' : '');
    next.className = base;
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

  /* ---------------------------------------------------------------- 15. Хуки после отрисовки */
  function hook(screen, root) {
    if (screen === 'home') {
      var car = root.querySelector('#carousel'), dots = root.querySelector('#dots');
      if (car && dots) {
        car.addEventListener('scroll', function () {
          var card = car.querySelector('.acard');
          if (!card) return;
          var step = card.offsetWidth + 12;
          var i = Math.round(car.scrollLeft / step);
          [].forEach.call(dots.children, function (d, n) { d.classList.toggle('dot--on', n === i); });
        }, { passive: true });
      }
    }
    if (screen === 'transact') {
      var q = root.querySelector('#f-q');
      if (q) {
        q.addEventListener('input', function () {
          S.tx.q = q.value;
          var list = filteredTx();
          var holder = root.querySelector('.daylabel') ? root : null;
          // перерисовываем только ленту, чтобы не терять фокус в поле
          var nodes = [].slice.call(root.children);
          var start = nodes.indexOf(root.querySelector('.summary')) + 2;
          for (var i = nodes.length - 1; i >= start; i--) nodes[i].remove();
          var frag = document.createElement('div');
          frag.innerHTML = txGrouped(list, { showAccount: S.tx.account === 'all', balance: S.tx.account !== 'all' });
          while (frag.firstChild) root.appendChild(frag.firstChild);
          var sum = root.querySelector('.summary');
          if (sum) {
            var tot = DB.totals(list);
            sum.children[0].querySelector('.summary__val').textContent = money(tot.in);
            sum.children[1].querySelector('.summary__val').textContent = money(tot.out);
          }
          if (holder) { /* no-op */ }
        });
      }
    }
    if (screen === 'login') {
      var pass = root.querySelector('#f-pass');
      if (pass) {
        pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
        var user = root.querySelector('#f-user');
        if (user) user.addEventListener('keydown', function (e) { if (e.key === 'Enter') pass.focus(); });
      }
    }
  }

  /* ---------------------------------------------------------------- 16. Действия */
  var ACTIONS = {
    /* — вход/выход — */
    login: doLogin,
    'login-clear': function () { $('#f-user').value = ''; $('#f-pass').value = ''; },
    'toggle-pass': function (el) {
      var p = $('#f-pass');
      var show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      el.innerHTML = icon(show ? 'eyeOff' : 'eye');
    },
    forgot: function () { toast('В демо-версии восстановление недоступно'); },
    logout: function () {
      openSheet('Выйти из приложения?',
        '<p class="t-body" style="color:var(--ink-2);margin-bottom:16px">Сессия будет закрыта. Данные макета сохранятся.</p>' +
        '<div class="btnrow"><button class="btn btn--ghost" data-action="sheet-close">Остаться</button>' +
        '<button class="btn btn--primary" data-action="logout-yes">Выйти</button></div>');
    },
    'logout-yes': function () {
      closeSheet();
      S.authed = false;
      S.stack = [];
      save();
      go('login', {}, 'fade');
      setTimeout(function () { toast('Вы вышли из приложения'); }, 340);
    },

    /* — навигация — */
    tab: function (el) {
      var id = el.dataset.id;
      if (id === S.screen) { viewport.querySelector('.screen').scrollTo({ top: 0, behavior: 'smooth' }); return; }
      go(id, {}, 'fade');
    },
    back: back,
    account: function (el) { go('account', { id: el.dataset.id }, 'push'); },
    statements: function () { go('statements', {}, 'push'); },
    order: function () { S.order = S.order || defaultOrder(); go('order', {}, 'push'); },
    'order-for': function (el) {
      S.order = defaultOrder();
      S.order.accountId = el.dataset.id;
      go('order', {}, 'push');
    },
    'order-current': function () {
      S.order = defaultOrder();
      if (S.tx.account !== 'all') S.order.accountId = S.tx.account;
      if (S.tx.month !== 'all') {
        var p = S.tx.month.split('-');
        S.order.period = 'custom';
        S.order.from = monthStart(+p[0], +p[1]);
        S.order.to = monthEnd(+p[0], +p[1]);
      }
      go('order', {}, 'push');
    },
    'history-for': function (el) {
      S.tx.account = el.dataset.id;
      S.tx.month = 'all';
      S.tx.q = '';
      go('transact', {}, 'fade');
    },

    /* — дашборд — */
    hide: function () { S.hide = !S.hide; save(); repaint(); },
    inbox: function () { toast('167 непрочитанных сообщений'); },
    assistant: function () { toast('AI-ассистент появится в следующей версии'); },
    product: function (el) {
      var p = PRODUCTS.filter(function (x) { return x.id === el.dataset.id; })[0];
      toast(p.on ? 'Вы уже в разделе «Банк»' : 'Продукт «' + p.label + '» пока не подключён');
    },
    momentum: function () { toast('Статус Bronze · до Silver осталось 2 привычки'); },
    behaviour: function (el) {
      var b = DB.BEHAVIOURS.filter(function (x) { return x.id === el.dataset.id; })[0];
      toast(b.label + ' — выполнено на ' + b.p + '%');
    },
    soon: function () { toast('Раздел недоступен в макете'); },
    profile: function () {
      openSheet('Профиль',
        '<div class="kvlist" style="padding:0">' +
        [['Имя', DB.USER.first + ' ' + DB.USER.last],
         ['Клиент №', DB.USER.client],
         ['ID', DB.USER.idMasked],
         ['E-mail', DB.USER.emailMasked],
         ['Телефон', DB.USER.phoneMasked],
         ['Адрес', DB.USER.address.join(', ')]].map(function (r) {
          return '<div class="kv"><span class="kv__k">' + r[0] + '</span><span class="kv__v">' + esc(r[1]) + '</span></div>';
        }).join('') + '</div>');
    },
    freeze: function () {
      S.frozen = !S.frozen;
      save();
      repaint();
      toast(S.frozen ? 'Карта заморожена' : 'Карта разблокирована');
    },
    details: function (el) {
      var a = DB.account(el.dataset.id);
      openSheet('Реквизиты счёта',
        '<div class="kvlist" style="padding:0">' +
        [['Получатель', DB.USER.first + ' ' + DB.USER.last],
         ['Банк', DB.BANK.legal],
         ['Счёт', a.number],
         ['Тип', a.type],
         ['Код филиала', DB.BANK.branch],
         ['SWIFT', DB.BANK.swift]].map(function (r) {
          return '<div class="kv"><span class="kv__k">' + r[0] + '</span><span class="kv__v num">' + esc(r[1]) + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn btn--primary btn--wide" style="margin-top:16px" data-action="copy">Скопировать реквизиты</button>');
    },
    copy: function () { closeSheet(); toast('Реквизиты скопированы'); },

    /* — история — */
    tx: function (el) { openTx(el.dataset.id); },
    proof: function () { closeSheet(); toast('Подтверждение отправлено на e-mail'); },
    m: function (el) { S.tx.month = el.dataset.id; repaint(); },
    a: function (el) { S.tx.account = el.dataset.id; repaint(); },
    'filter-sheet': function () {
      openSheet('Фильтры',
        '<p class="t-cap" style="margin-bottom:12px">Сбросить месяц, счёт и строку поиска.</p>' +
        '<button class="btn btn--ghost btn--wide" data-action="filter-reset">Сбросить фильтры</button>');
    },
    'filter-reset': function () {
      S.tx = { q: '', month: 'all', account: 'all' };
      closeSheet();
      repaint();
      toast('Фильтры сброшены');
    },

    /* — заказ выписки — */
    'pick-account': function () {
      openSheet('Выберите счёт', DB.ACCOUNTS.map(function (a) {
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
        S.order.from = monthStart(t.getFullYear(), t.getMonth() - 2);
        S.order.to = new Date(t);
      }
      repaint();
    },
    'pick-from': function () { monthSheet('from'); },
    'pick-to': function () { monthSheet('to'); },
    'i-details': function () { S.order.incl.details = !S.order.incl.details; repaint(); },
    'i-tx': function () { S.order.incl.tx = !S.order.incl.tx; repaint(); },
    'i-cats': function () { S.order.incl.cats = !S.order.incl.cats; repaint(); },
    'f-pdf': function () { S.order.format = 'pdf'; repaint(); },
    'f-csv': function () { S.order.format = 'csv'; repaint(); },
    'd-email': function () { S.order.delivery = 'email'; repaint(); },
    'd-app': function () { S.order.delivery = 'app'; repaint(); },
    'submit-order': submitOrder,

    /* — выписки — */
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
      if (r.status !== 'ready') { toast('Выписка ещё готовится'); return; }
      go('doc', { id: r.id }, 'push');
    },
    'send-doc': function () { toast('Выписка отправлена на ' + DB.USER.emailMasked); },
    print: function () { window.print(); },

    /* — шит — */
    'sheet-close': closeSheet
  };

  function monthSheet(which) {
    var months = DB.monthList();
    openSheet(which === 'from' ? 'Начало периода' : 'Конец периода',
      months.map(function (m) {
        return '<button class="check" data-action="set-' + which + '" data-id="' + m.year + '-' + m.month + '">' +
          '<span class="radio"></span><span class="picker__body"><span class="check__t">' +
          MON_NOM[m.month] + ' ' + m.year + '</span></span></button>';
      }).join(''));
  }
  ACTIONS['set-from'] = function (el) {
    var p = el.dataset.id.split('-');
    S.order.from = monthStart(+p[0], +p[1]);
    closeSheet(); repaint();
  };
  ACTIONS['set-to'] = function (el) {
    var p = el.dataset.id.split('-');
    S.order.to = monthEnd(+p[0], +p[1]);
    closeSheet(); repaint();
  };

  /* ---------------------------------------------------------------- 17. Делегирование */
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

  /* ---------------------------------------------------------------- 18. Старт */
  load();
  S.order = defaultOrder();
  S.screen = S.authed ? 'home' : 'login';
  paint('none');

  var clock = $('#clock');
  function tick() {
    var d = new Date();
    clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  tick();
  setInterval(tick, 20000);
})();
