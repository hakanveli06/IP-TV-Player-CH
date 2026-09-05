/* nav.js - bolge (zone) tabanli kumanda gezinmesi + sanallastirilmis listeler
   Genel uzamsal tarama yerine her ekran sutunlara ayriliyor:
   yukari/asagi sutun icinde, sag/sol sutunlar arasinda gezer.
   Boylece 5000 kanalli listede bile yalnizca gorunen satirlar cizilir. */
'use strict';

/* ---------------- Liste (dikey, sanallastirilmis) ---------------- */

function List(o) {
  this.id = o.id;
  this.type = 'list';
  this.box = o.el;
  this.rowH = o.rowH || 76;
  this.renderRow = o.renderRow;
  this.onFocus = o.onFocus || null;
  this.onSelect = o.onSelect || null;
  this.onAltSelect = o.onAltSelect || null;   /* sari tus */
  this.neighbors = o.neighbors || {};
  this.items = [];
  this.index = 0;
  this.scroll = 0;
  this.currentKey = null;   /* "acik" olan ogenin isareti */

  this.box.innerHTML = '<div class="viewport"><div class="runner"></div></div>';
  this.viewport = this.box.querySelector('.viewport');
  this.runner = this.box.querySelector('.runner');
}

List.prototype.height = function () {
  return this.viewport.clientHeight || 900;
};

List.prototype.setItems = function (items, keepIndex) {
  this.items = items || [];
  if (!keepIndex || this.index >= this.items.length) this.index = 0;
  if (this.items.length === 0) this.scroll = 0;
  this.ensure();
  this.draw();
  this.fire();
};

List.prototype.setCurrent = function (key) { this.currentKey = key == null ? null : String(key); this.draw(); };

List.prototype.ensure = function () {
  var h = this.height();
  var top = this.index * this.rowH;
  if (top < this.scroll) this.scroll = top;
  else if (top + this.rowH > this.scroll + h) this.scroll = top + this.rowH - h;
  var max = Math.max(0, this.items.length * this.rowH - h);
  if (this.scroll > max) this.scroll = max;
  if (this.scroll < 0) this.scroll = 0;
};

List.prototype.draw = function () {
  var h = this.height();
  if (this.items.length === 0) {
    this.runner.style.transform = 'translateY(0px)';
    this.runner.innerHTML = '<div class="empty">' + (this.emptyText || 'Liste bos') + '</div>';
    this.runner.firstChild.style.height = h + 'px';
    return;
  }
  var first = Math.max(0, Math.floor(this.scroll / this.rowH) - 1);
  var count = Math.ceil(h / this.rowH) + 3;
  var last = Math.min(this.items.length, first + count);
  var html = '';
  for (var i = first; i < last; i++) {
    var it = this.items[i];
    var cls = 'row';
    if (i === this.index && this.focused) cls += ' focus';
    if (this.currentKey != null && String(this.key(it)) === this.currentKey) cls += ' current';
    html += '<div class="' + cls + '" style="height:' + this.rowH + 'px">' + this.renderRow(it, i) + '</div>';
  }
  this.runner.style.transform = 'translateY(' + (first * this.rowH - this.scroll) + 'px)';
  this.runner.innerHTML = html;
};

List.prototype.key = function (it) { return it && (it.__key != null ? it.__key : it.id); };

List.prototype.fire = function () {
  if (this.onFocus) this.onFocus(this.items[this.index], this.index);
};

List.prototype.setFocused = function (on) { this.focused = on; this.draw(); };

List.prototype.move = function (dir) {
  if (dir !== 'up' && dir !== 'down') return false;
  if (this.items.length === 0) return false;
  var n = this.index + (dir === 'down' ? 1 : -1);
  if (n < 0 || n >= this.items.length) return false;   /* kenarda -> komsuya gec */
  this.index = n;
  this.ensure();
  this.draw();
  this.fire();
  return true;
};

List.prototype.page = function (delta) {
  if (this.items.length === 0) return;
  var per = Math.max(1, Math.floor(this.height() / this.rowH) - 1);
  this.index = Math.min(this.items.length - 1, Math.max(0, this.index + delta * per));
  this.ensure(); this.draw(); this.fire();
};

List.prototype.jumpTo = function (i) {
  if (i < 0 || i >= this.items.length) return;
  this.index = i; this.ensure(); this.draw(); this.fire();
};

List.prototype.select = function () {
  if (this.onSelect && this.items.length) this.onSelect(this.items[this.index], this.index);
};

List.prototype.altSelect = function () {
  if (this.onAltSelect && this.items.length) this.onAltSelect(this.items[this.index], this.index);
};

/* ---------------- Izgara (poster kartlari) ---------------- */

function Grid(o) {
  this.id = o.id;
  this.type = 'grid';
  this.box = o.el;
  this.cols = o.cols || 6;
  this.rowH = o.rowH || 404;
  this.renderCard = o.renderCard;
  this.onFocus = o.onFocus || null;
  this.onSelect = o.onSelect || null;
  this.onAltSelect = o.onAltSelect || null;
  this.neighbors = o.neighbors || {};
  this.items = []; this.index = 0; this.scroll = 0;

  this.box.innerHTML = '<div class="viewport"><div class="runner"></div></div>';
  this.viewport = this.box.querySelector('.viewport');
  this.runner = this.box.querySelector('.runner');
}

