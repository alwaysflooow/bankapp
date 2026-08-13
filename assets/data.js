/* =========================================================================
   Mockup data.

   Постоянная часть (15 апреля — 28 июля) перенесена из присланной выписки
   один в один. Периоды до 15 апреля и август сгенерированы детерминированно
   в той же логике: те же торговые точки, те же типы проводок, тот же ритм
   зарплатных SWIFT-поступлений раз в две недели.

   Баланс нигде не задан руками: он считается из проводок от opening balance
   на 17 марта. Два «подгоночных» перевода в накопления выводятся решателем
   так, чтобы сойтись с контрольными точками выписки:
     · 273 384.31 — opening balance выписки на 15 апреля
     · 284 647.22 — текущий остаток на 13 августа
   ========================================================================= */
(function (global) {
  'use strict';

  var TODAY = new Date(2026, 7, 13, 16, 51);   // 13 August 2026
  var PERIOD_START = new Date(2026, 2, 17);    // 17 March 2026
  var OPENING = 228821.19;                     // остаток на начало периода
  var ANCHOR_APR15 = 273384.31;                // контрольная точка из выписки
  var TARGET_CLOSING = 284647.22;              // текущий остаток

  var BANK = {
    name: 'Discovery Bank',
    legal: 'Discovery Bank Limited',
    reg: 'Reg. 2015/408745/06 · FSP 48657 · NCRCP 9997',
    branch: '679000',
    swift: 'DISCZAJJ',
    address: '1 Discovery Place, Sandton, 2196',
    support: '0800 07 96 97',
    currency: 'ZAR',
    symbol: 'R'
  };

  var USER = {
    username: '+27662582832',
    password: '0605',
    first: 'Charne',
    last: 'Puren',
    initials: 'CP',
    email: 'charne.puren@example.co.za',
    emailMasked: 'c•••••.p••••@example.co.za',
    phoneMasked: '+27 •• ••• 2832',
    idMasked: '9207•••••08 2',
    address: ['24 Rietfontein Road', 'Boksburg', 'Gauteng, 1459'],
    client: '4471 0298',
    since: 'June 2021',
    tier: 'Gold'
  };

  var ACCOUNTS = [
    {
      id: 'ac-gold',
      name: 'Discovery Gold Transaction Account',
      shortName: 'Gold Transaction Account',
      type: 'Transaction account',
      kind: 'transaction',
      number: '14902470882',
      last4: '0882',
      opening: OPENING,
      art: 'light',
      network: 'VISA',
      tier: 'Gold',
      pan: '4029 88•• •••• 2740',
      rate: 0
    }
  ];

  var CARDS = [
    { last4: '2740', name: 'Discovery Gold Card',    kind: 'Primary debit card',   pan: '4029 88•• •••• 2740' },
    { last4: '9441', name: 'Discovery Virtual Card', kind: 'Virtual card, online', pan: '4029 88•• •••• 9441' }
  ];

  var CATEGORIES = {
    income:    { label: 'Income',            icon: 'salary' },
    savings:   { label: 'Savings Transfers', icon: 'piggy' },
    transfers: { label: 'Transfers',         icon: 'swap' },
    groceries: { label: 'Groceries',         icon: 'cart' },
    dining:    { label: 'Eating Out',        icon: 'cup' },
    transport: { label: 'Transport',         icon: 'car' },
    travel:    { label: 'Travel',            icon: 'travel' },
    shopping:  { label: 'Shopping',          icon: 'bag' },
    entertain: { label: 'Entertainment',     icon: 'film' },
    home:      { label: 'Home',              icon: 'house' },
    comms:     { label: 'Communication',     icon: 'phone' },
    cash:      { label: 'Cash',              icon: 'bank' },
    debt:      { label: 'Debt Repayment',    icon: 'chart' },
    fees:      { label: 'Bank Fees',         icon: 'doc' },
    other:     { label: 'Other',             icon: 'receipt' }
  };

  /* ---------- Deterministic PRNG ---------------------------------------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  var rand = rng(20260317);
  function pick(a) { return a[Math.floor(rand() * a.length)]; }
  function between(lo, hi) { return Math.round((lo + rand() * (hi - lo)) * 100) / 100; }
  function intBetween(lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
  function round2(v) { return Math.round(v * 100) / 100; }

  var ACC = ACCOUNTS[0].number;
  var ACC_SAVINGS = '14902477096';   // «...7096» из межсчётного перевода в выписке
  var TX = [];
  var refSeq = 3100;

  /* type: POS Purchase | EFT | Online | Transfer | Fee */
  function add(date, type, card, merchant, amount, category, extra) {
    extra = extra || {};
    refSeq += intBetween(3, 27);
    TX.push({
      id: 'tx' + (TX.length + 1),
      accountId: 'ac-gold',
      date: date,
      type: type,
      card: card || '',
      merchant: merchant,
      category: category,
      amount: round2(amount),
      note: extra.note || '',
      from: extra.from || (amount < 0 ? ACC : ''),
      to: extra.to || (amount > 0 ? ACC : ''),
      ref: (amount > 0 ? 'CR' : 'DT') + String(refSeq).padStart(6, '0')
    });
    return TX[TX.length - 1];
  }

  /* Правдоподобное время суток по типу проводки — в выписке его нет. */
  function at(y, m, d, type) {
    if (type === 'Fee') return new Date(y, m, d, 3, intBetween(5, 55));
    if (type === 'EFT' || type === 'Transfer') return new Date(y, m, d, intBetween(6, 10), intBetween(0, 59));
    return new Date(y, m, d, intBetween(8, 21), intBetween(0, 59));
  }

  /* ================================================================= */
  /* Блок 1. 17 марта — 14 апреля: сгенерирован в логике выписки       */
  /* ================================================================= */

  /* ЮАР-период: те же торговые точки, что в апрельской части выписки */
  var POOL_ZA = [
    ['Superspar The Squar', 'groceries', 60, 340],
    ['Sasol Rietfontein',   'transport', 45, 620],
    ['Yoco *Plato Boksb',   'dining',    38, 260],
    ['Yoco *Jayz Joint',    'dining',    95, 390],
    ['Cappello Boksburg10', 'dining',    80, 320],
    ['Xpresso 19',          'dining',    20, 90],
    ['Postnet East Rand C', 'other',     21, 180],
    ['Neva Neolin',         'other',     95, 240],
    ['DI Uber',             'transport', 45, 180],
    ['DI Bolt',             'transport', 38, 150],
    ['DI New Uber Eats',    'dining',    95, 310],
    ['Hpy*Sirjana Cell',    'comms',     120, 340],
    ['Mrd',                 'other',     80, 220],
    ['Checkers Rietfontn',  'groceries', 110, 480]
  ];

  var swiftSeq = 0;
  var SWIFT_CODES = ['RO26Wq4Lm10', 'RO26Vb7Nx40', 'RO26T6F720', 'RO26Sbb130', 'RO26Rq0Kr0',
                     'RO26R9Mcj0', 'RO26Qdnl60', 'RO26Pphg90', 'RO26M1L920', 'RO26Kt3Vd80'];

  function swift(y, m, d, amount, weeks) {
    var code = SWIFT_CODES[swiftSeq++ % SWIFT_CODES.length];
    return add(at(y, m, d, 'EFT'), 'EFT', '', 'Inward SWIFT ' + code + ' Wise Payments',
      amount, 'income', { note: 'Payslip weeks ' + weeks, from: 'Wise Payments' });
  }

  /* зарплатные поступления раз в две недели */
  swift(2026, 2, 21, 29148.63, '7-8');
  swift(2026, 3, 4, 30112.45, '9-10');

  /* регулярные списания */
  add(at(2026, 2, 20, 'Online'), 'Online', '9441', 'Netflix Za', -99.00, 'entertain');
  add(at(2026, 2, 25, 'POS Purchase'), 'POS Purchase', '2740', 'Spotifyza', -69.99, 'entertain');
  add(at(2026, 3, 1, 'EFT'), 'EFT', '', 'Rent Boksburgirene', -4990.00, 'home', { note: 'Monthly rent' });
  add(at(2026, 3, 1, 'EFT'), 'EFT', '', 'Phone Payment', -350.00, 'comms');
  add(at(2026, 3, 7, 'Fee'), 'Fee', '', 'Monthly Account Fee', -275.00, 'fees');
  add(at(2026, 3, 7, 'Fee'), 'Fee', '', 'Service Fees', -85.00, 'fees');
  add(at(2026, 3, 9, 'Online'), 'Online', '9441', 'Netflix Za', -99.00, 'entertain');
  add(at(2026, 3, 12, 'EFT'), 'EFT', '', 'Off-Us Debt', -3200.00, 'debt');

  /* карточные покупки */
  var genDays = [17, 18, 19, 22, 23, 26, 27, 29, 30, 31];  // март
  genDays.forEach(function (d) {
    var p = pick(POOL_ZA);
    add(at(2026, 2, d, 'POS Purchase'), 'POS Purchase', rand() < 0.82 ? '2740' : '9441', p[0], -between(p[2], p[3]), p[1]);
  });
  [2, 3, 5, 6, 8, 9, 11, 13, 14].forEach(function (d) {   // апрель
    var p = pick(POOL_ZA);
    add(at(2026, 3, d, 'POS Purchase'), 'POS Purchase', rand() < 0.82 ? '2740' : '9441', p[0], -between(p[2], p[3]), p[1]);
  });

  /* подгоночный перевод в накопления — считается ниже решателем */
  var anchorTx = add(at(2026, 3, 10, 'Transfer'), 'Transfer', '', 'Savings For 90 Days',
    -1, 'savings', { to: ACC_SAVINGS });

  /* ================================================================= */
  /* Блок 2. 15 апреля — 28 июля: строки выписки без изменений         */
  /* ================================================================= */

  /* [день, месяц(0-based), тип, карта, назначение, сумма, категория, примечание] */
  var STATEMENT = [
    [15, 3, 'POS Purchase', '2740', 'Sasol Rietfontein', -56.50, 'transport'],
    [16, 3, 'POS Purchase', '2740', 'Superspar The Squar', -16.24, 'groceries'],
    [18, 3, 'POS Purchase', '2740', 'Yoco *Plato Boksb', -55.20, 'dining'],
    [18, 3, 'EFT', '', 'Inward SWIFT RO26T6F720 Wise Payments', 31725.61, 'income', 'Payslip weeks 11-12'],
    [18, 3, 'POS Purchase', '9441', 'Mrd', -158.40, 'other'],
    [18, 3, 'POS Purchase', '2740', 'Superspar The Squar', -223.04, 'groceries'],
    [20, 3, 'POS Purchase', '2740', 'Superspar The Squar', -120.65, 'groceries'],
    [20, 3, 'Online', '9441', 'Netflix Za', -99.00, 'entertain'],
    [21, 3, 'POS Purchase', '2740', 'Hpy*Sirjana Cell', -300.55, 'comms'],
    [21, 3, 'Transfer', '', 'Inter account transfer to account...7096 M', 50.00, 'transfers'],
    [21, 3, 'POS Purchase', '2740', 'Yoco *Plato Boksb', -51.60, 'dining'],
    [23, 3, 'POS Purchase', '2740', 'Superspar The Squar', -297.38, 'groceries'],
    [23, 3, 'POS Purchase', '2740', 'Yoco *Jayz Joint', -380.00, 'dining'],
    [24, 3, 'POS Purchase', '2740', '9.47 12Go', -182.89, 'travel'],
    [25, 3, 'Fee', '', 'Debit Order fee', -2.00, 'fees'],
    [25, 3, 'Online', '', 'Phone Payment', -350.00, 'comms'],
    [25, 3, 'Transfer', '', 'Savings For 90 Days', -28666.97, 'savings'],

    [1, 4, 'POS Purchase', '2740', 'Superspar The Squar', -140.26, 'groceries'],
    [2, 4, 'POS Purchase', '2740', 'Xpresso 19', -20.00, 'dining'],
    [2, 4, 'POS Purchase', '2740', 'Sasol Rietfontein', -130.00, 'transport'],
    [4, 4, 'POS Purchase', '2740', 'Cappello Boksburg10', -286.49, 'dining'],
    [5, 4, 'EFT', '', 'Inward SWIFT RO26Sbb130 Wise Payments', 28213.51, 'income', 'Payslip weeks 13-14'],
    [5, 4, 'POS Purchase', '2740', 'Postnet East Rand C', -21.00, 'other'],
    [5, 4, 'POS Purchase', '9441', 'DI New Uber Eats', -136.28, 'dining'],
    [6, 4, 'POS Purchase', '2740', 'Neva Neolin', -187.05, 'other'],
    [6, 4, 'POS Purchase', '9441', 'DI Uber', -78.00, 'transport'],
    [7, 4, 'POS Purchase', '2740', 'Dubai Duty Free', -235.20, 'shopping'],
    [7, 4, 'Transfer', '', 'Savings For 90 Days', -10000.00, 'savings'],
    [7, 4, 'Fee', '', 'Monthly Account Fee', -275.00, 'fees'],
    [7, 4, 'Fee', '', 'Service Fees', -85.00, 'fees'],
    [8, 4, 'POS Purchase', '2740', 'DI Bolt', -47.00, 'transport'],
    [12, 4, 'POS Purchase', '2740', "Lotus'S 6447 Koh Ph", -407.54, 'groceries'],
    [14, 4, 'EFT', '', 'International Cash 25250.00 Lotus', -13329.60, 'cash'],
    [15, 4, 'POS Purchase', '9441', 'Kiteflip.Co', -2182.61, 'shopping'],
    [19, 4, 'EFT', '', 'Inward SWIFT RO26Rq0Kr0 Wise Payments', 30550.21, 'income', 'Payslip weeks 15-16'],
    [20, 4, 'POS Purchase', '2740', '711 Hatchaophao', -123.94, 'groceries'],
    [20, 4, 'EFT', '', 'Rent Boksburgirene', -4990.00, 'home'],
    [20, 4, 'Online', '9441', 'Netflix Za', -99.00, 'entertain'],
    [22, 4, 'EFT', '', 'International Cash 6250.00 K.Sira', -3312.94, 'cash'],
    [25, 4, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -74.74, 'dining'],
    [25, 4, 'POS Purchase', '2740', 'Spotifyza', -69.99, 'entertain'],
    [29, 4, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -92.72, 'dining'],

    [1, 5, 'POS Purchase', '2740', 'Pttst.D Sriphom Pet', -97.88, 'other'],
    [1, 5, 'POS Purchase', '2740', '7 11 Kophangan Serv', -128.27, 'groceries'],
    [1, 5, 'EFT', '', 'International Cash 16250.00 Seeth', -8370.74, 'cash'],
    [2, 5, 'POS Purchase', '2740', '711 Ban Sithanu', -167.41, 'groceries'],
    [2, 5, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -257.56, 'dining'],
    [3, 5, 'POS Purchase', '2740', '711 Kophangan Serv', -105.08, 'groceries'],
    [3, 5, 'EFT', '', 'Phone Payment', -280.00, 'comms'],
    [3, 5, 'EFT', '', 'Sussa', -650.00, 'other'],
    [3, 5, 'EFT', '', 'Payshap Account Off-Us Emergency Funds.', -1000.00, 'transfers'],
    [3, 5, 'POS Purchase', '2740', 'S2S*Valuecobayside', -3100.00, 'shopping'],
    [4, 5, 'EFT', '', 'Inward SWIFT RO26R9Mcj0 Wise Payments', 29374.28, 'income', 'Payslip weeks 17-18'],
    [4, 5, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -180.61, 'dining'],
    [4, 5, 'EFT', '', 'Off-Us Debt', -7100.00, 'debt'],
    [5, 5, 'POS Purchase', '2740', "Lotus'S 6447 Koh Ph", -724.39, 'groceries'],
    [5, 5, 'EFT', '', 'International Cash 18250.00 Seeth', -9409.34, 'cash'],
    [6, 5, 'Fee', '', 'Monthly Account Fee', -275.00, 'fees'],
    [6, 5, 'Fee', '', 'Service Fees', -425.00, 'fees'],
    [8, 5, 'EFT', '', 'International Cash 13250.00 Koh P', -6934.60, 'cash'],
    [17, 5, 'EFT', '', 'Travel', -12000.00, 'travel'],
    [17, 5, 'Transfer', '2740', 'Savings For 90 Days', 5000.00, 'savings'],
    [18, 5, 'EFT', '9441', 'Inward SWIFT RO26Qdnl60 Wise Payments', 29375.28, 'income', 'Payslip weeks 19-20'],
    [18, 5, 'POS Purchase', '', 'Zama Resort Koh Pha', -159.33, 'dining'],
    [19, 5, 'Online', '9441', 'Netflix Za', -99.00, 'entertain'],
    [19, 5, 'EFT', '', 'International Cash 10250.00 7-11', -5267.99, 'cash'],
    [25, 5, 'POS Purchase', '2740', '7 11 Ban Sithanu', -150.48, 'groceries'],
    [26, 5, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -200.75, 'dining'],
    [28, 5, 'POS Purchase', '2740', '7 11 Kophangan Serv', -120.33, 'groceries'],
    [30, 5, 'POS Purchase', '2740', 'Spotifyza', -69.99, 'entertain'],
    [30, 5, 'EFT', '', 'International Cash 9750.00 7-11 B', -4979.41, 'cash'],

    [1, 6, 'EFT', '', 'Rent - Boksburgirene', -4990.00, 'home'],
    [1, 6, 'EFT', '', 'Off-Us Phone Payment', -350.00, 'comms'],
    [1, 6, 'EFT', '', 'Debt', -2000.00, 'debt'],
    [2, 6, 'EFT', '', 'International Cash 30250.00 7-11', -15429.19, 'cash'],
    [4, 6, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -300.45, 'dining'],
    [5, 6, 'EFT', '', 'Inward SWIFT RO26Pphg90 Wise Payments', 25852.12, 'income', 'Payslip weeks 21-22'],
    [7, 6, 'Fee', '', 'Monthly Account Fee', -285.00, 'fees'],
    [7, 6, 'Fee', '', 'Service Fees', -425.00, 'fees'],
    [9, 6, 'POS Purchase', '2740', "Lotus'S 6447 Koh Ph", -500.89, 'groceries'],
    [13, 6, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -450.21, 'dining'],
    [15, 6, 'Transfer', '', 'Savings For 90 Days', -25000.00, 'savings'],
    [16, 6, 'Online', '9441', 'Netflix Za', -99.00, 'entertain'],
    [18, 6, 'POS Purchase', '2740', '7 11 Ban Sithanu', -120.73, 'groceries'],
    [19, 6, 'EFT', '', 'Inward SWIFT RO26M1L920 Wise Payments', 32898.88, 'income', 'Payslip weeks 23-24'],
    [20, 6, 'EFT', '', 'International Cash 10250.00 7-11', -5267.99, 'cash'],
    [22, 6, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -250.60, 'dining'],
    [24, 6, 'POS Purchase', '9441', '7 11 Kophangan Serv', -110.42, 'groceries'],
    [26, 6, 'POS Purchase', '2740', 'Zama Resort Koh Pha', -150.37, 'dining'],
    [27, 6, 'POS Purchase', '', 'International Cash 24250.00 Samui', -12960.07, 'cash'],
    [28, 6, 'POS Purchase', '2740', '7 11 Chaweng Samui', -200.22, 'groceries'],
    [28, 6, 'POS Purchase', '2740', 'W Koh Samui', -4500.15, 'travel'],
    [28, 6, 'POS Purchase', '2740', 'Spotifyza', -69.99, 'entertain']
  ];

  STATEMENT.forEach(function (r) {
    var extra = { note: r[7] || '' };
    if (r[4].indexOf('Inward SWIFT') === 0) extra.from = 'Wise Payments';
    if (r[4].indexOf('Savings For 90 Days') === 0) extra[r[5] < 0 ? 'to' : 'from'] = ACC_SAVINGS;
    if (r[4].indexOf('Inter account transfer') === 0) extra.from = ACC_SAVINGS;
    add(at(2026, r[1], r[0], r[2]), r[2], r[3], r[4], r[5], r[6], extra);
  });

  /* ================================================================= */
  /* Блок 3. Август: сгенерирован, 10 проводок                         */
  /* ================================================================= */

  add(at(2026, 7, 1, 'EFT'), 'EFT', '', 'Rent - Boksburgirene', -4990.00, 'home', { note: 'Monthly rent' });
  add(at(2026, 7, 3, 'POS Purchase'), 'POS Purchase', '2740', 'Zama Resort Koh Pha', -285.40, 'dining');
  add(at(2026, 7, 5, 'POS Purchase'), 'POS Purchase', '2740', '7 11 Chaweng Samui', -160.85, 'groceries');
  add(at(2026, 7, 7, 'Fee'), 'Fee', '', 'Monthly Account Fee', -285.00, 'fees');
  add(at(2026, 7, 7, 'Fee'), 'Fee', '', 'Service Fees', -425.00, 'fees');
  add(at(2026, 7, 9, 'POS Purchase'), 'POS Purchase', '2740', "Lotus'S 6447 Koh Ph", -612.30, 'groceries');
  add(at(2026, 7, 11, 'Online'), 'Online', '9441', 'Netflix Za', -99.00, 'entertain');
  add(at(2026, 7, 12, 'EFT'), 'EFT', '', 'International Cash 12250.00 Samui', -6318.47, 'cash');
  add(new Date(2026, 7, 13, 7, 22), 'EFT', '', 'Inward SWIFT RO26Kt3Vd80 Wise Payments', 28717.18, 'income',
    { note: 'Payslip weeks 25-26', from: 'Wise Payments' });

  /* подгоночный перевод в накопления — считается решателем ниже */
  var closingTx = add(new Date(2026, 7, 13, 9, 40), 'Transfer', '', 'Savings For 90 Days',
    -1, 'savings', { to: ACC_SAVINGS });

  /* ================================================================= */
  /* Хронология, решатель и остатки                                    */
  /* ================================================================= */
  TX.sort(function (a, b) { return a.date - b.date; });

  function runBalances() {
    var bal = OPENING;
    TX.forEach(function (t) {
      bal = round2(bal + t.amount);
      t.balanceAfter = bal;
    });
    return bal;
  }

  /* остаток непосредственно перед первой проводкой выписки (15 апреля) */
  var APR15 = new Date(2026, 3, 15, 0, 0, 0);
  function balanceBeforeApr15() {
    var bal = OPENING;
    for (var i = 0; i < TX.length; i++) {
      if (TX[i].date >= APR15) break;
      bal = round2(bal + TX[i].amount);
    }
    return bal;
  }

  // 1) подгоняем блок 1 под opening balance выписки
  anchorTx.amount = round2(anchorTx.amount - (balanceBeforeApr15() - ANCHOR_APR15));
  // 2) подгоняем август под текущий остаток
  closingTx.amount = round2(closingTx.amount - (runBalances() - TARGET_CLOSING));
  runBalances();

  var closing = TX[TX.length - 1].balanceAfter;
  ACCOUNTS[0].balance = closing;
  ACCOUNTS[0].available = closing;

  TX.reverse(); // newest first

  /* ---------- Derived slices --------------------------------------------- */
  function txFor(accountId, from, to) {
    return TX.filter(function (t) {
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

  /* Переводы на собственные накопления расходом не считаются. */
  var INTERNAL = ['savings', 'transfers'];
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
    var before = TX.filter(function (t) { return t.date < from; });
    return before.length ? before[0].balanceAfter : OPENING;
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

  /* Бюджет — средний расход по завершённым месяцам плюс 8%. */
  var BUDGET = (function () {
    var m = {}, done = {};
    TX.forEach(function (t) {
      if (t.amount >= 0 || INTERNAL.indexOf(t.category) !== -1) return;
      var k = t.date.getFullYear() + '-' + t.date.getMonth();
      m[k] = (m[k] || 0) + -t.amount;
      if (!(t.date.getFullYear() === TODAY.getFullYear() && t.date.getMonth() === TODAY.getMonth())) done[k] = true;
    });
    var keys = Object.keys(done).filter(function (k) { return k !== '2026-2'; }); // март неполный
    if (!keys.length) return 20000;
    var avg = keys.reduce(function (s, k) { return s + m[k]; }, 0) / keys.length;
    return Math.round(avg * 1.08 / 100) * 100;
  })();

  global.DB = {
    TODAY: TODAY,
    PERIOD_START: PERIOD_START,
    OPENING: OPENING,
    BANK: BANK,
    USER: USER,
    ACCOUNTS: ACCOUNTS,
    CARDS: CARDS,
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
    account: function (id) { return ACCOUNTS.filter(function (a) { return a.id === id; })[0] || ACCOUNTS[0]; },
    portfolio: function () { return ACCOUNTS[0].balance; },
    portfolioAvailable: function () { return ACCOUNTS[0].available; }
  };
})(window);
