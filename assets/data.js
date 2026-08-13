/* =========================================================================
   Данные макета. Всё детерминировано: один и тот же seed даёт одну и ту же
   историю при каждой загрузке, а балансы счетов НЕ выдуманы — они считаются
   из проводок, поэтому выписка сходится с дашбордом до копейки.
   ========================================================================= */
(function (global) {
  'use strict';

  var TODAY = new Date(2026, 7, 13, 16, 51); // 13 августа 2026

  var BANK = {
    name: 'Meridian Bank',
    legal: 'Meridian Bank Limited',
    reg: 'Reg. 2009/034118/06 · FSP 61294 · NCRCP 42',
    branch: '679000',
    swift: 'MRDNZAJJ',
    address: '1 Rivonia Green, Sandton, 2196',
    support: '0860 111 984',
    currency: 'ZAR',
    symbol: 'R'
  };

  var USER = {
    username: 'thandi',
    password: 'demo1234',
    first: 'Thandi',
    last: 'Mokoena',
    initials: 'TM',
    email: 'thandi.mokoena@example.co.za',
    emailMasked: 't••••••.m••••••@example.co.za',
    phoneMasked: '+27 •• ••• 4471',
    idMasked: '9004•••••08 3',
    address: ['12 Acacia Road', 'Melrose Arch', 'Johannesburg, 2196'],
    client: '8841 2207',
    since: 'марта 2019',
    tier: 'Gold'
  };

  var ACCOUNTS = [
    {
      id: 'ac-everyday',
      name: 'Everyday Gold',
      type: 'Текущий счёт',
      kind: 'transaction',
      number: '62 8134 4417',
      last4: '4417',
      opening: 21480.22,
      art: 'light',
      network: 'VISA',
      tier: 'Gold',
      pan: '4029 88•• •••• 4417',
      rate: 0
    },
    {
      id: 'ac-savings',
      name: 'Demand Savings',
      type: 'Сберегательный счёт',
      kind: 'savings',
      number: '62 8134 9052',
      last4: '9052',
      opening: 61240.00,
      art: 'vault',
      network: '',
      tier: 'Save',
      pan: '',
      rate: 6.85
    },
    {
      id: 'ac-credit',
      name: 'Gold Credit Card',
      type: 'Кредитная карта',
      kind: 'credit',
      number: '4029 88•• •••• 7731',
      last4: '7731',
      opening: -4120.55,
      art: 'dark',
      network: 'VISA',
      tier: 'Credit',
      pan: '4029 88•• •••• 7731',
      limit: 45000,
      rate: 18.25
    }
  ];

  var CATEGORIES = {
    income:        { label: 'Доход',            icon: 'salary' },
    transfer:      { label: 'Перевод',          icon: 'swap' },
    savings:       { label: 'Сбережения',       icon: 'piggy' },
    groceries:     { label: 'Продукты',         icon: 'cart' },
    dining:        { label: 'Кафе и рестораны', icon: 'cup' },
    transport:     { label: 'Транспорт',        icon: 'car' },
    shopping:      { label: 'Покупки',          icon: 'bag' },
    health:        { label: 'Здоровье',         icon: 'heart' },
    entertainment: { label: 'Развлечения',      icon: 'film' },
    home:          { label: 'Жильё',            icon: 'house' },
    utilities:     { label: 'Услуги и связь',   icon: 'bolt' },
    insurance:     { label: 'Страхование',      icon: 'shield' },
    fees:          { label: 'Комиссии',         icon: 'receipt' },
    interest:      { label: 'Проценты',         icon: 'chart' }
  };

  /* ---------- Пул торговых точек ---------------------------------------- */
  var POOL = [
    { m: 'Woolworths Food',      c: 'groceries',     lo: 180,  hi: 940,  ch: 'Card' },
    { m: 'Checkers Hyper',       c: 'groceries',     lo: 140,  hi: 810,  ch: 'Card' },
    { m: 'Pick n Pay',           c: 'groceries',     lo: 95,   hi: 640,  ch: 'Card' },
    { m: 'SPAR Melrose',         c: 'groceries',     lo: 60,   hi: 350,  ch: 'Card' },
    { m: 'Vida e Caffe',         c: 'dining',        lo: 38,   hi: 96,   ch: 'Card' },
    { m: 'Kauai Rosebank',       c: 'dining',        lo: 68,   hi: 155,  ch: 'Card' },
    { m: 'Ocean Basket',         c: 'dining',        lo: 210,  hi: 540,  ch: 'Card' },
    { m: 'Uber Eats',            c: 'dining',        lo: 115,  hi: 395,  ch: 'Online' },
    { m: 'Tashas Bryanston',     c: 'dining',        lo: 180,  hi: 470,  ch: 'Card' },
    { m: 'Uber Trip',            c: 'transport',     lo: 48,   hi: 215,  ch: 'Online' },
    { m: 'Shell Ultra City',     c: 'transport',     lo: 615,  hi: 1150, ch: 'Card' },
    { m: 'Engen Melrose',        c: 'transport',     lo: 580,  hi: 1090, ch: 'Card' },
    { m: 'Gautrain',             c: 'transport',     lo: 42,   hi: 186,  ch: 'Card' },
    { m: 'Takealot.com',         c: 'shopping',      lo: 199,  hi: 1890, ch: 'Online' },
    { m: 'Superbalist',          c: 'shopping',      lo: 250,  hi: 1240, ch: 'Online' },
    { m: 'Cotton On',            c: 'shopping',      lo: 180,  hi: 690,  ch: 'Card' },
    { m: 'Exclusive Books',      c: 'shopping',      lo: 130,  hi: 520,  ch: 'Card' },
    { m: 'Clicks Pharmacy',      c: 'health',        lo: 85,   hi: 615,  ch: 'Card' },
    { m: 'Dis-Chem',             c: 'health',        lo: 110,  hi: 880,  ch: 'Card' },
    { m: 'Ster-Kinekor',         c: 'entertainment', lo: 120,  hi: 330,  ch: 'Card' },
    { m: 'Spotify Premium',      c: 'entertainment', lo: 69,   hi: 70,   ch: 'Online' },
    { m: 'Steam Games',          c: 'entertainment', lo: 149,  hi: 720,  ch: 'Online' },
    { m: 'Builders Warehouse',   c: 'home',          lo: 210,  hi: 1420, ch: 'Card' },
    { m: 'Eskom Prepaid',        c: 'utilities',     lo: 350,  hi: 900,  ch: 'App' }
  ];

  /* ---------- Детерминированный ГПСЧ ------------------------------------ */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  var rand = rng(20260813);
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function between(lo, hi) { return Math.round((lo + rand() * (hi - lo)) * 100) / 100; }
  function intBetween(lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }

  var refSeq = 4180;
  function ref(prefix) {
    refSeq += intBetween(3, 29);
    return prefix + String(refSeq).padStart(6, '0');
  }

  /* ---------- Сборка проводок ------------------------------------------- */
  var TX = [];
  function add(accountId, date, merchant, category, amount, channel, note) {
    TX.push({
      id: 'tx' + (TX.length + 1),
      accountId: accountId,
      date: date,
      merchant: merchant,
      category: category,
      amount: Math.round(amount * 100) / 100,
      channel: channel,
      note: note || '',
      ref: ref(amount > 0 ? 'CR' : 'DT')
    });
  }
  function d(y, m, day, h, min) { return new Date(y, m, day, h == null ? intBetween(7, 21) : h, min == null ? intBetween(0, 59) : min); }
  function lastDay(y, m) { return new Date(y, m + 1, 0).getDate(); }

  var MONTHS = [[2026, 4], [2026, 5], [2026, 6], [2026, 7]]; // май … август
  var prevCardSpend = 3980.40; // задолженность по карте за апрель

  MONTHS.forEach(function (ym) {
    var y = ym[0], m = ym[1];
    var maxDay = (m === TODAY.getMonth() && y === TODAY.getFullYear()) ? TODAY.getDate() : lastDay(y, m);
    var full = maxDay === lastDay(y, m);

    /* — фиксированные списания по текущему счёту — */
    var fixed = [
      [1,  'Sandton Lofts Rentals',  'home',      -12500,   'Debit order', 'Аренда квартиры'],
      [2,  'Bluewater Medical',      'health',    -2890,    'Debit order', 'Медицинский план'],
      [3,  'Virgin Active',          'health',    -899,     'Debit order', 'Абонемент'],
      [5,  'Cape Shield Insure',     'insurance', -1240.5,  'Debit order', 'КАСКО и имущество'],
      [7,  'Vodacom',                'utilities', -749,     'Debit order', 'Мобильная связь'],
      [11, 'City of Joburg',         'utilities', -1186.4,  'Debit order', 'Вода и вывоз мусора'],
      [15, 'Netflix SA',             'entertainment', -199, 'Online',      'Подписка Standard'],
      [15, 'Плата за обслуживание',  'fees',      -69,      'System',      'Пакет Everyday Gold']
    ];
    fixed.forEach(function (f) {
      if (f[0] <= maxDay) add('ac-everyday', d(y, m, f[0], 3, intBetween(10, 55)), f[1], f[2], f[3], f[4], f[5]);
    });

    /* — зарплата — */
    if (25 <= maxDay) {
      add('ac-everyday', d(y, m, 25, 6, 12), 'Northgate Analytics (Pty) Ltd', 'income', 38500, 'EFT credit', 'Заработная плата');
    }

    /* — перевод в сбережения — */
    if (26 <= maxDay) {
      add('ac-everyday', d(y, m, 26, 8, 5), 'Перевод на Demand Savings', 'savings', -4000, 'Internal', 'Регулярное пополнение');
      add('ac-savings',  d(y, m, 26, 8, 5), 'Перевод с Everyday Gold',   'savings',  4000, 'Internal', 'Регулярное пополнение');
    }

    /* — погашение кредитной карты за прошлый месяц — */
    if (28 <= maxDay) {
      var pay = Math.round(prevCardSpend * 100) / 100;
      add('ac-everyday', d(y, m, 28, 9, 30), 'Погашение Gold Credit Card', 'transfer', -pay, 'Internal', 'Полное погашение выписки');
      add('ac-credit',   d(y, m, 28, 9, 30), 'Платёж с Everyday Gold',     'transfer',  pay, 'Internal', 'Полное погашение выписки');
    }

    /* — покупки по текущему счёту — */
    var nEveryday = full ? intBetween(19, 25) : Math.max(6, Math.round(maxDay * 0.72));
    for (var i = 0; i < nEveryday; i++) {
      var p = pick(POOL);
      add('ac-everyday', d(y, m, intBetween(1, maxDay)), p.m, p.c, -between(p.lo, p.hi), p.ch);
    }

    /* — покупки по кредитной карте — */
    var cardSpend = 0;
    var nCard = full ? intBetween(8, 13) : Math.max(3, Math.round(maxDay * 0.35));
    for (var j = 0; j < nCard; j++) {
      var q = pick(POOL);
      var amt = between(q.lo, q.hi);
      cardSpend += amt;
      add('ac-credit', d(y, m, intBetween(1, maxDay)), q.m, q.c, -amt, q.ch);
    }
    prevCardSpend = cardSpend;

    /* — проценты по сбережениям в последний день месяца — */
    if (full) {
      add('ac-savings', d(y, m, maxDay, 23, 45), 'Начисление процентов', 'interest', 0, 'System', 'Ставка 6,85% годовых');
    }

    /* — редкое снятие со сбережений — */
    if (m === 5) {
      add('ac-savings', d(y, m, 18, 14, 20), 'Перевод на Everyday Gold', 'transfer', -7500, 'Internal', 'Ремонт автомобиля');
      add('ac-everyday', d(y, m, 18, 14, 20), 'Перевод с Demand Savings', 'transfer', 7500, 'Internal', 'Ремонт автомобиля');
    }
  });

  /* ---------- Хронология, проценты и текущие остатки --------------------- */
  TX.sort(function (a, b) { return a.date - b.date; });

  var balances = {};
  ACCOUNTS.forEach(function (a) { balances[a.id] = a.opening; });

  TX.forEach(function (t) {
    if (t.category === 'interest') {
      t.amount = Math.round(balances[t.accountId] * 0.0685 / 12 * 100) / 100; // проценты от фактического остатка
      t.ref = 'CR' + t.ref.slice(2); // сумма стала известна только сейчас
    }
    balances[t.accountId] = Math.round((balances[t.accountId] + t.amount) * 100) / 100;
    t.balanceAfter = balances[t.accountId];
  });

  ACCOUNTS.forEach(function (a) {
    a.balance = balances[a.id];
    a.available = a.kind === 'credit'
      ? Math.round((a.limit + a.balance) * 100) / 100
      : a.balance;
  });

  TX.reverse(); // новые сверху

  /* ---------- Производные срезы ------------------------------------------ */
  function txFor(accountId, from, to) {
    return TX.filter(function (t) {
      if (accountId && accountId !== 'all' && t.accountId !== accountId) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }

  function monthList() {
    var seen = [], out = [];
    TX.forEach(function (t) {
      var key = t.date.getFullYear() + '-' + t.date.getMonth();
      if (seen.indexOf(key) === -1) {
        seen.push(key);
        out.push({ key: key, year: t.date.getFullYear(), month: t.date.getMonth() });
      }
    });
    return out;
  }

  function totals(list) {
    var inn = 0, out = 0, fees = 0;
    list.forEach(function (t) {
      if (t.amount >= 0) inn += t.amount; else out += -t.amount;
      if (t.category === 'fees') fees += -t.amount;
    });
    return {
      in: Math.round(inn * 100) / 100,
      out: Math.round(out * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      net: Math.round((inn - out) * 100) / 100
    };
  }

  /* Переводы между своими счетами и погашение карты — не расход:
     деньги остаются у клиента. Бюджет и анализатор считают без них. */
  var INTERNAL = ['transfer', 'savings'];
  function spend(list) {
    return Math.round(list.reduce(function (s, t) {
      return (t.amount < 0 && INTERNAL.indexOf(t.category) === -1) ? s - t.amount : s;
    }, 0) * 100) / 100;
  }

  function byCategory(list) {
    var map = {};
    list.forEach(function (t) {
      if (t.amount >= 0) return;
      map[t.category] = (map[t.category] || 0) + -t.amount;
    });
    return Object.keys(map)
      .map(function (k) { return { category: k, total: Math.round(map[k] * 100) / 100 }; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function openingBalanceAt(accountId, from) {
    // остаток на момент начала периода = баланс после последней проводки до него
    var before = TX.filter(function (t) { return t.accountId === accountId && t.date < from; });
    if (before.length) return before[0].balanceAfter; // TX отсортирован по убыванию
    var acc = ACCOUNTS.filter(function (a) { return a.id === accountId; })[0];
    return acc ? acc.opening : 0;
  }

  /* ---------- Виджеты дашборда ------------------------------------------- */
  var BEHAVIOURS = [
    { id: 'plan',     label: 'План',     icon: 'receipt', p: 78 },
    { id: 'save',     label: 'Копить',   icon: 'piggy',   p: 64 },
    { id: 'debt',     label: 'Долг',     icon: 'doc',     p: 100, on: true },
    { id: 'insure',   label: 'Защита',   icon: 'shield',  p: 46 },
    { id: 'retire',   label: 'Пенсия',   icon: 'seal',    p: 32 },
    { id: 'property', label: 'Жильё',    icon: 'house',   p: 12 }
  ];

  /* Бюджет месяца выводим из истории: средний расход по завершённым месяцам
     с запасом 8%. Так «Финансовый анализатор» никогда не показывает 100%
     из-за выдуманной константы. */
  var BUDGET = (function () {
    var m = {}, done = {};
    TX.forEach(function (t) {
      if (t.amount >= 0 || INTERNAL.indexOf(t.category) !== -1) return;
      var k = t.date.getFullYear() + '-' + t.date.getMonth();
      m[k] = (m[k] || 0) + -t.amount;
      if (!(t.date.getFullYear() === TODAY.getFullYear() && t.date.getMonth() === TODAY.getMonth())) done[k] = true;
    });
    var keys = Object.keys(done);
    if (!keys.length) return 20000;
    var avg = keys.reduce(function (s, k) { return s + m[k]; }, 0) / keys.length;
    return Math.round(avg * 1.08 / 100) * 100;
  })();

  global.DB = {
    TODAY: TODAY,
    BANK: BANK,
    USER: USER,
    ACCOUNTS: ACCOUNTS,
    CATEGORIES: CATEGORIES,
    TX: TX,
    BEHAVIOURS: BEHAVIOURS,
    BUDGET: BUDGET,
    txFor: txFor,
    monthList: monthList,
    totals: totals,
    spend: spend,
    byCategory: byCategory,
    openingBalanceAt: openingBalanceAt,
    account: function (id) { return ACCOUNTS.filter(function (a) { return a.id === id; })[0]; },
    portfolio: function () {
      return Math.round(ACCOUNTS.reduce(function (s, a) { return s + a.balance; }, 0) * 100) / 100;
    },
    /* Доступно = собственные деньги на счетах. Кредитный лимит сюда не
       попадает: иначе «доступно» оказалось бы больше баланса портфеля. */
    portfolioAvailable: function () {
      return Math.round(ACCOUNTS.reduce(function (s, a) {
        return a.kind === 'credit' ? s : s + a.available;
      }, 0) * 100) / 100;
    }
  };
})(window);