Grid.prototype.height = function () { return this.viewport.clientHeight || 900; };
Grid.prototype.rows = function () { return Math.ceil(this.items.length / this.cols); };

Grid.prototype.setItems = function (items, keepIndex) {
  this.items = items || [];
  if (!keepIndex || this.index >= this.items.length) this.index = 0;
  if (!this.items.length) this.scroll = 0;
  this.ensure(); this.draw(); this.fire();
};

Grid.prototype.ensure = function () {
  var h = this.height();
  var r = Math.floor(this.index / this.cols);
  var top = r * this.rowH;
  if (top < this.scroll) this.scroll = top;
  else if (top + this.rowH > this.scroll + h) this.scroll = top + this.rowH - h;
  var max = Math.max(0, this.rows() * this.rowH - h);
  if (this.scroll > max) this.scroll = max;
  if (this.scroll < 0) this.scroll = 0;
};

Grid.prototype.draw = function () {
  var h = this.height();
  if (!this.items.length) {
    this.runner.style.transform = 'translateY(0px)';
    this.runner.innerHTML = '<div class="empty" style="height:' + h + 'px">' +
      (this.emptyText || 'Icerik bulunamadi') + '</div>';
    return;
  }
  var firstRow = Math.max(0, Math.floor(this.scroll / this.rowH) - 1);
  var rowCount = Math.ceil(h / this.rowH) + 2;
  var first = firstRow * this.cols;
  var last = Math.min(this.items.length, (firstRow + rowCount) * this.cols);
  var html = '<div class="grid">';
  for (var i = first; i < last; i++) {
    var cls = 'card' + (i === this.index && this.focused ? ' focus' : '');
    html += '<div class="' + cls + '">' + this.renderCard(this.items[i], i) + '</div>';
  }
  html += '</div>';
  this.runner.style.transform = 'translateY(' + (firstRow * this.rowH - this.scroll) + 'px)';
  this.runner.innerHTML = html;
};

Grid.prototype.fire = function () { if (this.onFocus) this.onFocus(this.items[this.index], this.index); };
Grid.prototype.setFocused = function (on) { this.focused = on; this.draw(); };

Grid.prototype.move = function (dir) {
  if (!this.items.length) return false;
  var i = this.index, col = i % this.cols;
  if (dir === 'left') { if (col === 0) return false; i--; }
  else if (dir === 'right') { if (col === this.cols - 1 || i + 1 >= this.items.length) return false; i++; }
  else if (dir === 'up') { if (i - this.cols < 0) return false; i -= this.cols; }
  else if (dir === 'down') {
    if (i + this.cols >= this.items.length) {
      /* son satirda: son ogeye kaydir, yoksa komsuya birak */
      if (Math.floor(i / this.cols) === this.rows() - 1) return false;
      i = this.items.length - 1;
    } else i += this.cols;
  }
  this.index = i; this.ensure(); this.draw(); this.fire();
  return true;
};

Grid.prototype.page = function (delta) {
  var per = Math.max(1, Math.floor(this.height() / this.rowH)) * this.cols;
  this.index = Math.min(this.items.length - 1, Math.max(0, this.index + delta * per));
  this.ensure(); this.draw(); this.fire();
};

Grid.prototype.jumpTo = function (i) {
  if (!this.items.length) return;
  i = Math.max(0, Math.min(this.items.length - 1, i));
  this.index = i; this.ensure(); this.draw(); this.fire();
};

Grid.prototype.select = function () { if (this.onSelect && this.items.length) this.onSelect(this.items[this.index], this.index); };
Grid.prototype.altSelect = function () { if (this.onAltSelect && this.items.length) this.onAltSelect(this.items[this.index], this.index); };

/* ---------------- Basit dikey oge kumesi (dugmeler, form alanlari) ---------------- */

function Stack(o) {
  this.id = o.id;
  this.type = 'stack';
  this.nodes = o.nodes || [];        /* gercek DOM ogeleri */
  this.horizontal = !!o.horizontal;
  this.onSelect = o.onSelect || null;
  this.onFocus = o.onFocus || null;
  this.neighbors = o.neighbors || {};
  this.index = 0;
}

Stack.prototype.setNodes = function (nodes) {
  this.nodes = nodes || [];
  if (this.index >= this.nodes.length) this.index = 0;
  this.draw();
};

Stack.prototype.draw = function () {
  for (var i = 0; i < this.nodes.length; i++) {
    var on = (i === this.index && this.focused);
    this.nodes[i].className = this.nodes[i].className.replace(/\s*\bfocus\b/g, '') + (on ? ' focus' : '');
    if (on && this.nodes[i].tagName === 'INPUT') {
      try { this.nodes[i].focus(); } catch (e) { }
    } else if (this.nodes[i].tagName === 'INPUT') {
      try { this.nodes[i].blur(); } catch (e) { }
    }
    if (on && this.nodes[i].scrollIntoView) {
      try { this.nodes[i].scrollIntoView({ block: 'nearest' }); } catch (e) { }
    }
  }
};

