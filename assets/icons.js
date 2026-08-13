/* Иконки — единая сетка 24, штрих 1.6, цвет наследуется (currentColor).
   Только линейная графика: никаких эмодзи и залитых пиктограмм. */
(function (global) {
  'use strict';

  var P = {
    home:      '<path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    accounts:  '<path d="M4 7.5h16M6 11.5h12M4 15.5h16"/><path d="M12 21.5 9.2 18.5h5.6z"/>',
    transact:  '<circle cx="12" cy="12" r="8.2"/><path d="M8.6 10.4h6.8l-2-2M15.4 13.6H8.6l2 2"/>',
    cards:     '<rect x="3.4" y="6" width="12.2" height="14" rx="2"/><path d="M7.8 4h10.8a2 2 0 0 1 2 2v11.6"/><rect x="7.6" y="9.6" width="4" height="4.4" rx="1"/>',
    more:      '<circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/>',

    mail:      '<rect x="2.8" y="5" width="18.4" height="14" rx="2.2"/><path d="m3.6 7 8.4 6 8.4-6"/>',
    eye:       '<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="3.1"/>',
    eyeOff:    '<path d="M4.2 8.6C2.9 10.1 2.2 12 2.2 12s3.4 6.2 9.8 6.2c1.5 0 2.8-.3 4-.8M9.4 6.1c.8-.2 1.7-.3 2.6-.3 6.4 0 9.8 6.2 9.8 6.2s-.9 1.6-2.5 3.2"/><path d="M9.9 9.9a3.1 3.1 0 0 0 4.3 4.3"/><path d="m3.2 3.2 17.6 17.6"/>',
    chevron:   '<path d="m9.5 5.5 6.4 6.5-6.4 6.5"/>',
    chevronL:  '<path d="m14.5 5.5-6.4 6.5 6.4 6.5"/>',
    chevronUp: '<path d="m5.5 14.6 6.5-6.4 6.5 6.4"/>',
    search:    '<circle cx="11" cy="11" r="6.6"/><path d="m16 16 4.4 4.4"/>',
    filter:    '<path d="M3.6 6.4h16.8M6.6 12h10.8M10 17.6h4"/>',
    plus:      '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
    check:     '<path d="m5 12.6 4.6 4.5L19 7.4"/>',
    calendar:  '<rect x="3.6" y="5.4" width="16.8" height="15" rx="2.2"/><path d="M3.6 10h16.8M8.4 3.4v3.6M15.6 3.4v3.6"/>',
    doc:       '<path d="M6 3.4h7.4L19 9v11.6H6z"/><path d="M13.2 3.6V9H19"/><path d="M9 13h6M9 16.4h4.4"/>',
    docs:      '<path d="M8.4 2.6h5.8L19 7.4v11.2H8.4z"/><path d="M14 2.8v4.8h4.8"/><path d="M15.6 21.4H5V6.6"/>',
    download:  '<path d="M12 4v11.4M7.6 11.4 12 15.8l4.4-4.4"/><path d="M4.4 18.6v1.4h15.2v-1.4"/>',
    print:     '<path d="M7 9.4V3.6h10v5.8"/><rect x="3.6" y="9.4" width="16.8" height="7.4" rx="2"/><path d="M7 14.6h10v5.8H7z"/>',
    share:     '<circle cx="17.6" cy="6" r="2.6"/><circle cx="6.4" cy="12" r="2.6"/><circle cx="17.6" cy="18" r="2.6"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
    bank:      '<path d="M3.4 9.6 12 4.4l8.6 5.2"/><path d="M5.6 9.6v8.8M10 9.6v8.8M14 9.6v8.8M18.4 9.6v8.8"/><path d="M3.4 19.6h17.2"/>',
    heart:     '<path d="M12 19.4S4.6 15 4.6 10.2A3.8 3.8 0 0 1 12 8.6a3.8 3.8 0 0 1 7.4 1.6c0 4.8-7.4 9.2-7.4 9.2Z"/><path d="M4.6 12.4h3.2l1.4-2.4 1.8 4.4 1.6-3.2 1 1.2h5.8"/>',
    shield:    '<path d="M12 3.4 5 6v6.2c0 4.2 3 6.8 7 8.4 4-1.6 7-4.2 7-8.4V6z"/><path d="M9.2 12.2 11 14l4-4"/>',
    chart:     '<path d="M3.6 20.4h16.8"/><path d="m4.6 15.4 4.8-5.2 3.6 3 6.4-7"/><path d="M15.6 6h3.8v3.8"/>',
    house:     '<path d="M3.6 11 12 4.6l8.4 6.4v8.6a.8.8 0 0 1-.8.8H4.4a.8.8 0 0 1-.8-.8z"/><path d="M9.6 20.4v-5.6h4.8v5.6"/>',
    travel:    '<rect x="3.4" y="8" width="10.4" height="11.6" rx="2"/><path d="M6.6 8V5.6a1.4 1.4 0 0 1 1.4-1.4h1.4A1.4 1.4 0 0 1 10.8 5.6V8"/><rect x="15.4" y="10.6" width="5.2" height="9" rx="1.6"/>',
    payshap:   '<circle cx="12" cy="5.6" r="1.7"/><circle cx="16.8" cy="9.4" r="1.7"/><circle cx="15.2" cy="15.4" r="1.7"/><circle cx="8.8" cy="15.4" r="1.7"/><circle cx="7.2" cy="9.4" r="1.7"/><circle cx="12" cy="11.4" r="1.7"/>',
    seal:      '<path d="m12 3.2 2.1 1.5 2.5-.4 1 2.4 2.2 1.3-.6 2.5.6 2.5-2.2 1.3-1 2.4-2.5-.4L12 17.8l-2.1-1.5-2.5.4-1-2.4-2.2-1.3.6-2.5-.6-2.5 2.2-1.3 1-2.4 2.5.4z"/><path d="m9.4 10.2 2.6 2.4 2.6-2.4"/>',
    tick:      '<path d="M6.4 12.4 9.6 18 17.6 5.4"/>',
    settings:  '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
    user:      '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6"/>',
    bell:      '<path d="M6.4 10.4a5.6 5.6 0 0 1 11.2 0c0 4.2 1.6 5.6 1.6 5.6H4.8s1.6-1.4 1.6-5.6Z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
    lock:      '<rect x="4.8" y="10.2" width="14.4" height="10" rx="2.4"/><path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6"/>',
    logout:    '<path d="M14.4 7.2V4.8H4.6v14.4h9.8v-2.4"/><path d="M9.8 12h9.6M16.4 8.8 19.8 12l-3.4 3.2"/>',
    clock:     '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3 1.8"/>',
    refresh:   '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 4.4v4.2h-4.2"/>',
    info:      '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4M12 7.9v.2"/>',
    cart:      '<path d="M3.4 4.6h2.4l2.4 10.2h9l2-7.2H7"/><circle cx="9.6" cy="19" r="1.5"/><circle cx="16.6" cy="19" r="1.5"/>',
    cup:       '<path d="M5.6 8h11v6.4a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z"/><path d="M16.6 9.6h1.6a2.4 2.4 0 0 1 0 4.8h-1.6"/><path d="M8 5.4V3.6M12 5.4V3.6"/>',
    car:       '<path d="M4.4 16.4v2.2H7v-2.2M17 16.4v2.2h2.6v-2.2"/><path d="M4 16.4h16v-4l-1.8-4.4a1.6 1.6 0 0 0-1.5-1H7.3a1.6 1.6 0 0 0-1.5 1L4 12.4z"/><path d="M4.4 12.4h15.2M7.4 14.6h.2M16.4 14.6h.2"/>',
    bag:       '<path d="M5 8.4h14l-1 11.2H6z"/><path d="M9 10.4V6.8a3 3 0 0 1 6 0v3.6"/>',
    film:      '<rect x="3.2" y="5.6" width="17.6" height="12.8" rx="2"/><path d="M7.4 5.8v12.8M16.6 5.8v12.8"/><path d="M3.4 9.4h4M3.4 14.6h4M16.6 9.4h4M16.6 14.6h4"/>',
    bolt:      '<path d="M13.2 3.4 5.6 13.4h5l-1.2 7.2 7.8-10.2h-5.2z"/>',
    phone:     '<rect x="6.6" y="2.8" width="10.8" height="18.4" rx="2.6"/><path d="M10.6 18.6h2.8"/>',
    salary:    '<rect x="3.4" y="6.4" width="17.2" height="11.2" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.4 9.6v4.8M17.6 9.6v4.8"/>',
    piggy:     '<path d="M20.4 12.2c0 1.7-.9 3.2-2.4 4.2v2.4h-2.8l-.5-1.3H9.9l-.5 1.3H6.6v-2.5c-1.5-1-2.4-2.5-2.4-4.1 0-3.1 3.2-5.6 7.2-5.6h1.2c4 0 7.8 2.5 7.8 5.6Z"/><path d="M4.4 10.9H3.2a1.5 1.5 0 0 1 1.7-1.4"/><path d="M16.5 11.5h.01"/><path d="M10.4 6.7c-.6-1-.3-2.3.6-2.9"/>',
    swap:      '<path d="M6.4 8.4h12l-3-3M17.6 15.6h-12l3 3"/>',
    receipt:   '<path d="M6 3.4h12v17.2l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8.4h6M9 12h6M9 15.4h3.6"/>',
    globe:     '<circle cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4"/><path d="M12 3.6c2.2 2.3 3.3 5.2 3.3 8.4S14.2 18.1 12 20.4c-2.2-2.3-3.3-5.2-3.3-8.4S9.8 5.9 12 3.6Z"/>',
    wave:      '<path d="M6 8.4a6 6 0 0 1 0 7.2M9.6 6.2a10 10 0 0 1 0 11.6M13.2 4.4a13.6 13.6 0 0 1 0 15.2"/>'
  };

  /* Фирменный знак — меридианы на круге (нейтральная марка макета) */
  var MARK = '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4c2.4 2.4 3.6 5.4 3.6 8.6S14.4 18.2 12 20.6c-2.4-2.4-3.6-5.4-3.6-8.6S9.6 5.8 12 3.4Z"/><path d="M3.6 9.6h16.8M3.6 14.4h16.8"/>';

  function icon(name, opts) {
    opts = opts || {};
    var body = name === 'mark' ? MARK : P[name];
    if (!body) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (opts.w || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body + '</svg>';
  }

  global.icon = icon;
})(window);
