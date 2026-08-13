/* =========================================================================
   Mockup data. Everything is deterministic: the same seed produces the same
   history on every load, and account balances are NOT hand-written — they are
   derived from the postings, so a statement reconciles with the dashboard.
   ========================================================================= */
(function (global) {
  'use strict';

  var TODAY = new Date(2026, 7, 13, 16, 51); // 13 August 2026

  var MON_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];

  /* Требуемый общий баланс портфеля. Опорный остаток сберегательного счёта
     подбирается под эту цифру, поэтому проводки и выписка остаются честными. */
  var TARGET_PORTFOLIO = 284647.22;

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
    since: 'March 2019',
    tier: 'Gold'
  };

  var ACCOUNTS = [
    {
      id: 'ac-everyday',
      name: 'Everyday Gold',
      type: 'Transaction account',
      kind: 'transaction',
      number: '10298470551',
      last4: '0551',
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
      type: 'Savings account',
      kind: 'savings',
      number: '10298471244',
      last4: '1244',
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
      type: 'Credit card',
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
    income:        { label: 'Income',            icon: 'salary' },
    transfer:      { label: 'Transfers',         icon: 'swap' },
    savings:       { label: 'Savings Transfers', icon: 'piggy' },
    groceries:     { label: 'Groceries',         icon: 'cart' },
    dining:        { label: 'Eating Out',        icon: 'cup' },
    transport:     { label: 'Transport',         icon: 'car' },
    shopping:      { label: 'Shopping',          icon: 'bag' },
    health:        { label: 'Health',            icon: 'heart' },
    entertainment: { label: 'Entertainment',     icon: 'film' },
    home:          { label: 'Home',              icon: 'house' },
    utilities:     { label: 'Utilities',         icon: 'bolt' },
    insurance:     { label: 'Insurance',         icon: 'shield' },
    fees:          { label: 'Bank Fees',         icon: 'receipt' },
    interest:      { label: 'Interest',          icon: 'chart' }
  };

  /* ---------- Merchant pool --------------------------------------------- */
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

  /* ---------- Deterministic PRNG ---------------------------------------- */
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
  function round2(v) { return Math.round(v * 100) / 100; }

  var refSeq = 4180;
  function ref(prefix) {
    refSeq += intBetween(3, 29);
    return prefix + String(refSeq).padStart(6, '0');
  }

  /* ---------- Postings --------------------------------------------------- */
  var TX = [];
  function add(accountId, date, merchant, category, amount, channel, extra) {
    extra = extra || {};
    TX.push({
      id: 'tx' + (TX.length + 1),
      accountId: accountId,
      date: date,
      merchant: merchant,
      category: category,
      amount: round2(amount),
      channel: channel,
      note: extra.note || '',
      from: extra.from || '',
      to: extra.to || '',
      ref: ref(amount > 0 ? 'CR' : 'DT')
    });
  }
  function d(y, m, day, h, min) {
    return new Date(y, m, day, h == null ? intBetween(7, 21) : h, min == null ? intBetween(0, 59) : min);
  }
  function lastDay(y, m) { return new Date(y, m + 1, 0).getDate(); }

  var AC_EVERYDAY = ACCOUNTS[0].number, AC_SAVINGS = ACCOUNTS[1].number, AC_CREDIT = ACCOUNTS[2].number;
  var MONTHS = [[2026, 4], [2026, 5], [2026, 6], [2026, 7]]; // May … August
  var prevCardSpend = 3980.40; // April card balance carried into May

  MONTHS.forEach(function (ym) {
    var y = ym[0], m = ym[1];
    var maxDay = (m === TODAY.getMonth() && y === TODAY.getFullYear()) ? TODAY.getDate() : lastDay(y, m);
    var full = maxDay === lastDay(y, m);

    /* — recurring debit orders on the transaction account — */
    var fixed = [
      [1,  'Sandton Lofts Rentals',  'home',          -12500,  'Debit order', 'Monthly rent'],
      [2,  'Bluewater Medical',      'health',        -2890,   'Debit order', 'Medical plan'],
      [3,  'Virgin Active',          'health',        -899,    'Debit order', 'Gym membership'],
      [5,  'Cape Shield Insure',     'insurance',     -1240.5, 'Debit order', 'Car and home cover'],
      [7,  'Vodacom',                'utilities',     -749,    'Debit order', 'Mobile contract'],
      [11, 'City of Joburg',         'utilities',     -1186.4, 'Debit order', 'Water and refuse'],
      [15, 'Netflix SA',             'entertainment', -199,    'Online',      'Standard plan'],
      [15, 'Monthly account fee',    'fees',          -69,     'System',      'Everyday Gold bundle']
    ];
    fixed.forEach(function (f) {
      if (f[0] <= maxDay) {
        add('ac-everyday', d(y, m, f[0], 3, intBetween(10, 55)), f[1], f[2], f[3], f[4],
          { note: f[5], from: AC_EVERYDAY });
      }
    });

    /* — salary — */
    if (25 <= maxDay) {
      add('ac-everyday', d(y, m, 25, 6, 12), 'Northgate Analytics (Pty) Ltd', 'income', 38500, 'EFT credit',
        { note: 'Monthly salary', to: AC_EVERYDAY });
    }

    /* — monthly savings transfer, both legs — */
    if (26 <= maxDay) {
      add('ac-everyday', d(y, m, 26, 8, 5), 'Savings for ' + MON_NAMES[m], 'savings', -4000, 'Transfer',
        { note: 'Standing transfer', from: AC_EVERYDAY, to: AC_SAVINGS });
      add('ac-savings',  d(y, m, 26, 8, 5), 'Savings for ' + MON_NAMES[m], 'savings', 4000, 'Transfer',
        { note: 'Standing transfer', from: AC_EVERYDAY, to: AC_SAVINGS });
    }

    /* — credit card settlement for the previous month — */
    if (28 <= maxDay) {
      var pay = round2(prevCardSpend);
      add('ac-everyday', d(y, m, 28, 9, 30), 'Credit card payment', 'transfer', -pay, 'Transfer',
        { note: 'Full statement settled', from: AC_EVERYDAY, to: AC_CREDIT });
      add('ac-credit',   d(y, m, 28, 9, 30), 'Credit card payment', 'transfer',  pay, 'Transfer',
        { note: 'Full statement settled', from: AC_EVERYDAY, to: AC_CREDIT });
    }

    /* — card spend on the transaction account — */
    var nEveryday = full ? intBetween(19, 25) : Math.max(6, Math.round(maxDay * 0.72));
    for (var i = 0; i < nEveryday; i++) {
      var p = pick(POOL);
      add('ac-everyday', d(y, m, intBetween(1, maxDay)), p.m, p.c, -between(p.lo, p.hi), p.ch, { from: AC_EVERYDAY });
    }

    /* — credit card spend — */
    var cardSpend = 0;
    var nCard = full ? intBetween(8, 13) : Math.max(3, Math.round(maxDay * 0.35));
    for (var j = 0; j < nCard; j++) {
      var q = pick(POOL);
      var amt = between(q.lo, q.hi);
      cardSpend += amt;
      add('ac-credit', d(y, m, intBetween(1, maxDay)), q.m, q.c, -amt, q.ch, { from: AC_CREDIT });
    }
    prevCardSpend = cardSpend;

    /* — interest on the savings account, last day of the month — */
    if (full) {
      add('ac-savings', d(y, m, maxDay, 23, 45), 'Credit interest', 'interest', 0, 'System',
        { note: '6.85% per annum', to: AC_SAVINGS });
    }

    /* — one-off withdrawal from savings — */
    if (m === 5) {
      add('ac-savings',  d(y, m, 18, 14, 20), 'Car repairs', 'transfer', -7500, 'Transfer',
        { note: 'Own transfer', from: AC_SAVINGS, to: AC_EVERYDAY });
      add('ac-everyday', d(y, m, 18, 14, 20), 'Car repairs', 'transfer',  7500, 'Transfer',
        { note: 'Own transfer', from: AC_SAVINGS, to: AC_EVERYDAY });
    }
  });

  /* ---------- Chronology, interest and closing balances ------------------ */
  TX.sort(function (a, b) { return a.date - b.date; });

  function computeBalances() {
    var bal = {};
    ACCOUNTS.forEach(function (a) { bal[a.id] = a.opening; });
    TX.forEach(function (t) {
      if (t.category === 'interest') {
        // проценты считаются от фактического остатка, поэтому пересчитываются
        // на каждой итерации подбора опорного баланса
        t.amount = round2(bal[t.accountId] * 0.0685 / 12);
        t.ref = 'CR' + t.ref.slice(2);
      }
      bal[t.accountId] = round2(bal[t.accountId] + t.amount);
      t.balanceAfter = bal[t.accountId];
    });
    return bal;
  }

  /* Подбираем опорный остаток сберегательного счёта так, чтобы портфель сошёлся
     с TARGET_PORTFOLIO. Проценты зависят от остатка, поэтому итерируем: каждый
     проход уменьшает невязку примерно в 175 раз. */
  var savingsAcc = ACCOUNTS[1], balances;
  for (var pass = 0; pass < 12; pass++) {
    balances = computeBalances();
    var total = round2(ACCOUNTS.reduce(function (s, a) { return s + balances[a.id]; }, 0));
    var diff = round2(TARGET_PORTFOLIO - total);
    if (diff === 0) break;
    savingsAcc.opening = round2(savingsAcc.opening + diff);
  }

  ACCOUNTS.forEach(function (a) {
    a.balance = balances[a.id];
    a.available = a.kind === 'credit' ? round2(a.limit + a.balance) : a.balance;
  });

  TX.reverse(); // newest first

  /* ---------- Derived slices --------------------------------------------- */
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
    return { in: round2(inn), out: round2(out), fees: round2(fees), net: round2(inn - out) };
  }

  /* Переводы между своими счетами и погашение карты расходом не считаются:
     деньги остаются у клиента. Бюджет и анализатор работают без них. */
  var INTERNAL = ['transfer', 'savings'];
  function spend(list) {
    return round2(list.reduce(function (s, t) {
      return (t.amount < 0 && INTERNAL.indexOf(t.category) === -1) ? s - t.amount : s;
    }, 0));
  }

  function byCategory(list) {
    var map = {};
    list.forEach(function (t) {
      if (t.amount >= 0) return;
      map[t.category] = (map[t.category] || 0) + -t.amount;
    });
    return Object.keys(map)
      .map(function (k) { return { category: k, total: round2(map[k]) }; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function openingBalanceAt(accountId, from) {
    var before = TX.filter(function (t) { return t.accountId === accountId && t.date < from; });
    if (before.length) return before[0].balanceAfter; // TX отсортирован по убыванию
    var acc = ACCOUNTS.filter(function (a) { return a.id === accountId; })[0];
    return acc ? acc.opening : 0;
  }

  /* ---------- Dashboard widgets ------------------------------------------ */
  var BEHAVIOURS = [
    { id: 'plan',     label: 'Plan',     icon: 'receipt', p: 78 },
    { id: 'save',     label: 'Savings',  icon: 'piggy',   p: 64 },
    { id: 'debt',     label: 'Debt',     icon: 'doc',     p: 100, on: true },
    { id: 'insure',   label: 'Insure',   icon: 'shield',  p: 46 },
    { id: 'retire',   label: 'Retire',   icon: 'seal',    p: 32 },
    { id: 'property', label: 'Property', icon: 'house',   p: 12 }
  ];

  /* Бюджет выводим из истории: средний расход по завершённым месяцам плюс 8%. */
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
      return round2(ACCOUNTS.reduce(function (s, a) { return s + a.balance; }, 0));
    },
    /* Доступно = собственные деньги. Кредитный лимит сюда не попадает. */
    portfolioAvailable: function () {
      return round2(ACCOUNTS.reduce(function (s, a) {
        return a.kind === 'credit' ? s : s + a.available;
      }, 0));
    }
  };
})(window);