Stack.prototype.setFocused = function (on) { this.focused = on; this.draw(); };

Stack.prototype.move = function (dir) {
  var fwd = this.horizontal ? 'right' : 'down';
  var back = this.horizontal ? 'left' : 'up';
  var d = (dir === fwd) ? 1 : (dir === back ? -1 : 0);
  if (!d) return false;
  var n = this.index + d;
  if (n < 0 || n >= this.nodes.length) return false;
  this.index = n; this.draw();
  if (this.onFocus) this.onFocus(this.nodes[n], n);
  return true;
};

Stack.prototype.select = function () {
  if (this.onSelect && this.nodes.length) this.onSelect(this.nodes[this.index], this.index);
};
Stack.prototype.altSelect = function () { };

/* ---------------- Gezinme cekirdegi ---------------- */

var Nav = {
  screen: null,
  zone: null,
  imeOpen: false,
  overlay: null,      /* ayarlanmissa tum tuslar buraya gider */

  setScreen: function (def) {
    this.screen = def;
    this.zone = null;
    if (def && def.start) this.focus(def.start);
  },

  zoneById: function (id) {
    if (!this.screen || !this.screen.zones) return null;
    return this.screen.zones[id] || null;
  },

  focus: function (id) {
    var z = this.zoneById(id);
    if (!z) return;
    if (this.zone && this.zone !== z) this.zone.setFocused(false);
    this.zone = z;
    z.setFocused(true);
    if (this.screen.onZoneChange) this.screen.onZoneChange(id);
  },

  setOverlay: function (handler) { this.overlay = handler; },
  clearOverlay: function () { this.overlay = null; },

  dirOf: function (code) {
    if (code === KEY.UP) return 'up';
    if (code === KEY.DOWN) return 'down';
    if (code === KEY.LEFT) return 'left';
    if (code === KEY.RIGHT) return 'right';
    return null;
  },

  handle: function (e) {
    var code = e.keyCode;

    if (Diag.visible) {
      if (code === KEY.DOWN || code === KEY.RIGHT) { Diag.move(1); e.preventDefault(); return; }
      if (code === KEY.UP || code === KEY.LEFT) { Diag.move(-1); e.preventDefault(); return; }
      if (code === KEY.BACK || code === KEY.ESC || code === KEY.ENTER) { Diag.hide(); e.preventDefault(); }
      return;
    }

    if (this.overlay) { this.overlay(e); return; }
    if (!this.screen) return;

    /* Metin kutusu odaktayken TV klavyesine (IME) yol ver.
       Bunlari yakalarsak ekran klavyesi hic acilmaz. */
    var ae = document.activeElement;
    var inInput = !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'));

    if (this.imeOpen) {
      /* klavye acikken tum tuslar ona ait; Geri ile kapandigini varsayiyoruz */
      if (code === KEY.BACK || code === KEY.ESC) this.imeOpen = false;
      return;
    }
    if (inInput) {
      if (code === KEY.LEFT || code === KEY.RIGHT || code === KEY.BACKSPACE) return;
      if (code === KEY.ENTER) { this.imeOpen = true; return; }
    }

    /* ekranin kendi tus kancasi once denenir */
    if (this.screen.onKey && this.screen.onKey(e) === true) { e.preventDefault(); return; }

    var dir = this.dirOf(code);
    if (dir) {
      e.preventDefault();
      var z = this.zone;
      if (!z) return;
      if (z.move(dir)) return;
      var nid = z.neighbors ? z.neighbors[dir] : null;
      if (nid) {
        var nz = typeof nid === 'function' ? nid() : nid;
        if (nz) this.focus(nz);
      }
      return;
    }

    if (code === KEY.ENTER) { e.preventDefault(); if (this.zone) this.zone.select(); return; }
    if (code === KEY.BLUE) { e.preventDefault(); Diag.toggle(); return; }
    if (code === KEY.YELLOW) { e.preventDefault(); if (this.zone) this.zone.altSelect(); return; }

    if (code === KEY.CH_UP) { e.preventDefault(); if (this.zone && this.zone.page) this.zone.page(-1); return; }
    if (code === KEY.CH_DOWN) { e.preventDefault(); if (this.zone && this.zone.page) this.zone.page(1); return; }

    if (code === KEY.BACK || code === KEY.ESC) {
      e.preventDefault();
      if (this.screen.onBack) this.screen.onBack();
      return;
    }
  }
};

document.addEventListener('keydown', function (e) { Nav.handle(e); }, true);

/* Ekran klavyesi kapandiginda bayragi temizle */
document.addEventListener('change', function (e) {
  if (e.target && e.target.tagName === 'INPUT') Nav.imeOpen = false;
}, true);
document.addEventListener('blur', function (e) {
  if (e.target && e.target.tagName === 'INPUT') Nav.imeOpen = false;
}, true);
