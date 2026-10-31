/* 🩷 마크삼식 헬스 기록 — 1차(기록·분석) + 2차(식단·바프·음성)  · 인터넷 없이 작동, 기록은 휴대폰 안에만
   네이티브 다리(있으면 씀): window.KKApp.{micStart,micStop,vibrate,shareText,saveFile,pageReady}
   네이티브 → 화면: window.gsMic(obj) · window.kkBack() → true/false */
(function () {
  'use strict';
  var D = window.PK_DATA, KKA = window.KKApp || null, NATIVE = !!KKA;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('pk_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('pk_' + k, JSON.stringify(v)); } catch (e) { toast('저장 공간이 가득 찼어요. 설정 › 내보내기로 백업해 주세요.'); } }
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function mdw(s) { var d = parseYmd(s); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ')'; }
  function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 864e5); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function fmtW(x) { return (Math.round(x * 100) / 100).toString(); }
  var toastT;
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.remove('hide'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hide'); }, 2300); }
  function vib(ms) { try { if (NATIVE && KKA.vibrate) KKA.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

  /* ───────── 데이터 ───────── */
  var MUSN = {}; D.MUS.forEach(function (m) { MUSN[m[0]] = m[1]; });
  var TYPEN = { bb: '바벨', sm: '스미스', db: '덤벨', mc: '머신(핀)', hm: '해머(원판 머신)', cb: '케이블', bw: '맨몸', kb: '케틀벨' };
  var TYPEI = { bb: '🏋️', sm: '🏋️', db: '💪', mc: '⚙️', hm: '🥏', cb: '🪢', bw: '🤸', kb: '🔔' };
  var S = Object.assign({ rest: 90, plates: { '1.25': false, '2.5': true, '5': true, '10': true, '15': false, '20': true, '25': false }, bar: {}, mc: {}, dbStep: 2, star: {}, kcal: 0 }, store.get('set', {}));
  function saveS() { store.set('set', S); }
  /* ── 📍 내 헬스장 (헬스장마다 원판·바·머신 단위·덤벨 간격 따로) ── */
  var GKEYS = ['plates', 'bar', 'mc', 'dbStep'];
  if (!S.gyms || !S.gyms.length) { S.gyms = [{ id: 'g1', n: '우리 헬스장', ex: {} }]; S.gym = 'g1'; }
  if (!S.rx) S.rx = {};
  function curGym() { for (var i = 0; i < S.gyms.length; i++) if (S.gyms[i].id === S.gym) return S.gyms[i]; S.gym = S.gyms[0].id; return S.gyms[0]; }
  function gymOf(w) { return (w && w.gym) || S.gyms[0].id; }
  function gymName(id) { for (var i = 0; i < S.gyms.length; i++) if (S.gyms[i].id === id) return S.gyms[i].n; return ''; }
  function switchGym(id) {
    if (id === S.gym) return;
    var old = curGym(); old.cfg = {}; GKEYS.forEach(function (k) { old.cfg[k] = JSON.parse(JSON.stringify(S[k])); });
    S.gym = id; var g = curGym();
    if (g.cfg) GKEYS.forEach(function (k) { if (g.cfg[k] != null) S[k] = JSON.parse(JSON.stringify(g.cfg[k])); });
    if (CUR) { CUR.gym = id; saveCur(); }
    saveS(); toast('📍 ' + g.n + '(으)로 바꿨어요');
  }
  function gymMark(exId) { var g = curGym(); g.ex = g.ex || {}; if (!g.ex[exId]) { g.ex[exId] = 1; saveS(); } }
  function restFor(exId) { return (exId && S.rx[exId]) || S.rest; }
  var CUSTOM = store.get('cex', []);
  var EXM = {};
  function loadEx() {
    EXM = {};
    D.EX.concat(CUSTOM).forEach(function (e) { EXM[e[0]] = { id: e[0], n: e[1], m: e[2], t: e[3], m2: e[4] ? e[4].split(',') : [], al: e[5] || '' }; });
  }
  loadEx();
  var W = store.get('w', []);           // 끝난 운동들
  var CUR = store.get('cur', null);     // 진행 중 운동
  var RT = store.get('rt', []);         // 루틴
  function saveW() { store.set('w', W); }
  function saveCur() { store.set('cur', CUR); }

  /* 초성 검색 */
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function cho(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i) - 0xAC00; o += (c >= 0 && c < 11172) ? CHO[Math.floor(c / 588)] : s[i]; } return o; }
  function isCho(q) { return /^[ㄱ-ㅎ\s]+$/.test(q); }
  function exMatch(e, q) {
    q = q.replace(/\s/g, '').toLowerCase(); if (!q) return true;
    var nm = (e.n + e.al).replace(/\s/g, '').toLowerCase();
    if (nm.indexOf(q) >= 0) return true;
    if (isCho(q)) { return cho(e.n.replace(/\s/g, '')).indexOf(q) >= 0 || cho(e.al.replace(/\s/g, '')).indexOf(q) >= 0; }
    return false;
  }

  /* 무게 계산 */
  var LB = 0.45359237;
  function setKg(s, ex) {
    if (!s) return 0;
    if (ex && ex.t === 'bw') return s.mode === 'add' ? s.w : 0;
    return s.u === 'lb' ? s.w * LB : s.w;
  }
  function e1rm(kg, r) { if (!kg || !r) return 0; r = Math.min(r, 12); return kg * (1 + r / 30); }
  function setTxt(s, ex) {
    if (ex.t === 'bw') { var m = s.mode === 'add' ? ' +' + fmtW(s.w) + 'kg' : s.mode === 'ast' ? ' 보조' + fmtW(s.w) : ''; return (ex.m === 'cardio' ? s.r + '분' : s.r + '회') + m; }
    return fmtW(s.w) + (s.u || 'kg') + '×' + s.r;
  }
  function lastItem(exId, beforeDate, gym) {
    if (gym) { var r0 = lastItem(exId, beforeDate, null, gym); if (r0) return r0; }
    var only = arguments[3];
    for (var i = W.length - 1; i >= 0; i--) {
      var w = W[i]; if (beforeDate && w.date > beforeDate) continue; if (only && gymOf(w) !== only) continue;
      for (var j = 0; j < w.items.length; j++) if (w.items[j].ex === exId && w.items[j].sets.length) return { date: w.date, it: w.items[j] };
    }
    return null;
  }
  function history(exId) {
    var out = [];
    W.forEach(function (w) { w.items.forEach(function (it) { if (it.ex === exId && it.sets.length) out.push({ date: w.date, sets: it.sets }); }); });
    return out;
  }
  function useCount() { var c = {}; W.forEach(function (w) { w.items.forEach(function (it) { c[it.ex] = (c[it.ex] || 0) + 1; }); }); return c; }
  function recentEx() { var seen = {}, out = []; for (var i = W.length - 1; i >= 0 && out.length < 12; i--) W[i].items.forEach(function (it) { if (!seen[it.ex] && EXM[it.ex]) { seen[it.ex] = 1; out.push(it.ex); } }); return out; }

  /* ───────── 화면 틀 ───────── */
  var PAGE = store.get('page', 'wk');
  function go(p) { PAGE = p; store.set('page', p); document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === p); }); render(); }
  function render() {
    var pg = $('pg'); pg.scrollTop = 0;
    if (PAGE === 'wk') renderWk(); else if (PAGE === 'hist') renderHist(); else if (PAGE === 'food') renderFood(); else if (PAGE === 'ib') renderIb(); else renderBp();
    $('micBtn').classList.toggle('hide', PAGE !== 'wk');
    $('sub').textContent = mdw(ymd()) + (CUR && !stale() ? ' · 운동 중 ' + elapsed() : '');
  }
  /* 날짜가 지난 진행 중 운동(오운완을 깜빡한 경우) — 「이어서 하기」를 누르면 resume 표시 */
  function stale() { return !!(CUR && CUR.date !== ymd() && !CUR.resume); }
  function curSets() { var n = 0; if (CUR) CUR.items.forEach(function (it) { n += it.sets.length; }); return n; }
  function elapsed() { if (!CUR) return ''; var m = Math.floor((Date.now() - CUR.start) / 60000); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; }

  /* ───────── 킹콩 코치(규칙 기반 분석) ───────── */
  function weekSets(from, to) {
    var c = {}; D.MUS.forEach(function (m) { c[m[0]] = 0; });
    W.forEach(function (w) {
      if (w.date < from || w.date > to) return;
      w.items.forEach(function (it) { var e = EXM[it.ex]; if (!e) return; var n = it.sets.length; c[e.m] += n; e.m2.forEach(function (m) { if (c[m] != null) c[m] += n * 0.5; }); });
    });
    return c;
  }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function suggest(exId) {
    var e = EXM[exId], h = history(exId); if (!e || !h.length) return null;
    var last = h[h.length - 1], best = last.sets.reduce(function (a, s) { return setKg(s, e) >= setKg(a, e) ? s : a; }, last.sets[0]);
    if (e.t === 'bw' && e.m === 'cardio') return null;
    var minR = Math.min.apply(null, last.sets.map(function (s) { return s.r; }));
    var step = e.t === 'bb' || e.t === 'sm' || e.t === 'hm' ? ((S.mc[exId] || {}).sd === 1 ? 1 : 2) * minPlate() : e.t === 'db' ? S.dbStep : (S.mc[exId] && S.mc[exId].st) || 5;
    var unit = best.u || 'kg';
    if (h.length >= 3) {
      var a = h.slice(-3).map(function (x) { return Math.max.apply(null, x.sets.map(function (s) { return setKg(s, e); })); });
      if (a[0] > 0 && a[0] === a[1] && a[1] === a[2] && minR < 12) return { k: 'plat', t: '🧱 ' + e.n + ' — 3번 연속 같은 무게(' + fmtW(best.w) + unit + ')예요. 횟수를 2개 늘리거나, 무게를 조금 내리고 세트를 1개 늘려 보세요.' };
    }
    if (minR >= 12 || (last.sets.length >= 3 && minR >= 10)) return { k: 'up', t: '📈 ' + e.n + ' — 지난번 모든 세트를 ' + minR + '회 이상 채웠어요. 오늘은 +' + fmtW(step) + unit + ' 가 볼까요?' };
    return null;
  }
  function minPlate() { var m = 99; Object.keys(S.plates).forEach(function (k) { if (S.plates[k]) m = Math.min(m, +k); }); return m === 99 ? 2.5 : m; }
  function coachLines() {
    var t = ymd(), out = [];
    if (!W.length) return ['처음이군요! 아래 「오늘 운동 시작」을 누르고, 킹콩 몸에서 오늘 할 부위를 눌러 보세요. 무게는 원판을 터치해서 쌓으면 돼요.'];
    var last = W[W.length - 1], gap = daysBetween(last.date, t);
    if (gap >= 4) out.push('마지막 운동이 ' + gap + '일 전이에요. 오늘은 가볍게라도 시작해 볼까요? 💪');
    var c = weekSets(addDays(t, -6), t);
    var push = c.chest + c.shoulder * 0.5 + c.tricep * 0.5, pull = c.back + c.bicep * 0.5 + c.trap * 0.5;
    if (push + pull >= 10 && pull < push * 0.6) out.push('이번 주 미는 운동(가슴) 세트가 당기는 운동(등)보다 훨씬 많아요. 등 운동을 한두 개 넣으면 어깨 균형에 좋아요.');
    if (c.quad + c.ham + c.glute < 4 && (push + pull) >= 12) out.push('상체만 하고 있어요 🙈 하체도 일주일에 한 번은 챙겨요.');
    var ids = recentEx().slice(0, 6);
    for (var i = 0; i < ids.length && out.length < 3; i++) { var s = suggest(ids[i]); if (s) out.push(s.t); }
    if (!out.length) out.push('좋은 흐름이에요! 지난번 기록이 자동으로 채워지니까, 오늘도 ✅만 눌러 가며 해요.');
    return out;
  }

  /* ───────── 🏋️ 운동 탭 ───────── */
  function renderWk() {
    var pg = $('pg'), h = '';
    if (!CUR || stale()) {
      if (stale()) h += '<div class="card stl"><b>⏰ ' + mdw(CUR.date) + ' 운동이 아직 열려 있어요</b><small>' + (curSets() ? curSets() + '세트 · ' + esc(CUR.items.filter(function (it) { return it.sets.length; }).map(function (it) { return EXM[it.ex] ? EXM[it.ex].n : '?'; }).join(' · ')) : '기록한 세트 없음') + '</small><div class="g3' + (curSets() ? '' : ' two') + '">' + (curSets() ? '<button class="btn g" id="stSave">🎉 오운완 저장</button>' : '') + '<button class="btn" id="stDel">🗑 지우기</button><button class="btn" id="stGo">▶ 이어서 하기</button></div></div>';
      h += '<div class="hero"><div class="fc"></div><div><small>킹콩 코치 한마디</small><b>' + esc(coachLines()[0]) + '</b></div></div>';
      h += '<div class="gymr"><span class="note" style="margin:0">📍</span>' + S.gyms.map(function (g) { return '<button class="chip' + (g.id === S.gym ? ' on' : '') + '" data-gym="' + g.id + '">' + esc(g.n) + '</button>'; }).join('') + '<button class="chip" id="gymAdd">＋ 헬스장</button></div>';
      h += '<button class="big" id="startNew"><i>▶</i><div><b>오늘 운동 시작</b><small>운동을 고르면 지난번 무게·횟수가 자동으로 채워져요</small></div><em>›</em></button>';
      h += weekHTML();
      h += '<div class="card hb"><div class="h3" style="margin-top:0">🦍 오늘 어디 할까요?</div><p class="note" style="margin:0 0 8px">부위를 누르면 그 부위 운동만 골라 보여 줘요</p><div class="bodyw hbody" id="hBody"></div></div>';
      var lastW = W[W.length - 1];
      if (lastW) h += '<button class="it" id="startLast"><span class="ic">🔁</span><div><b>지난 운동 그대로 (' + mdw(lastW.date) + ')</b><small>' + esc(exNames(lastW.items)) + '</small></div><span class="go">›</span></button>';
      if (RT.length) {
        h += '<div class="h3">📋 내 루틴</div><div class="lst">' + RT.map(function (r, i) {
          return '<button class="it" data-rt="' + i + '"><span class="ic">📋</span><div><b>' + esc(r.n) + '</b><small>' + esc(exNames(r.ex.map(function (x, k) { return { ex: x, g: r.g && r.g[k] }; }))) + '</small></div><span class="go">▶</span></button>';
        }).join('') + '</div>';
      }
      h += splitHTML();
      if (W.length) {
        h += '<div class="h3">🗓 최근 운동</div><div class="lst">' + W.slice(-5).reverse().map(function (w) {
          var v = 0, n = 0; w.items.forEach(function (it) { var e = EXM[it.ex]; it.sets.forEach(function (s) { n++; v += setKg(s, e) * s.r; }); });
          return '<div class="it"><span class="ic">🏋️</span><div><b>' + mdw(w.date) + ' · ' + w.items.length + '종목 ' + n + '세트</b><small>' + esc(w.items.map(function (it) { return EXM[it.ex] ? EXM[it.ex].n : '?'; }).join(' · ')) + ' · 볼륨 ' + Math.round(v).toLocaleString() + 'kg</small></div></div>';
        }).join('') + '</div>';
      }
      h += '<p class="note">🎙️ 위 마이크를 누르고 「벤치 60 10개 3세트」처럼 말해도 기록돼요.</p>';
      pg.innerHTML = h;
      $('startNew').onclick = function () { startWorkout([]); openPicker(); };
      pg.querySelectorAll('[data-gym]').forEach(function (b) { b.onclick = function () { switchGym(b.dataset.gym); render(); }; });
      $('gymAdd').onclick = gymSheet;
      if ($('startLast')) $('startLast').onclick = function () { startWorkout(lastW.items.map(function (it) { return it.ex; }), lastW.items.map(function (it) { return it.g || 0; }), lastW.items.map(function (it) { return it.gt || ''; })); };
      pg.querySelectorAll('[data-rt]').forEach(function (b) { b.onclick = function () { startWorkout(RT[+b.dataset.rt].ex, RT[+b.dataset.rt].g, RT[+b.dataset.rt].gt); }; });
      if ($('stSave')) $('stSave').onclick = endWorkout;
      if ($('stDel')) $('stDel').onclick = function () { if (!curSets() || confirmBox(mdw(CUR.date) + ' 운동(' + curSets() + '세트)을 지울까요? 저장되지 않아요.')) { CUR = null; saveCur(); stopRest(); render(); toast('🗑 지웠어요'); } };
      if ($('stGo')) $('stGo').onclick = function () { CUR.resume = 1; saveCur(); render(); };
      drawHomeBody($('hBody'));
      pg.querySelectorAll('[data-sp]').forEach(function (b) { b.onclick = function () { S.split = b.dataset.sp; saveS(); render(); }; });
      pg.querySelectorAll('[data-spd]').forEach(function (b) { b.onclick = function () { var d = SPLITS[S.split || 'p3'].d[+b.dataset.spd]; startWorkout(d[1]); toast('📋 ' + d[0] + ' 시작! 순서대로 기록해요'); }; });
      return;
    }
    var nSet = 0, vol = 0;
    CUR.items.forEach(function (it) { var e = EXM[it.ex]; it.sets.forEach(function (s) { nSet++; vol += setKg(s, e) * s.r; }); });
    h += '<div class="kpi"><div><b>' + elapsed() + '</b><small>운동 시간</small></div><div><b>' + nSet + '</b><small>완료 세트</small></div><div><b>' + Math.round(vol).toLocaleString() + '</b><small>볼륨(kg)</small></div></div>';
    h += CUR.items.map(function (it, i) {
      var e = EXM[it.ex]; if (!e) return '';
      var gr = grpIdx(CUR.items, i), pre = '', post = '';
      if (gr && gr[0] === i) pre = '<div class="grp"><div class="gh">🔗 ' + grpName(CUR.items, gr[0], gr[1]) + ' <small>번갈아 1세트씩 · 끝에 휴식</small></div>';
      if (i < CUR.items.length - 1) post = '<button class="lnk' + (gr && CUR.items[i + 1].g === it.g ? ' on' : '') + '" data-lk="' + i + '">' + (gr && CUR.items[i + 1].g === it.g ? '⛓ 묶음 풀기' : '🔗 아래 운동과 묶기') + '</button>';
      if (gr && gr[1] === i) post = '</div>' + post;
      var lp = lastItem(it.ex, CUR.date, CUR.gym || S.gym), sg = suggest(it.ex);
      return pre + '<div class="ex' + (i === CUR.at && !it.fin ? ' cur' : '') + (it.fin ? ' fin' : '') + '" data-ei="' + i + '"><div class="hd"><span>' + TYPEI[e.t] + '</span><b>' + esc(e.n) + '</b><span class="tag">' + MUSN[e.m] + '</span><span class="mv"><button data-mv="' + i + '" data-d="-1"' + (i ? '' : ' disabled') + ' aria-label="위로">▲</button><button data-mv="' + i + '" data-d="1"' + (i < CUR.items.length - 1 ? '' : ' disabled') + ' aria-label="아래로">▼</button></span><span class="go" style="color:var(--main2);font-weight:900">기록 ›</span></div>' +
        '<div class="sets">' + (it.sets.length ? it.sets.map(function (s, k) { return '<span class="st ok">' + (k + 1) + ') ' + esc(setTxt(s, e)) + '</span>'; }).join('') : '<span class="st">아직 세트 없음</span>') + '</div>' +
        (lp ? '<div class="prev">지난번 ' + mdw(lp.date) + ': ' + esc(lp.it.sets.map(function (s) { return setTxt(s, e); }).join(' · ')) + '</div>' : '') +
        (sg && !it.sets.length ? '<div class="prev" style="color:var(--main2)">' + esc(sg.t) + '</div>' : '') + '</div>' + post;
    }).join('');
    h += '<button class="big" id="addEx"><i>＋</i><div><b>운동 추가</b><small>킹콩 몸 터치 · 초성 검색(ㄹㅍㄷ → 랫풀다운)</small></div><em>›</em></button>';
    h += '<button class="big" id="addGrp"><i>🔗</i><div><b>묶음 세트 추가</b><small>슈퍼 · 컴파운드 · 트라이 · 자이언트 — 종류 먼저 고르기</small></div><em>›</em></button>';
    h += '<div class="g2"><button class="btn g" id="endW">🎉 오운완</button><button class="btn" id="cancelW">🗑 이번 운동 지우기</button></div>';
    pg.innerHTML = h;
    pg.querySelectorAll('[data-ei]').forEach(function (b) { b.onclick = function () { CUR.at = +b.dataset.ei; saveCur(); openLogger(CUR.items[CUR.at].ex); }; });
    pg.querySelectorAll('[data-lk]').forEach(function (b) { b.onclick = function () { linkEx(+b.dataset.lk); }; });
    $('addEx').onclick = function () { openPicker(); };
    $('addGrp').onclick = openGroupAdd;
    pg.querySelectorAll('[data-mv]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); moveEx(+b.dataset.mv, +b.dataset.d); }; });
    $('endW').onclick = endWorkout;
    $('cancelW').onclick = function () { if (confirmBox('이번 운동 기록을 지울까요? (끝낸 운동은 그대로예요)')) { CUR = null; saveCur(); stopRest(); render(); } };
  }
  function confirmBox(m) { try { return window.confirm(m); } catch (e) { return true; } }
  /* ───── 운동 탭 첫 화면: 이번 주 · 킹콩 몸 바로가기 · 추천 분할 ───── */
  function weekHTML() {
    var now = new Date(), mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    var days = [], cnt = 0, sets = 0, vol = 0, today = ymd();
    for (var i = 0; i < 7; i++) { var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); days.push(ymd(d)); }
    var by = {};
    W.forEach(function (w) { if (days.indexOf(w.date) < 0) return; by[w.date] = (by[w.date] || 0) + 1; cnt++; w.items.forEach(function (it) { var e = EXM[it.ex]; it.sets.forEach(function (st) { sets++; vol += e ? setKg(st, e) * st.r : 0; }); }); });
    var done = {}; W.forEach(function (w) { done[w.date] = 1; });
    var streak = 0, c = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!done[ymd(c)]) c.setDate(c.getDate() - 1);
    while (done[ymd(c)]) { streak++; c.setDate(c.getDate() - 1); }
    var WK = ['월', '화', '수', '목', '금', '토', '일'];
    return '<div class="card wkc"><div class="wkh"><b>📅 이번 주</b><span>' + (streak >= 2 ? '🔥 ' + streak + '일 연속' : (cnt ? '좋아요, 이어 가요' : '이번 주 첫 운동을 시작해요')) + '</span></div>' +
      '<div class="wkd">' + days.map(function (d, i) { return '<div class="' + (by[d] ? 'on' : '') + (d === today ? ' td' : '') + '"><i>' + (by[d] ? (by[d] > 1 ? by[d] : '✓') : '') + '</i><small>' + WK[i] + '</small></div>'; }).join('') + '</div>' +
      '<div class="wks"><div><b>' + cnt + '</b><small>운동 횟수</small></div><div><b>' + sets + '</b><small>세트</small></div><div><b>' + Math.round(vol).toLocaleString() + '</b><small>볼륨(kg)</small></div></div></div>';
  }
  function drawHomeBody(el) {
    if (!el) return;
    el.innerHTML = ['front', 'back'].map(function (side) {
      return '<div class="body"><img src="' + bodySrc(side) + '" alt=""><span class="lb">' + (side === 'front' ? '앞' : '뒤') + '</span>' +
        D.ZONES[side].map(function (z) { return '<button class="z" data-hm="' + z[0] + '" aria-label="' + MUSN[z[0]] + '" style="left:' + z[1] + '%;top:' + z[2] + '%;width:' + z[3] + '%;height:' + z[4] + '%"></button>'; }).join('') + '</div>';
    }).join('');
    el.querySelectorAll('[data-hm]').forEach(function (b) { b.onclick = function () { vib(15); b.classList.add('on'); PK.mus = b.dataset.hm; PK.tab = 'all'; startWorkout([]); openPicker(); }; });
  }
  /* 추천 분할(예시) — 흔히 쓰는 분할 구성. 운동은 내 기록으로 바꿔 쓰면 돼요 */
  var SPLITS = {
    full: { n: '무분할', s: '주 2~3회 · 전신', d: [['전신', ['squat', 'bench', 'latpull', 'ohp', 'legcurl', 'plank']]] },
    p2: { n: '2분할', s: '상체 · 하체', d: [['상체', ['bench', 'bbrow', 'ohp', 'latpull', 'dbcurl', 'pushdown']], ['하체', ['squat', 'rdl', 'legpress', 'legcurl', 'calfraise', 'crunch']]] },
    p3: { n: '3분할', s: '밀기 · 당기기 · 하체', d: [['밀기(가슴·어깨·삼두)', ['bench', 'dbincpress', 'ohp', 'latraise', 'pushdown']], ['당기기(등·이두)', ['deadlift', 'latpull', 'seatedrow', 'facepull', 'bbcurl']], ['하체', ['squat', 'legpress', 'rdl', 'legext', 'legcurl', 'calfraise']]] },
    p5: { n: '5분할', s: '가슴 · 등 · 어깨 · 하체 · 팔', d: [['가슴', ['bench', 'dbincpress', 'chestpress', 'pecdeck', 'dips']], ['등', ['deadlift', 'pullup', 'latpull', 'bbrow', 'seatedrow']], ['어깨', ['ohp', 'latraise', 'reardelt', 'frontraise', 'shrug']], ['하체', ['squat', 'legpress', 'legext', 'legcurl', 'hipthrust', 'calfraise']], ['팔', ['bbcurl', 'hammer', 'preacher', 'pushdown', 'skull', 'ohext']]] }
  };
  function splitHTML() {
    var k = SPLITS[S.split] ? S.split : 'p3', sp = SPLITS[k];
    return '<div class="card spc"><div class="h3" style="margin-top:0">📋 추천 분할 루틴</div><div class="chips">' + Object.keys(SPLITS).map(function (x) { return '<button class="chip' + (x === k ? ' on' : '') + '" data-sp="' + x + '">' + SPLITS[x].n + '</button>'; }).join('') + '</div>' +
      '<p class="note" style="margin:6px 0 8px">' + sp.s + ' — 누르면 그 운동들로 바로 시작해요</p><div class="lst">' + sp.d.map(function (d, i) {
        return '<button class="it" data-spd="' + i + '"><span class="ic">' + (sp.d.length > 1 ? 'D' + (i + 1) : '💪') + '</span><div><b>' + esc(d[0]) + '</b><small>' + esc(d[1].map(function (x) { return EXM[x] ? EXM[x].n : '?'; }).join(' · ')) + '</small></div><span class="go">▶</span></button>';
      }).join('') + '</div><p class="note">🔶 흔히 쓰는 분할 예시예요. 시작한 뒤 운동을 빼거나 더해도 돼요.</p></div>';
  }
  /* ───── 40차: 슈퍼·컴파운드 세트 — 이어진 운동에 같은 g(묶음 번호). 묶인 운동은 1세트씩 번갈아, 마지막 운동 뒤에만 휴식 ───── */
  function normG(items) {
    var n = 0;
    for (var i = 0; i < items.length;) {
      var g = items[i].g; if (!g) { delete items[i].g; delete items[i].gt; i++; continue; }
      var j = i; while (j + 1 < items.length && items[j + 1].g === g) j++;
      if (j === i) { delete items[i].g; delete items[i].gt; } else { n++; for (var k = i; k <= j; k++) items[k].g = n; }
      i = j + 1;
    }
    return items;
  }
  function grpIdx(items, i) { var g = items[i] && items[i].g; if (!g) return null; var a = i, b = i; while (a > 0 && items[a - 1].g === g) a--; while (b < items.length - 1 && items[b + 1].g === g) b++; return [a, b]; }
  var GTN = { ss: '슈퍼세트', cp: '컴파운드세트', tri: '트라이세트', gi: '자이언트세트' };
  function grpName(items, a, b) { var c = b - a + 1, t = items[a].gt, same = true; for (var q = a; q <= b; q++) if (items[q].gt !== t) same = false;
    if (t && same && ((t === 'ss' || t === 'cp') ? c === 2 : t === 'tri' ? c === 3 : c >= 4)) return GTN[t]; if (c >= 4) return '자이언트세트'; if (c === 3) return '트라이세트'; var e1 = EXM[items[a].ex], e2 = EXM[items[b].ex]; return e1 && e2 && e1.m === e2.m ? '컴파운드세트' : '슈퍼세트'; }
  function linkEx(i) {
    var it = CUR.items, a = it[i], b = it[i + 1], k; if (!a || !b) return;
    if (a.g && a.g === b.g) { var og = a.g; for (k = i + 1; k < it.length && it[k].g === og; k++) it[k].g = -1; }
    else { var g = a.g || b.g || -2, bg = b.g; a.g = g; for (k = i + 1; k < it.length; k++) { if (k === i + 1 || (bg && it[k].g === bg)) it[k].g = g; else break; } }
    normG(it); saveCur(); vib(20); render();
  }
  function blocksOf(items) { var r = [], i = 0; while (i < items.length) { var g = grpIdx(items, i), b = g ? g[1] : i; r.push([i, b]); i = b + 1; } return r; }
  function moveEx(i, d) {   /* 41차: ▲▼ — 묶음 안에서는 자리 바꾸기, 묶음 끝이면 묶음째 이동, 따로 운동은 옆 묶음을 통째로 건너뜀 */
    var it = CUR.items, cur = it[CUR.at], gr = grpIdx(it, i), j = i + d;
    if (gr && j >= gr[0] && j <= gr[1]) { var t = it[i]; it[i] = it[j]; it[j] = t; }
    else {
      var bl = blocksOf(it), bi = -1; bl.forEach(function (x, k) { if (i >= x[0] && i <= x[1]) bi = k; });
      var nj = bi + d; if (bi < 0 || nj < 0 || nj >= bl.length) return;
      var A = bl[Math.min(bi, nj)], B = bl[Math.max(bi, nj)], sA = it.slice(A[0], A[1] + 1), sB = it.slice(B[0], B[1] + 1);
      Array.prototype.splice.apply(it, [A[0], B[1] - A[0] + 1].concat(sB, sA));
    }
    normG(it); CUR.at = Math.max(0, it.indexOf(cur)); saveCur(); vib(15); render();
  }
  /* 41차: 묶음 세트 추가 — 종류 먼저 고르고 운동을 개수만큼 이어서 고름 */
  var GP = null, OPP = { chest: 'back', back: 'chest', bicep: 'tricep', tricep: 'bicep', quad: 'ham', ham: 'quad', abs: 'lower', lower: 'abs', shoulder: 'trap', trap: 'shoulder' };
  function openGroupAdd() {
    sheet('<div class="sh"><b>🔗 묶음 세트 추가</b><button class="ib" id="gaX">✕</button></div><p class="note" style="margin:0 0 8px">종류를 먼저 고르면 운동을 개수만큼 이어서 골라요. 기록할 때는 1세트씩 번갈아 하고, 마지막 운동 뒤에만 휴식해요.</p>' +
      '<div class="lst">' + [['ss', '슈퍼세트', '2개 · 서로 다른 부위 (예: 가슴 + 등, 이두 + 삼두)'], ['cp', '컴파운드세트', '2개 · 같은 부위 (예: 벤치프레스 + 인클라인)'], ['tri', '트라이세트', '3개']].map(function (x) {
        return '<button class="it" data-ga="' + x[0] + '" data-n="' + (x[0] === 'tri' ? 3 : 2) + '"><span class="ic">🔗</span><div><b>' + x[1] + '</b><small>' + x[2] + '</small></div><span class="go">›</span></button>';
      }).join('') + '<div class="it"><span class="ic">🔗</span><div><b>자이언트세트</b><small>4개 이상 — 몇 개 할까요?</small></div><span class="row" style="gap:4px">' + [4, 5, 6].map(function (k) { return '<button class="chip" data-ga="gi" data-n="' + k + '">' + k + '개</button>'; }).join('') + '</span></div></div>', function (sb) {
      sb.querySelector('#gaX').onclick = closeSheet;
      sb.querySelectorAll('[data-ga]').forEach(function (b) { b.onclick = function () { openPicker({ type: b.dataset.ga, n: +b.dataset.n, picked: [] }); }; });
    });
  }
  function gpHead() {
    var sb = document.querySelector('#sheet .sb'); if (!sb || !GP || !$('pkTitle')) return;
    $('pkTitle').textContent = '🔗 ' + GTN[GP.type] + ' — ' + (GP.picked.length + 1) + '/' + GP.n + ' 번째 운동';
    var h = GP.picked.length ? '<div class="chips">' + GP.picked.map(function (x, k) { return '<span class="chip on">' + (k + 1) + '. ' + esc(EXM[x].n) + '</span>'; }).join('') + '</div>' : '';
    if (GP.type === 'cp' && GP.picked.length) h += '<p class="note" style="margin:4px 0">같은 부위(' + MUSN[EXM[GP.picked[0]].m] + ') 운동만 보여요</p>';
    if (GP.type === 'ss' && GP.picked.length && OPP[EXM[GP.picked[0]].m]) h += '<p class="note" style="margin:4px 0">추천: 반대 부위(' + MUSN[OPP[EXM[GP.picked[0]].m]] + ')를 먼저 보여 줘요 · 몸에서 다른 부위를 눌러도 돼요</p>';
    $('pkGp').innerHTML = h;
  }
  function gpPick(id) {
    if (GP.picked.indexOf(id) >= 0) { toast('이미 고른 운동이에요'); return; }
    GP.picked.push(id); vib(20);
    var sb = document.querySelector('#sheet .sb');
    if (GP.picked.length < GP.n) {
      PK.q = ''; if (sb && sb.querySelector('#pkQ')) sb.querySelector('#pkQ').value = '';
      PK.mus = GP.type === 'cp' ? EXM[GP.picked[0]].m : (GP.type === 'ss' && OPP[EXM[GP.picked[0]].m] ? OPP[EXM[GP.picked[0]].m] : '');
      PK.tab = 'all'; gpHead(); if (sb) drawBody(sb.querySelector('#pkBody')); drawPick(); return;
    }
    ensureCur();
    CUR.items = CUR.items.filter(function (it) { return !(GP.picked.indexOf(it.ex) >= 0 && !it.sets.length && !it.g); });
    var st = CUR.items.length; GP.picked.forEach(function (x) { CUR.items.push({ ex: x, sets: [], g: -7, gt: GP.type }); });
    normG(CUR.items); CUR.at = st; var nm = GTN[GP.type], first = GP.picked[0]; GP = null; PK.mus = '';
    saveCur(); closeSheet(); render(); openLogger(first); toast('🔗 ' + nm + ' 준비! 1세트씩 번갈아 기록해요');
  }
  function exNames(items) {   /* 「벤치프레스 + 바벨 로우 · 스쿼트」 */
    return items.map(function (it, i) { var nm = EXM[it.ex] ? EXM[it.ex].n : '?'; return (i ? (it.g && items[i - 1].g === it.g ? ' + ' : ' · ') : '') + nm; }).join('');
  }
  function startWorkout(exIds, gs, gts) {
    if (stale() && curSets() && !confirmBox(mdw(CUR.date) + ' 운동(' + curSets() + '세트)이 아직 저장되지 않았어요. 지우고 새로 시작할까요?\n(저장하려면 취소 → 위 「🎉 오운완 저장」)')) return;
    CUR = { id: Date.now(), date: ymd(), start: Date.now(), at: 0, gym: S.gym, items: normG(exIds.map(function (x, k) { var o = { ex: x, sets: [] }; if (gs && gs[k]) { o.g = gs[k]; if (gts && gts[k]) o.gt = gts[k]; } return o; }).filter(function (o) { return EXM[o.ex]; })) };
    saveCur(); render();
  }
  function ensureCur() { if (!CUR) { CUR = { id: Date.now(), date: ymd(), start: Date.now(), at: 0, gym: S.gym, items: [] }; } }
  function addExToCur(exId) {
    ensureCur();
    var i = CUR.items.findIndex(function (it) { return it.ex === exId; });
    if (i < 0) { CUR.items.push({ ex: exId, sets: [] }); i = CUR.items.length - 1; } else CUR.items[i].fin = 0;
    CUR.at = i; saveCur(); return i;
  }
  /* ───── 오운완 (오늘 운동 완료) ───── */
  var CMET = { treadmill: 4.3, bike: 6.8, stepmill: 9 };   /* 유산소 MET 🔶 */
  var SMET = 5;                                              /* 근력운동 MET 🔶 */
  function myKg() { return lastWeight() || (BP && BP.w) || S.myw || 70; }
  function wSum(w) {
    var o = { sets: 0, vol: 0, mus: {}, cmin: 0, cmet: 0 };
    w.items.forEach(function (it) {
      var e = EXM[it.ex]; if (!e) return;
      it.sets.forEach(function (st) {
        if (e.m === 'cardio') { o.cmin += st.r; o.cmet += st.r * (CMET[it.ex] || 5); return; }
        o.sets++; o.vol += setKg(st, e) * st.r;
        o.mus[e.m] = (o.mus[e.m] || 0) + 1;
      });
    });
    var min = w.min != null ? w.min : Math.max(1, Math.round(((w.end || Date.now()) - w.start) / 60000));
    var smin = Math.max(0, min - o.cmin), kg = w.kg || myKg();
    o.min = min; o.kg = kg;
    o.kcal = Math.round((SMET * smin + o.cmet) * kg / 60 * 1.05);
    o.food = dayTot(w.date).k;
    return o;
  }
  function wNo(w) {
    if (w.no) return w.no;
    var same = W.filter(function (x) { return x.date === w.date; }).sort(function (a, b) { return a.start - b.start; });
    return same.indexOf(w) + 1 || 1;
  }
  function wKey(w) { return w.date.replace(/-/g, '') + '_' + wNo(w); }
  function musChips(mus) { return Object.keys(mus).sort(function (a, b) { return mus[b] - mus[a]; }).map(function (m) { return '<span class="chip on">' + MUSN[m] + ' ' + mus[m] + '세트</span>'; }).join(''); }
  function wShare(w) {
    var o = wSum(w), L2 = ['🎉 오운완 ' + mdw(w.date) + ' (' + wKey(w) + ')', '⏱ ' + o.min + '분 · ' + o.sets + '세트 · 볼륨 ' + Math.round(o.vol).toLocaleString() + 'kg · 약 ' + o.kcal + 'kcal'];
    L2.push('💪 ' + Object.keys(o.mus).map(function (m) { return MUSN[m] + ' ' + o.mus[m]; }).join(' · '));
    w.items.forEach(function (it) { var e = EXM[it.ex]; if (e && it.sets.length) L2.push((it.g ? '🔗 ' : '· ') + '[' + MUSN[e.m] + '] ' + e.n + ' ' + it.sets.map(function (st) { return setTxt(st, e); }).join(', ')); });
    if (o.food) L2.push('🍱 그날 먹은 칼로리 ' + o.food + 'kcal');
    L2.push('#오운완 #마크삼식헬스기록');
    return L2.join('\n');
  }
  /* ───── 📸 오운완 이미지 카드 (인스타·스레드) ───── */
  var SC = { fmt: 'feed', kcal: true, wt: true, photo: null };
  function imgLoad(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function bodySrc(side) { return window.PK_IMG ? PK_IMG[side] : 'img/body_' + side + '.jpg'; }
  function faceSrc() { var v = getComputedStyle(document.documentElement).getPropertyValue('--face') || ''; var m = v.match(/url\(["']?(.*?)["']?\)\s*$/); return m ? m[1] : ''; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function bestSet(it, e) { var b = null; it.sets.forEach(function (st) { if (!b || setKg(st, e) > setKg(b, e) || (setKg(st, e) === setKg(b, e) && st.r > b.r)) b = st; }); return b; }
  var FF = "'Noto Sans KR','Noto Sans CJK KR','Apple SD Gothic Neo',system-ui,sans-serif";
  function drawCard(w, cv) {
    var W2 = 1080, H2 = SC.fmt === 'story' ? 1920 : 1350, o = wSum(w), d = parseYmd(w.date);
    cv.width = W2; cv.height = H2; var c = cv.getContext('2d');
    return Promise.all([imgLoad(bodySrc('front')), imgLoad(bodySrc('back')), imgLoad(faceSrc()), SC.photo ? imgLoad(SC.photo) : null]).then(function (im) {
      var P = 64, y;
      /* 배경 */
      if (im[3]) {
        var ph = im[3], sc = Math.max(W2 / ph.width, H2 / ph.height); c.drawImage(ph, (W2 - ph.width * sc) / 2, (H2 - ph.height * sc) / 2, ph.width * sc, ph.height * sc);
        var g0 = c.createLinearGradient(0, 0, 0, H2); g0.addColorStop(0, 'rgba(10,6,9,.55)'); g0.addColorStop(.35, 'rgba(10,6,9,.15)'); g0.addColorStop(.55, 'rgba(10,6,9,.55)'); g0.addColorStop(1, 'rgba(10,6,9,.94)'); c.fillStyle = g0; c.fillRect(0, 0, W2, H2);
      } else {
        var g = c.createLinearGradient(0, 0, W2, H2); g.addColorStop(0, '#1b0f17'); g.addColorStop(.55, '#2a1220'); g.addColorStop(1, '#101316'); c.fillStyle = g; c.fillRect(0, 0, W2, H2);
        var rg = c.createRadialGradient(W2 * .85, 120, 10, W2 * .85, 120, 620); rg.addColorStop(0, 'rgba(255,95,162,.35)'); rg.addColorStop(1, 'rgba(255,95,162,0)'); c.fillStyle = rg; c.fillRect(0, 0, W2, H2);
      }
      /* 머리줄: 킹콩 + 앱 이름 */
      y = P + (SC.fmt === 'story' ? 60 : 0);
      if (im[2]) { c.save(); c.beginPath(); c.arc(P + 34, y + 34, 34, 0, 7); c.clip(); c.drawImage(im[2], P, y, 68, 68); c.restore(); c.strokeStyle = '#ff5fa2'; c.lineWidth = 4; c.beginPath(); c.arc(P + 34, y + 34, 36, 0, 7); c.stroke(); }
      c.fillStyle = '#efe6d6'; c.font = '700 30px ' + FF; c.textBaseline = 'middle'; c.fillText('마크삼식 헬스 기록', P + 88, y + 34);
      c.textAlign = 'right'; c.fillStyle = '#ffb3d3'; c.font = '700 28px ' + FF; c.fillText(wKey(w), W2 - P, y + 34); c.textAlign = 'left';
      /* 큰 제목 */
      y += 120; c.textBaseline = 'alphabetic';
      c.fillStyle = '#ff5fa2'; c.font = '900 168px ' + FF; c.fillText('오운완', P - 6, y + 130);
      c.fillStyle = '#ffffff'; c.font = '700 40px ' + FF;
      c.fillText(d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + ' (' + WD[d.getDay()] + ')' + (wNo(w) > 1 ? '  ·  오늘 ' + wNo(w) + '번째' : ''), P, y + 196);
      /* 숫자 칸 */
      y += 240;
      var st = [[o.min + '분', '운동 시간'], [String(o.sets), '세트']];
      if (SC.wt) st.push([Math.round(o.vol).toLocaleString(), '볼륨 kg']);
      if (SC.kcal) st.push([o.kcal.toLocaleString(), 'kcal (추정)']);
      var gw = (W2 - P * 2 - 16 * (st.length - 1)) / st.length;
      st.forEach(function (x, i) {
        var bx = P + i * (gw + 16); c.fillStyle = 'rgba(255,255,255,.08)'; rr(c, bx, y, gw, 150, 26); c.fill(); c.strokeStyle = 'rgba(255,95,162,.45)'; c.lineWidth = 2; c.stroke();
        c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = '900 ' + (x[0].length > 6 ? 48 : 58) + 'px ' + FF; c.fillText(x[0], bx + gw / 2, y + 82);
        c.fillStyle = '#c9a3b6'; c.font = '600 25px ' + FF; c.fillText(x[1], bx + gw / 2, y + 124); c.textAlign = 'left';
      });
      y += 190;
      /* 킹콩 몸: 오늘 쓴 부위 빛내기 */
      var mx = Math.max.apply(null, [1].concat(Object.keys(o.mus).map(function (m) { return o.mus[m]; })));
      function bodyPair(bx0, by, bodyH, gap) {
        var bw = bodyH * im[0].width / im[0].height;
        [['front', im[0]], ['back', im[1]]].forEach(function (pr, k) {
          var bx = bx0 + k * (bw + gap);
          c.save(); rr(c, bx, by, bw, bodyH, 20); c.clip(); c.drawImage(pr[1], bx, by, bw, bodyH);
          c.fillStyle = 'rgba(16,10,14,.28)'; c.fillRect(bx, by, bw, bodyH);
          D.ZONES[pr[0]].forEach(function (z) {
            var n = o.mus[z[0]]; if (!n) return;
            var cx = bx + (z[1] + z[3] / 2) / 100 * bw, cy = by + (z[2] + z[4] / 2) / 100 * bodyH, rx = z[3] / 200 * bw, ry = z[4] / 200 * bodyH;
            c.save(); c.globalCompositeOperation = 'multiply'; c.filter = 'blur(' + Math.round(bodyH / 50) + 'px)'; c.fillStyle = 'rgba(255,40,120,' + (0.45 + 0.5 * n / mx) + ')';
            c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.fill(); c.restore();
          });
          c.restore();
          c.fillStyle = 'rgba(16,10,14,.75)'; rr(c, bx + 10, by + 10, 56, 36, 10); c.fill(); c.fillStyle = '#ffb3d3'; c.font = '800 22px ' + FF; c.fillText(k ? '뒤' : '앞', bx + 27, by + 36);
        });
        return bw * 2 + gap;
      }
      function chipRow(x0, maxX) {
        var chips = Object.keys(o.mus).sort(function (a, b) { return o.mus[b] - o.mus[a]; }).map(function (m) { return MUSN[m] + ' ' + o.mus[m]; });
        if (o.cmin) chips.push('유산소 ' + o.cmin + '분');
        c.font = '700 28px ' + FF; var cx2 = x0;
        chips.forEach(function (t) { var tw = c.measureText(t).width + 40; if (cx2 + tw > maxX) return; c.fillStyle = 'rgba(255,95,162,.22)'; rr(c, cx2, y, tw, 52, 26); c.fill(); c.fillStyle = '#ffd3e6'; c.fillText(t, cx2 + 20, y + 36); cx2 += tw + 12; });
      }
      function rightTxt(it, e) { var b = bestSet(it, e); return e.m === 'cardio' ? it.sets.reduce(function (a, x) { return a + x.r; }, 0) + '분' : (SC.wt && setKg(b, e) ? setTxt(b, e).replace('×', ' × ') + '  ·  ' : '') + it.sets.length + '세트'; }
      var its = w.items.filter(function (it) { return EXM[it.ex] && it.sets.length; });
      var feedBody = SC.fmt === 'feed' && !im[3] && im[0] && im[1];
      if (feedBody) {
        /* 피드: 왼쪽 몸 · 오른쪽 운동 목록 */
        var bh = 470, used = bodyPair(P, y, bh, 14), lx = P + used + 36, lw = W2 - P - lx, ly = y, per = 78, room = Math.floor(bh / per);
        var show = its.slice(0, its.length > room ? room - 1 : room);
        show.forEach(function (it) {
          var e = EXM[it.ex]; c.fillStyle = '#ffffff'; c.font = '800 32px ' + FF;
          var nm = (it.g ? '🔗 ' : '') + e.n; while (c.measureText(nm).width > lw && nm.length > 2) nm = nm.slice(0, -2) + '…';
          c.fillText(nm, lx, ly + 34); c.fillStyle = '#ffb3d3'; c.font = '700 27px ' + FF; c.fillText(rightTxt(it, e), lx, ly + 68); ly += per;
        });
        if (its.length > show.length) { c.fillStyle = '#c9a3b6'; c.font = '600 26px ' + FF; c.fillText('+ ' + (its.length - show.length) + '개 운동 더', lx, ly + 34); }
        y += bh + 34; chipRow(P, W2 - P);
      } else {
        if (SC.fmt === 'story' && im[0] && im[1]) { var bh2 = im[3] ? 0 : 560; if (bh2) { var bwid = bh2 * im[0].width / im[0].height * 2 + 40; bodyPair((W2 - bwid) / 2, y, bh2, 40); y += bh2 + 34; } }
        if (im[3]) y = Math.max(y, H2 - (SC.fmt === 'story' ? 760 : 520));
        chipRow(P, W2 - P); y += 82;
        var room2 = Math.floor((H2 - P - 40 - (SC.fmt === 'story' ? 90 : 0) - y) / 58), show2 = its.slice(0, Math.max(1, its.length > room2 ? room2 - 1 : room2));
        show2.forEach(function (it) {
          var e = EXM[it.ex]; c.fillStyle = '#ffffff'; c.font = '700 36px ' + FF; var nm = (it.g ? '🔗 ' : '') + (e.n.length > 13 ? e.n.slice(0, 12) + '…' : e.n); c.fillText(nm, P, y + 38);
          c.textAlign = 'right'; c.fillStyle = '#ffb3d3'; c.font = '700 32px ' + FF; c.fillText(rightTxt(it, e), W2 - P, y + 38); c.textAlign = 'left'; y += 58;
        });
        if (its.length > show2.length) { c.fillStyle = '#c9a3b6'; c.font = '600 28px ' + FF; c.fillText('+ ' + (its.length - show2.length) + '개 운동 더', P, y + 30); }
      }
      /* 바닥 */
      c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '600 26px ' + FF; c.fillText('#오운완  #헬스  #운동기록', P, H2 - P - (SC.fmt === 'story' ? 90 : 0));
      c.textAlign = 'right'; c.fillStyle = '#ff5fa2'; c.font = '800 26px ' + FF; c.fillText('🦍 마크삼식 헬스 기록', W2 - P, H2 - P - (SC.fmt === 'story' ? 90 : 0)); c.textAlign = 'left';
      return cv;
    });
  }
  function igCaption(w) {
    var o = wSum(w), L2 = ['오운완 🔥 ' + mdw(w.date) + (wNo(w) > 1 ? ' (' + wNo(w) + '번째)' : ''), ''];
    L2.push('⏱ ' + o.min + '분 · ' + o.sets + '세트' + (SC.wt ? ' · 볼륨 ' + Math.round(o.vol).toLocaleString() + 'kg' : '') + (SC.kcal ? ' · 약 ' + o.kcal + 'kcal' : ''));
    w.items.forEach(function (it) { var e = EXM[it.ex]; if (!e || !it.sets.length) return; var b = bestSet(it, e); L2.push('• ' + e.n + (e.m === 'cardio' ? ' ' + it.sets.reduce(function (a, x) { return a + x.r; }, 0) + '분' : (SC.wt && setKg(b, e) ? ' ' + setTxt(b, e) : '') + ' · ' + it.sets.length + '세트')); });
    L2.push('', '#오운완 #오늘운동완료 #헬스타그램 #운동기록 #' + Object.keys(o.mus).slice(0, 2).map(function (m) { return MUSN[m].replace(/\(.*\)/, '') + '운동'; }).join(' #') + ' #마크삼식헬스기록');
    return L2.join('\n');
  }
  function cardSheet(w) {
    sheet('<div class="sh"><b>📸 인스타·스레드용 오운완</b><button class="ib" id="scX">✕</button></div>' +
      '<div class="scv"><canvas id="scCv"></canvas></div>' +
      '<div class="chips"><button class="chip" data-scf="feed">피드 4:5</button><button class="chip" data-scf="story">스토리 9:16</button>' +
      '<button class="chip" data-sct="kcal">kcal</button><button class="chip" data-sct="wt">무게·볼륨</button></div>' +
      '<div class="g2"><label class="btn" style="text-align:center">🖼 내 사진 배경<input id="scPh" type="file" accept="image/*" hidden></label><button class="btn" id="scPhX">기본 배경</button></div>' +
      '<div class="g2" style="margin-top:6px"><button class="btn p" id="scShare">📤 공유</button><button class="btn" id="scSave">💾 이미지 저장</button></div>' +
      '<button class="btn w" id="scCap" style="margin-top:6px">📋 캡션·해시태그 복사</button>' +
      '<p class="note">인스타 피드·스레드는 4:5, 스토리는 9:16이 화면에 꽉 차요. 공유를 누르면 인스타·스레드·카톡 중에서 골라요.</p>', function (sb) {
      var cv = sb.querySelector('#scCv');
      function redraw() {
        sb.querySelectorAll('[data-scf]').forEach(function (b) { b.classList.toggle('on', b.dataset.scf === SC.fmt); });
        sb.querySelectorAll('[data-sct]').forEach(function (b) { b.classList.toggle('on', !!SC[b.dataset.sct]); });
        sb.querySelector('#scPhX').style.display = SC.photo ? '' : 'none';
        return drawCard(w, cv);
      }
      sb.querySelectorAll('[data-scf]').forEach(function (b) { b.onclick = function () { SC.fmt = b.dataset.scf; redraw(); }; });
      sb.querySelectorAll('[data-sct]').forEach(function (b) { b.onclick = function () { SC[b.dataset.sct] = !SC[b.dataset.sct]; redraw(); }; });
      sb.querySelector('#scPh').onchange = function () { var f = this.files && this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { SC.photo = r.result; redraw(); }; r.readAsDataURL(f); };
      sb.querySelector('#scPhX').onclick = function () { SC.photo = null; redraw(); };
      sb.querySelector('#scX').onclick = closeSheet;
      var fname = function () { return '오운완_' + wKey(w) + '_' + (SC.fmt === 'story' ? '스토리' : '피드') + '.png'; };
      function png() { try { return cv.toDataURL('image/png'); } catch (e) { toast('이미지를 만들지 못했어요 (' + e.name + ')'); return ''; } }   /* 10/24 캔버스 오염(file:// 그림)이면 조용히 멈추던 것 */
      sb.querySelector('#scSave').onclick = function () { var u = png(); if (!u) return; if (NATIVE && KKA.saveImage) { KKA.saveImage(fname(), u.split(',')[1]); return; } var a = document.createElement('a'); a.href = u; a.download = fname(); document.body.appendChild(a); a.click(); a.remove(); toast('💾 ' + fname() + ' 저장'); };
      sb.querySelector('#scShare').onclick = function () {
        var cap = igCaption(w);
        if (NATIVE && KKA.shareImage) { var u = png(); if (!u) return; KKA.shareImage(fname(), u.split(',')[1], cap); return; }
        cv.toBlob(function (bl) {
          try { var f = new File([bl], fname(), { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { copyText(cap); navigator.share({ files: [f], text: cap }).catch(function () { }); return; } } catch (e) { }
          sb.querySelector('#scSave').click(); copyText(cap); toast('이미지를 저장하고 캡션을 복사했어요. 인스타·스레드에서 붙여 넣어요.');
        }, 'image/png');
      };
      sb.querySelector('#scCap').onclick = function () { copyText(igCaption(w)); };
      redraw();
    });
  }
  function endWorkout() {
    CUR.items = normG(CUR.items.filter(function (it) { return it.sets.length; }));
    if (!CUR.items.length) { CUR = null; saveCur(); stopRest(); render(); toast('기록한 세트가 없어 저장하지 않았어요.'); return; }
    var lastT = 0; CUR.items.forEach(function (it) { it.sets.forEach(function (st) { if (st.t > lastT) lastT = st.t; }); });
    CUR.end = (CUR.date !== ymd() && lastT) ? lastT + 60000 : Date.now(); CUR.done = 1; delete CUR.resume;
    var raw = Math.round((CUR.end - CUR.start) / 60000), s0 = wSum(CUR), est = Math.round(s0.sets * 3 + s0.cmin);
    CUR.min = Math.min(180, Math.max(1, raw < est ? est : raw)); CUR.kg = myKg();
    var w = CUR;
    w.no = W.filter(function (x) { return x.date === w.date; }).reduce(function (mx, x) { return Math.max(mx, wNo(x)); }, 0) + 1;
    W.push(w); saveW();
    var ex = w.items.map(function (it) { return it.ex; });
    CUR = null; saveCur(); stopRest(); render();
    owSheet(w, ex);
  }
  /* ───── 🛠 저장된 운동 고치기 (10/24 스티브: 최근 기록에서 잘못 기록한 운동 수정) ─────
     날짜 · 운동 바꾸기 · 세트 무게/횟수 · 세트 빼기/더하기 · 운동 빼기. 복사본에서 고치고 「저장」 때만 반영 */
  function fixSheet(w) {
    if (!w) return;
    var F = { date: w.date, items: JSON.parse(JSON.stringify(w.items)) };
    var exOpts = function (cur) {
      return D.MUS.map(function (m) {
        var l = Object.keys(EXM).map(function (k) { return EXM[k]; }).filter(function (e) { return e.m === m[0]; });
        return l.length ? '<optgroup label="' + esc(m[1]) + '">' + l.map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === cur ? ' selected' : '') + '>' + esc(e.n) + '</option>'; }).join('') + '</optgroup>' : '';
      }).join('');
    };
    function wIn(e, st) { return e.t !== 'bw' || st.mode === 'add' || st.mode === 'ast'; }
    function body() {
      return '<div class="sh"><b>🛠 운동·세트 고치기</b><button class="ib" id="fxX2">✕</button></div>' +
        '<div class="row"><span class="note" style="margin:0">날짜</span><input id="fxD" type="date" value="' + esc(F.date) + '" max="' + ymd() + '"></div>' +
        F.items.map(function (it, i) {
          var e = EXM[it.ex] || { n: '?', t: 'bb', m: '' }, cardio = e.m === 'cardio';
          return '<div class="card fxc"><div class="row" style="gap:6px"><select data-fxe="' + i + '" style="flex:1">' + exOpts(it.ex) + '</select><button class="btn sm" data-fxdi="' + i + '">✕ 운동 빼기</button></div>' +
            it.sets.map(function (st, k) {
              return '<div class="fxs"><span>' + (k + 1) + '</span>' +
                (wIn(e, st) ? '<input type="number" inputmode="decimal" step="0.5" min="0" data-fxw="' + i + '.' + k + '" value="' + fmtW(st.w || 0) + '"><em>' + (e.t === 'bw' ? (st.mode === 'ast' ? '보조kg' : '+kg') : esc(st.u || 'kg')) + '</em>' : '<em class="bw">맨몸</em>') +
                '<input type="number" inputmode="numeric" min="1" data-fxr="' + i + '.' + k + '" value="' + st.r + '"><em>' + (cardio ? '분' : '회') + '</em>' +
                '<button class="ib" data-fxds="' + i + '.' + k + '">✕</button></div>';
            }).join('') +
            '<button class="btn sm" data-fxa="' + i + '" style="margin-top:6px">＋ 세트 더하기</button></div>';
        }).join('') +
        '<p class="note">운동 이름을 눌러 다른 운동으로 바꿀 수 있어요. 「💾 저장」을 눌러야 반영돼요.</p>' +
        '<div class="g2"><button class="btn" id="fxNo">취소</button><button class="btn p" id="fxOk">💾 저장</button></div>';
    }
    function pick(sb) {   /* 입력칸 → 복사본 */
      F.date = sb.querySelector('#fxD').value || F.date;
      sb.querySelectorAll('[data-fxw]').forEach(function (x) { var a = x.dataset.fxw.split('.'), v = parseFloat(x.value); F.items[+a[0]].sets[+a[1]].w = isNaN(v) ? 0 : v; });
      sb.querySelectorAll('[data-fxr]').forEach(function (x) { var a = x.dataset.fxr.split('.'), v = parseInt(x.value, 10); F.items[+a[0]].sets[+a[1]].r = isNaN(v) ? 0 : v; });
    }
    function draw() { var sb = $('sheet') && $('sheet').querySelector('.sb'); if (sb) { sb.innerHTML = body(); bind(sb); } }
    function bind(sb) {
      sb.querySelector('#fxX2').onclick = closeSheet; sb.querySelector('#fxNo').onclick = closeSheet;
      sb.querySelectorAll('[data-fxe]').forEach(function (x) { x.onchange = function () { pick(sb); F.items[+x.dataset.fxe].ex = x.value; draw(); }; });
      sb.querySelectorAll('[data-fxdi]').forEach(function (x) { x.onclick = function () { pick(sb); var it = F.items[+x.dataset.fxdi], e = EXM[it.ex]; if (!confirmBox('「' + (e ? e.n : '이 운동') + '」 ' + it.sets.length + '세트를 이 기록에서 뺄까요?')) return; F.items.splice(+x.dataset.fxdi, 1); draw(); }; });
      sb.querySelectorAll('[data-fxds]').forEach(function (x) { x.onclick = function () { pick(sb); var a = x.dataset.fxds.split('.'); F.items[+a[0]].sets.splice(+a[1], 1); draw(); }; });
      sb.querySelectorAll('[data-fxa]').forEach(function (x) { x.onclick = function () { pick(sb); var it = F.items[+x.dataset.fxa], l = it.sets[it.sets.length - 1]; it.sets.push(l ? JSON.parse(JSON.stringify(l)) : { w: 0, r: 10 }); draw(); }; });
      sb.querySelector('#fxOk').onclick = function () {
        pick(sb);
        var items = F.items.filter(function (it) { return it.sets.length; });
        if (!items.length) { toast('세트가 하나도 없어요. 기록을 통째로 지우려면 「🗑 이 기록 지우기」를 눌러 주세요'); return; }
        var bad = items.some(function (it) { var e = EXM[it.ex]; return it.sets.some(function (st) { return !(st.r > 0) || (e && e.t !== 'bw' && !(st.w >= 0)) || st.w > 1000 || st.r > 999; }); });
        if (bad) { toast('횟수(분)는 1 이상, 무게는 0~1000으로 넣어 주세요'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(F.date) || F.date > ymd()) { toast('날짜를 확인해 주세요'); return; }
        w.items = items; if (w.date !== F.date) { w.date = F.date; W.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0); }); } saveW(); closeSheet(); OWOPEN = String(w.id); render(); vib(20); toast('🛠 고친 기록을 저장했어요');
      };
    }
    sheet(body(), bind);
  }
  function owSheet(w, ex) {
    function body() {
      var o = wSum(w);
      return '<div class="sh"><b>🎉 오운완! 저장했어요</b></div><p class="note" style="margin:0 0 8px">기록 번호 <b style="color:var(--main2)">' + wKey(w) + '</b>' + (wNo(w) > 1 ? ' — 오늘 ' + wNo(w) + '번째 운동' : '') + '</p>' +
        '<div class="kpi"><div><b>' + o.min + '분</b><small>운동 시간</small></div><div><b>' + o.sets + '</b><small>세트</small></div><div><b>' + o.kcal + '</b><small>소모 kcal(추정)</small></div></div>' +
        '<div class="chips" style="margin-top:8px">' + musChips(o.mus) + (o.cmin ? '<span class="chip on">유산소 ' + o.cmin + '분</span>' : '') + '</div>' +
        '<div class="row"><span class="note" style="margin:0">운동 시간</span><input id="owMin" type="number" inputmode="numeric" value="' + o.min + '" style="width:80px">분 <span class="note" style="margin:0 0 0 6px">체중</span><input id="owKg" type="number" inputmode="decimal" value="' + o.kg + '" style="width:80px">kg</div>' +
        '<p class="note">🔶 소모 칼로리는 운동 시간 × 체중 × 운동 강도(근력 MET ' + SMET + ', 유산소는 종목별)로 낸 대략값이에요. 시간·체중을 고치면 다시 계산돼요.</p>' +
        '<div class="g2"><button class="btn p" id="owCard">📸 인스타·스레드 이미지</button><button class="btn" id="owShare">📤 글로 공유</button></div>' +
        (ex ? '<div class="h3" style="margin-top:10px">📋 루틴으로도 저장할까요?</div><input id="rtName" placeholder="루틴 이름 (예: 가슴·삼두 데이)" value="' + esc(ex.slice(0, 2).map(function (x) { return EXM[x].n; }).join('·')) + '">' +
          '<div class="g2"><button class="btn" id="rtSave">📋 루틴 저장</button><button class="btn" id="rtNo">닫기</button></div>' : '<button class="btn w" id="rtNo">닫기</button>');
    }
    sheet(body(), function bind(sb) {
      function upd() {
        var m = parseInt(sb.querySelector('#owMin').value, 10), k = parseFloat(sb.querySelector('#owKg').value);
        if (m > 0 && m < 600) w.min = m; if (k >= 25 && k <= 300) w.kg = k;
        saveW(); var o = wSum(w); sb.querySelector('.kpi').innerHTML = '<div><b>' + o.min + '분</b><small>운동 시간</small></div><div><b>' + o.sets + '</b><small>세트</small></div><div><b>' + o.kcal + '</b><small>소모 kcal(추정)</small></div>';
      }
      sb.querySelector('#owMin').onchange = upd; sb.querySelector('#owKg').onchange = upd;
      sb.querySelector('#owShare').onclick = function () { shareText(wShare(w)); };
      sb.querySelector('#owCard').onclick = function () { cardSheet(w); };
      if (sb.querySelector('#rtSave')) sb.querySelector('#rtSave').onclick = function () { var rg = w.items.map(function (it) { return it.g || 0; }); RT.push(rg.some(Boolean) ? { n: sb.querySelector('#rtName').value.trim() || '내 루틴', ex: ex, g: rg, gt: w.items.map(function (it) { return it.gt || ''; }) } : { n: sb.querySelector('#rtName').value.trim() || '내 루틴', ex: ex }); store.set('rt', RT); closeSheet(); render(); toast('루틴을 저장했어요.'); };
      sb.querySelector('#rtNo').onclick = function () { closeSheet(); render(); };
    });
  }

  /* 시트 */
  function sheet(html, bind) {
    closeSheet();
    var d = document.createElement('div'); d.className = 'sheet'; d.id = 'sheet';
    d.innerHTML = '<div class="sb">' + html + '</div>';
    d.onclick = function (ev) { if (ev.target === d) closeSheet(); };
    document.body.appendChild(d); if (bind) bind(d.querySelector('.sb'));
  }
  function closeSheet() { var s = $('sheet'); if (s) s.remove(); }

  /* ───── 운동 고르기 (킹콩 몸 터치 + 초성 검색) ───── */
  var PK = { mus: '', q: '', tab: 'all' };
  function openPicker(gp) {
    PK.q = ''; GP = gp && gp.picked ? gp : null; if (GP) { PK.mus = ''; PK.tab = 'all'; }
    sheet('<div class="sh"><b id="pkTitle">운동 고르기</b><button class="ib" id="pkX">✕</button></div><div id="pkGp"></div>' +
      '<input id="pkQ" placeholder="🔍 이름 또는 초성 (ㅂㅊ → 벤치)" autocomplete="off">' +
      '<div class="chips" id="pkTabs"><button class="chip" data-t="all">전체</button><button class="chip" data-t="rec">최근</button><button class="chip" data-t="fav">자주</button><button class="chip" data-t="star">⭐</button><button class="chip" data-t="gym">📍 ' + esc(curGym().n) + '</button></div>' +
      '<div class="bodyw" id="pkBody"></div><div id="pkMus" class="row"></div><div class="lst" id="pkList"></div>' +
      '<button class="btn sm" id="pkNew">＋ 목록에 없는 운동 만들기</button>', function (sb) {
      sb.querySelector('#pkX').onclick = function () { GP = null; closeSheet(); };
      var q = sb.querySelector('#pkQ'); q.oninput = function () { PK.q = q.value; drawPick(); };
      sb.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { PK.tab = b.dataset.t; drawPick(); }; });
      sb.querySelector('#pkNew').onclick = newExSheet;
      drawBody(sb.querySelector('#pkBody')); drawPick(); gpHead();
    });
  }
  function drawBody(el) {
    el.innerHTML = ['front', 'back'].map(function (side) {
      return '<div class="body"><img src="img/body_' + side + '.jpg" alt=""><span class="lb">' + (side === 'front' ? '앞' : '뒤') + '</span>' +
        D.ZONES[side].map(function (z) { return '<button class="z' + (PK.mus === z[0] ? ' on' : '') + '" data-m="' + z[0] + '" aria-label="' + MUSN[z[0]] + '" style="left:' + z[1] + '%;top:' + z[2] + '%;width:' + z[3] + '%;height:' + z[4] + '%"></button>'; }).join('') + '</div>';
    }).join('');
    el.querySelectorAll('.z').forEach(function (b) { b.onclick = function () { PK.mus = PK.mus === b.dataset.m ? '' : b.dataset.m; PK.tab = 'all'; drawBody(el); drawPick(); vib(15); }; });
  }
  function drawPick() {
    var sb = document.querySelector('#sheet .sb'); if (!sb) return;
    sb.querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === PK.tab); });
    sb.querySelector('#pkMus').innerHTML = PK.mus ? '<span class="chip on">' + MUSN[PK.mus] + '</span><button class="btn sm" id="pkMusX">✕ 부위 풀기</button>' : '<span class="note">👆 킹콩 몸에서 부위를 누르면 그 부위 운동만 보여요</span>';
    if ($('pkMusX')) $('pkMusX').onclick = function () { PK.mus = ''; drawBody(sb.querySelector('#pkBody')); drawPick(); };
    var cnt = useCount(), list;
    if (PK.tab === 'rec') list = recentEx().map(function (x) { return EXM[x]; });
    else if (PK.tab === 'fav') list = Object.keys(cnt).filter(function (x) { return EXM[x]; }).sort(function (a, b) { return cnt[b] - cnt[a]; }).map(function (x) { return EXM[x]; });
    else if (PK.tab === 'gym') { var gx = curGym().ex || {}; list = Object.keys(gx).filter(function (x) { return gx[x] && EXM[x]; }).map(function (x) { return EXM[x]; }); }
    else if (PK.tab === 'star') list = Object.keys(S.star).filter(function (x) { return S.star[x] && EXM[x]; }).map(function (x) { return EXM[x]; });
    else list = Object.keys(EXM).map(function (x) { return EXM[x]; }).sort(function (a, b) { return (cnt[b.id] || 0) - (cnt[a.id] || 0); });
    list = list.filter(function (e) { return (!PK.mus || e.m === PK.mus || e.m2.indexOf(PK.mus) >= 0) && exMatch(e, PK.q || ''); });
    sb.querySelector('#pkList').innerHTML = list.length ? list.slice(0, 60).map(function (e) {
      var lp = lastItem(e.id, null, S.gym);
      return '<div class="it"><button class="ic" data-star="' + e.id + '">' + (S.star[e.id] ? '⭐' : '☆') + '</button><div data-pick="' + e.id + '" style="cursor:pointer"><b>' + esc(e.n) + '</b><small>' + TYPEN[e.t] + ' · ' + MUSN[e.m] + (lp ? ' · 지난번 ' + esc(setTxt(lp.it.sets[0], e)) : '') + '</small></div><span class="go" data-pick="' + e.id + '">＋</span></div>';
    }).join('') : (PK.tab === 'gym' ? '<p class="note">📍 ' + esc(curGym().n) + '에 있는 기구가 아직 없어요. 운동을 기록하면 자동으로 담기고, 전체 목록에서 📍를 눌러 미리 담을 수도 있어요.</p>' : '<p class="note">찾는 운동이 없어요. 아래 「목록에 없는 운동 만들기」로 추가해요.</p>');
    sb.querySelectorAll('.it').forEach(function (row) { var pk = row.querySelector('[data-pick]'); if (!pk) return; var id = pk.dataset.pick, on = (curGym().ex || {})[id]; var b = document.createElement('button'); b.className = 'ic gx' + (on ? ' on' : ''); b.dataset.gx = id; b.title = '우리 헬스장에 있음'; b.textContent = '📍'; row.appendChild(b); });
    sb.querySelectorAll('[data-gx]').forEach(function (b) { b.onclick = function () { var g = curGym(); g.ex = g.ex || {}; g.ex[b.dataset.gx] = g.ex[b.dataset.gx] ? 0 : 1; saveS(); drawPick(); }; });
    sb.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { var id = b.dataset.pick; if (GP) { gpPick(id); return; } addExToCur(id); closeSheet(); render(); openLogger(id); }; });
    sb.querySelectorAll('[data-star]').forEach(function (b) { b.onclick = function () { var id = b.dataset.star; S.star[id] = !S.star[id]; saveS(); drawPick(); }; });
  }
  function newExSheet() {
    sheet('<div class="sh"><b>새 운동 만들기</b></div><input id="nxN" placeholder="이름 (예: 우리 헬스장 체스트 머신)">' +
      '<select id="nxM">' + D.MUS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('') + '</select>' +
      '<select id="nxT">' + Object.keys(TYPEN).map(function (t) { return '<option value="' + t + '">' + TYPEN[t] + '</option>'; }).join('') + '</select>' +
      '<button class="btn p w" id="nxOk">만들고 기록하기</button>', function (sb) {
      sb.querySelector('#nxOk').onclick = function () {
        var n = sb.querySelector('#nxN').value.trim(); if (!n) { toast('이름을 넣어 주세요'); return; }
        var id = 'c' + Date.now(); CUSTOM.push([id, n, sb.querySelector('#nxM').value, sb.querySelector('#nxT').value, '', '']); store.set('cex', CUSTOM); loadEx();
        addExToCur(id); closeSheet(); render(); openLogger(id);
      };
    });
  }

  /* ───── 세트 기록 시트 ───── */
  var L = null;
  function initL(exId) {
    var e = EXM[exId], it = CUR.items[CUR.at], base = it.sets[it.sets.length - 1];
    var lp = lastItem(exId, CUR.date, CUR.gym || S.gym);
    if (!base && lp) base = lp.it.sets[Math.min(it.sets.length, lp.it.sets.length - 1)];
    var mc = S.mc[exId] || { u: 'kg', st: e.t === 'cb' ? 2.5 : 5 };
    L = { ex: exId, r: base ? base.r : (e.m === 'cardio' ? 20 : 10), u: base && base.u ? base.u : (e.t === 'mc' || e.t === 'cb' ? mc.u : 'kg'), st: mc.st, mode: base && base.mode ? base.mode : 'bw' };
    if (e.t === 'bb' || e.t === 'sm') { L.bar = base && base.bar != null ? base.bar : (S.bar[exId] != null ? S.bar[exId] : (e.t === 'sm' ? 0 : 20)); L.pl = base && base.pl ? base.pl.slice() : []; }
    else L.w = base ? base.w : (e.t === 'db' ? 10 : e.t === 'bw' ? 0 : 20);
    if (e.t === 'hm') {
      L.bar = base && base.bar != null ? base.bar : (S.bar[exId] != null ? S.bar[exId] : 0);
      L.pl = base && base.pl ? base.pl.slice() : [];
      L.sd = base && base.sd ? base.sd : ((S.mc[exId] || {}).sd || 2);
      L.u = 'kg';
    }
  }
  function plOn() { var t = EXM[L.ex].t; return t === 'bb' || t === 'sm' || t === 'hm'; }
  function mcSave(o) { S.mc[L.ex] = Object.assign({}, S.mc[L.ex] || {}, { u: L.u, st: L.st }, o || {}); saveS(); }
  function lW() { if (plOn()) return L.bar + (L.sd || 2) * L.pl.reduce(function (a, b) { return a + b; }, 0); return L.w; }
  function openLogger(exId) {
    initL(exId);
    sheet('<div id="lg"></div>', function () { drawLogger(); });
  }
  function plateCls(p) { return 'p' + String(p).replace('.', '_'); }
  function drawLogger() {
    var el = $('lg'); if (!el || !L) return;
    var e = EXM[L.ex], it = CUR.items[CUR.at], lp = lastItem(L.ex, CUR.date, CUR.gym || S.gym), sg = suggest(L.ex), h = '';
    h += '<div class="sh"><span style="font-size:22px">' + TYPEI[e.t] + '</span><b>' + esc(e.n) + '</b><button class="ib" id="lgX">✕</button></div>';
    if (lp) h += '<div class="prev">지난번 ' + mdw(lp.date) + ': ' + esc(lp.it.sets.map(function (s) { return setTxt(s, e); }).join(' · ')) + '</div>';
    if (sg) h += '<div class="coach">' + esc(sg.t) + '</div>';
    if (plOn()) {
      var tot = lW(), mcP = e.t === 'hm';
      h += '<div class="wbig">' + fmtW(tot) + '<small>kg</small></div><div class="wsub">' + (mcP ? '기구 ' + fmtW(L.bar) : '바 ' + fmtW(L.bar)) + ' + ' + (L.sd === 1 ? '한쪽만 ' : '한쪽 ') + (L.pl.length ? L.pl.join('+') : '원판 없음') + '</div>';
      h += '<div class="bar"><div class="rod"></div><div class="sideL">' + L.pl.map(function (p, i) { return '<span class="pl ' + plateCls(p) + '" data-rm="' + i + '">' + p + '</span>'; }).join('') + '</div><div class="sideR">' + (L.sd === 1 ? [] : L.pl).map(function (p, i) { return '<span class="pl ' + plateCls(p) + '" data-rm="' + i + '">' + p + '</span>'; }).join('') + '</div></div>';
      var pls = ['25', '20', '15', '10', '5', '2.5', '1.25'].filter(function (p) { return S.plates[p]; });
      h += '<div class="pbtn" style="grid-template-columns:repeat(' + Math.min(pls.length, 4) + ',1fr)">' + pls.map(function (p) { return '<button class="pb' + p.replace('.', '_') + '" data-pl="' + p + '">' + p + '<small>' + (L.sd === 1 ? '+' + fmtW(+p) : '양쪽 +' + fmtW(p * 2)) + '</small></button>'; }).join('') + '</div>';
      if (mcP) h += '<div class="row"><span class="note" style="margin:0">끼우는 곳</span>' + [[2, '양쪽'], [1, '한쪽만']].map(function (x) { return '<button class="chip' + ((L.sd || 2) === x[0] ? ' on' : '') + '" data-sd="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      h += '<div class="row"><span class="note" style="margin:0">' + (mcP ? '기구 무게' : '바 무게') + '</span>' + (mcP ? [0, 10, 20, 30] : [20, 15, 10, 0]).map(function (b) { return '<button class="chip' + (L.bar === b ? ' on' : '') + '" data-bar="' + b + '">' + (b ? b + 'kg' : (mcP ? '0(원판만)' : '없음/스미스')) + '</button>'; }).join('') + '<button class="btn sm" id="plClr">원판 비우기</button></div>';
      h += '<p class="note" style="margin:0">' + (mcP ? '원판을 누를 때마다 ' + (L.sd === 1 ? '한쪽에' : '양쪽에') + ' 한 장씩 끼워요. 기구 자체 무게를 모르면 0으로 두고 원판 무게만 기록해도 돼요.' : '원판을 누를 때마다 바 양쪽에 한 장씩 끼워요.') + ' 끼운 원판을 누르면 빠져요.</p>';
    } else if (e.t === 'bw') {
      if (e.m !== 'cardio') {
        h += '<div class="chips">' + [['bw', '맨몸'], ['add', '+중량'], ['ast', '보조(머신)']].map(function (m) { return '<button class="chip' + (L.mode === m[0] ? ' on' : '') + '" data-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>';
        if (L.mode !== 'bw') h += '<div class="stp"><button data-w="-2.5">−</button><div class="v">' + fmtW(L.w) + '<small>' + (L.mode === 'add' ? '추가 kg' : '보조 무게') + '</small></div><button data-w="2.5">＋</button></div>';
      }
    } else {
      var st = e.t === 'db' || e.t === 'kb' ? S.dbStep : L.st;
      var dbk = true;
      h += '<div class="stp"><button data-w="-' + st + '">−' + fmtW(st) + '</button><div class="v">' + (dbk ? '<input id="wIn" class="wIn" type="number" inputmode="decimal" step="0.5" min="0" value="' + fmtW(L.w) + '" aria-label="무게 직접 입력">' : fmtW(L.w)) + '<small>' + L.u + (e.t === 'db' ? ' (한 손)' : '') + (L.u === 'lb' ? ' ≈ ' + r1(L.w * LB) + 'kg' : '') + '</small></div><button data-w="' + st + '">+' + fmtW(st) + '</button></div>';
      if (e.t === 'mc' || e.t === 'cb') {
        h += '<div class="row"><span class="note" style="margin:0">이 기구</span>' + ['kg', 'lb'].map(function (u) { return '<button class="chip' + (L.u === u ? ' on' : '') + '" data-u="' + u + '">' + u + '</button>'; }).join('') +
          '<span class="note" style="margin:0 0 0 6px">＋/− 한 번에</span>' + (L.u === 'lb' ? [5, 10, 15] : [2.5, 5, 10]).map(function (s) { return '<button class="chip' + (L.st === s ? ' on' : '') + '" data-st="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
          '<p class="note" style="margin:0">숫자를 누르면 무게를 바로 입력해요. 같은 기구라도 헬스장마다 무게가 달라서 📍 헬스장별로 지난번 무게를 따로 기억해요.</p>';
      } else {
        h += '<div class="qw">' + (e.t === 'kb' ? [8, 12, 16, 20, 24, 32] : [5, 10, 15, 20, 25, 30]).map(function (q) { return '<button class="chip' + (L.w === q ? ' on' : '') + '" data-qw="' + q + '">' + q + '</button>'; }).join('') + '</div>';
        h += '<div class="row"><span class="note" style="margin:0">＋/− 한 번에</span>' + [1, 2, 2.5].map(function (s) { return '<button class="chip' + (S.dbStep === s ? ' on' : '') + '" data-dst="' + s + '">' + s + 'kg</button>'; }).join('') + '</div>';
        h += '<p class="note" style="margin:0">숫자를 누르면 무게를 바로 입력해요. 다음부터는 지난번 무게가 자동으로 채워져요.</p>';
      }
    }
    h += '<div class="stp"><button data-r="-1">−</button><div class="v">' + L.r + '<small>' + (e.m === 'cardio' ? '분' : '회') + '</small></div><button data-r="1">＋</button></div>';
    if (e.m !== 'cardio') h += '<div class="row rxr"><span class="note" style="margin:0">⏱ 이 운동 휴식</span>' + [30, 60, 90, 120, 180, 240].map(function (x) { return '<button class="chip' + (restFor(L.ex) === x ? ' on' : '') + '" data-rx="' + x + '">' + (x % 60 ? x + '초' : x / 60 + '분') + '</button>'; }).join('') + '</div>';
    if (it.sets.length) h += '<div class="sets">' + it.sets.map(function (s, k) { return '<span class="st ok" data-del="' + k + '">' + (k + 1) + ') ' + esc(setTxt(s, e)) + ' ✕</span>'; }).join('') + '</div><p class="note" style="margin:0">세트를 누르면 지워져요.</p>';
    h += '<div class="lgbar">';
    if (it.fin) h += '<div class="finb">🏁 끝낸 운동이에요 · ' + it.sets.length + '세트</div><button class="btn w" id="lgUnfin">↩ 다시 열고 세트 추가</button>';
    else h += '<button class="big" id="lgOk" style="justify-content:center"><i>✅</i><div style="flex:none"><b>' + (it.sets.length + 1) + '세트 완료</b></div></button>';
    h += '<div class="g3' + (it.sets.length && !it.fin ? '' : ' two') + '">' + (it.sets.length && !it.fin ? '<button class="btn fin" id="lgFin">🏁 ' + it.sets.length + '세트로 끝</button>' : '') + '<button class="btn" id="lgNext">다음 운동 ›</button><button class="btn" id="lgRest">⏱ ' + (restFor(L.ex) % 60 ? restFor(L.ex) + '초' : restFor(L.ex) / 60 + '분') + '</button></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelector('#lgX').onclick = function () { closeSheet(); render(); };
    el.querySelectorAll('[data-pl]').forEach(function (b) { b.onclick = function () { L.pl.push(+b.dataset.pl); L.pl.sort(function (a, b2) { return b2 - a; }); vib(10); drawLogger(); }; });
    el.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { L.pl.splice(+b.dataset.rm, 1); drawLogger(); }; });
    el.querySelectorAll('[data-bar]').forEach(function (b) { b.onclick = function () { L.bar = +b.dataset.bar; S.bar[L.ex] = L.bar; saveS(); drawLogger(); }; });
    if (el.querySelector('#plClr')) el.querySelector('#plClr').onclick = function () { L.pl = []; drawLogger(); };
    el.querySelectorAll('[data-w]').forEach(function (b) { b.onclick = function () { L.w = Math.max(0, r1(L.w + parseFloat(b.dataset.w))); drawLogger(); }; });
    el.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { L.r = Math.max(1, L.r + +b.dataset.r); drawLogger(); }; });
    el.querySelectorAll('[data-u]').forEach(function (b) { b.onclick = function () { L.u = b.dataset.u; L.st = L.u === 'lb' ? 10 : 5; mcSave(); drawLogger(); }; });
    el.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { L.st = +b.dataset.st; mcSave(); drawLogger(); }; });
    el.querySelectorAll('[data-sd]').forEach(function (b) { b.onclick = function () { L.sd = +b.dataset.sd; mcSave({ sd: L.sd }); drawLogger(); }; });
    el.querySelectorAll('[data-qw]').forEach(function (b) { b.onclick = function () { L.w = +b.dataset.qw; vib(10); drawLogger(); }; });
    var wIn = el.querySelector('#wIn'); if (wIn) { wIn.onfocus = function () { wIn.select(); }; wIn.onchange = function () { var v = parseFloat(wIn.value); if (v >= 0 && v <= 500) L.w = r1(v); drawLogger(); }; }
    el.querySelectorAll('[data-dst]').forEach(function (b) { b.onclick = function () { S.dbStep = +b.dataset.dst; saveS(); drawLogger(); }; });
    el.querySelectorAll('[data-mode]').forEach(function (b) { b.onclick = function () { L.mode = b.dataset.mode; if (L.mode !== 'bw' && !L.w) L.w = 5; drawLogger(); }; });
    el.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { it.sets.splice(+b.dataset.del, 1); saveCur(); drawLogger(); }; });
    if (el.querySelector('#lgOk')) el.querySelector('#lgOk').onclick = function () { logSet(); };
    if (el.querySelector('#lgFin')) el.querySelector('#lgFin').onclick = function () { finEx(); };
    if (el.querySelector('#lgUnfin')) el.querySelector('#lgUnfin').onclick = function () { it.fin = 0; saveCur(); drawLogger(); };
    el.querySelector('#lgRest').onclick = function () { startRest(restFor(L.ex)); };
    el.querySelectorAll('[data-rx]').forEach(function (b) { b.onclick = function () { S.rx[L.ex] = +b.dataset.rx; saveS(); drawLogger(); }; });
    el.querySelector('#lgNext').onclick = function () {
      if (CUR.at < CUR.items.length - 1) { CUR.at++; saveCur(); openLogger(CUR.items[CUR.at].ex); } else { closeSheet(); render(); openPicker(); }
    };
  }
  function finEx() {
    var it = CUR.items[CUR.at], e = EXM[it.ex]; it.fin = 1; saveCur(); vib([40, 60, 40]); closeSheet(); render();
    var nx = -1; for (var i = 0; i < CUR.items.length; i++) { var j = (CUR.at + 1 + i) % CUR.items.length; if (!CUR.items[j].fin) { nx = j; break; } }
    var v = 0; it.sets.forEach(function (st) { v += setKg(st, e) * st.r; });
    sheet('<div class="sh"><b>🏁 ' + esc(e.n) + ' 끝!</b></div><p class="note" style="margin:0 0 10px">' + it.sets.length + '세트' + (e.m === 'cardio' ? '' : ' · 볼륨 ' + Math.round(v).toLocaleString() + 'kg') + ' · 다음은 뭘 할까요?</p>' +
      (nx >= 0 ? '<button class="big" id="fxNext"><i>▶</i><div><b>다음: ' + esc(EXM[CUR.items[nx].ex].n) + '</b><small>루틴에 남은 운동</small></div><em>›</em></button>' : '') +
      '<button class="big" id="fxPick"><i>＋</i><div><b>다른 운동 고르기</b><small>킹콩 몸 터치 · 초성 검색</small></div><em>›</em></button>' +
      '<button class="btn p w" id="fxOw" style="margin-top:6px">🎉 오운완 (오늘 운동 끝)</button><button class="btn w" id="fxX" style="margin-top:6px">닫기</button>', function (sb) {
      if (sb.querySelector('#fxNext')) sb.querySelector('#fxNext').onclick = function () { CUR.at = nx; saveCur(); closeSheet(); render(); openLogger(CUR.items[nx].ex); };
      sb.querySelector('#fxPick').onclick = function () { closeSheet(); render(); openPicker(); };
      sb.querySelector('#fxOw').onclick = function () { closeSheet(); endWorkout(); };
      sb.querySelector('#fxX').onclick = function () { closeSheet(); render(); };
    });
  }
  function logSet() {
    var e = EXM[L.ex], it = CUR.items[CUR.at], s = { r: L.r, t: Date.now() };
    if (plOn()) { s.w = lW(); s.u = 'kg'; s.bar = L.bar; s.pl = L.pl.slice(); if (e.t === 'hm') s.sd = L.sd || 2; }
    else if (e.t === 'bw') { s.mode = L.mode; s.w = L.mode === 'bw' ? 0 : L.w; s.u = 'kg'; }
    else { s.w = L.w; s.u = L.u; }
    it.sets.push(s); saveCur(); vib(30); gymMark(L.ex);
    var undo = function () { var k = it.sets.indexOf(s); if (k >= 0) it.sets.splice(k, 1); saveCur(); stopRest(); if ($('lg')) drawLogger(); else render(); toast('↩ 방금 세트를 취소했어요'); };
    /* 40차: 묶음(슈퍼·컴파운드) — 다음 운동으로 바로, 마지막 운동이면 휴식 뒤 첫 운동으로 */
    var gr = e.m !== 'cardio' ? grpIdx(CUR.items, CUR.at) : null, q, nx = -1;
    if (gr) {
      for (q = CUR.at + 1; q <= gr[1]; q++) if (!CUR.items[q].fin) { nx = q; break; }
      if (nx >= 0) { stopRest(); CUR.at = nx; saveCur(); openLogger(CUR.items[nx].ex); showUndo('✅ ' + it.sets.length + '세트 · ' + setTxt(s, e) + ' → 🔗 ' + EXM[CUR.items[nx].ex].n, undo); return; }
      for (q = gr[0]; q < CUR.at; q++) if (!CUR.items[q].fin) { nx = q; break; }
      startRest(restFor(L.ex));
      if (nx >= 0) { CUR.at = nx; saveCur(); openLogger(CUR.items[nx].ex); showUndo('✅ ' + it.sets.length + '세트 · ' + setTxt(s, e) + ' → ⏱ 휴식 뒤 ' + EXM[CUR.items[nx].ex].n, undo); return; }
    } else if (e.m !== 'cardio') startRest(restFor(L.ex));
    showUndo('✅ ' + it.sets.length + '세트 · ' + setTxt(s, e), undo);
    drawLogger();
  }

  /* ───── 휴식 타이머 ───── */
  var REST = null, restI = null, actx = null;
  function beep() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); var o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = .15; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + .25); } catch (e) { } }
  function startRest(sec) {
    REST = { end: Date.now() + sec * 1000 }; $('rest').classList.remove('hide', 'end'); tickRest(); clearInterval(restI); restI = setInterval(tickRest, 500);
    if (NATIVE && KKA.restAlarm) try { KKA.restAlarm(Math.round(sec)); } catch (e) { }   /* 앱: 화면이 꺼져도 끝나면 진동·알림 */
  }
  function stopRest() { REST = null; clearInterval(restI); $('rest').classList.add('hide'); if (NATIVE && KKA.restCancel) try { KKA.restCancel(); } catch (e) { } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && REST) tickRest(); });
  var undoT = null, undoFn = null;
  function showUndo(msg, fn) {
    var u = $('undo'); if (!u) return; undoFn = fn; $('undoT').textContent = msg; u.classList.remove('hide');
    clearTimeout(undoT); undoT = setTimeout(function () { u.classList.add('hide'); undoFn = null; }, 6000);
  }
  function tickRest() {
    if (!REST) return; var left = Math.round((REST.end - Date.now()) / 1000);
    if (left <= 0) { if (!REST.done) { REST.done = true; vib([300, 150, 300]); beep(); $('rest').classList.add('end'); } $('restT').innerHTML = '휴식 끝! <small>다음 세트 가요</small>'; if (left < -20) stopRest(); return; }
    $('restT').innerHTML = Math.floor(left / 60) + ':' + pad(left % 60) + '<small>휴식 중</small>';
  }

  /* ───── 🎙️ 음성 입력 ───── */
  var NUMW = { '한': 1, '하나': 1, '두': 2, '둘': 2, '세': 3, '셋': 3, '네': 4, '넷': 4, '다섯': 5, '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9, '열': 10, '열한': 11, '열두': 12, '열다섯': 15, '스무': 20, '스물': 20 };
  function sinoVal(w) {
    var D1 = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 }, tot = 0, cur = 0;
    w.replace(/\s/g, '').split('').forEach(function (c) {
      if (D1[c]) cur = D1[c];
      else if (c === '십') { tot += (cur || 1) * 10; cur = 0; }
      else if (c === '백') { tot += (cur || 1) * 100; cur = 0; }
    });
    return tot + cur;
  }
  function normNum(t) {
    t = t.replace(/((?:[일이삼사오육칠팔구십백]\s?)+)(?:점\s?([일이삼사오육칠팔구]))?\s*(kg|lb)/g, function (m, w, d, u) { var v = sinoVal(w); return v ? ' ' + v + (d ? '.' + sinoVal(d) : '') + u : m; });
    t = t.replace(/(\d+)\s*점\s*오\s*(kg|lb)/g, '$1.5$2');
    return t.replace(/(열다섯|열두|열한|스무|스물|다섯|여섯|일곱|여덟|아홉|하나|둘|셋|넷|한|두|세|네|열)\s*(개|회|번|세트|셋트|판)/g, function (m, w, u) { return NUMW[w] + u; });
  }
  var VSTOP = ['프레스', '머신', '덤벨', '바벨', '케이블', '걷기', '계단', '레이즈', '컬', '로우', '플라이', '익스텐션'];
  function parseVoice(text) {
    var t = normNum(text.replace(/킬로그램|키로그램|킬로|키로/g, 'kg').replace(/파운드/g, 'lb').replace(/,/g, ' '));
    var best = null, bl = 0, compact = t.replace(/\s/g, '');
    Object.keys(EXM).forEach(function (id) {
      var e = EXM[id], names = [e.n, e.n.replace(/\s*머신$/, '')].concat(e.al ? [e.al].concat(e.al.split(' ').filter(function (x) { return VSTOP.indexOf(x) < 0; })) : []);
      var hb = /해머|원판/.test(compact) ? (e.t === 'hm' ? 0.5 : -0.5) : 0;
      names.forEach(function (n) { n = n.replace(/\s/g, ''); var sc = n.length + hb; if (n.length >= 2 && compact.indexOf(n) >= 0 && sc > bl) { best = id; bl = sc; } });
    });
    var m, w = null, u = 'kg', r = null, n = 1;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/))) { w = +m[1]; u = m[2]; }
    if ((m = t.match(/(\d+)\s*(개|회|번|랩)/))) r = +m[1];
    if ((m = t.match(/(\d+)\s*(세트|셋트|셋)/))) n = Math.min(+m[1], 10);
    if (w == null) { var nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(function (x) { return x !== r && x !== n; }); if (nums.length) w = nums[0]; }
    if (!r) { var ns = (t.match(/\d+/g) || []).map(Number); if (ns.length >= 2 && w === ns[0]) r = ns[1]; }
    return { ex: best, w: w, u: u, r: r, n: n, text: text };
  }
  function applyVoice(p) {
    if (!p.ex) { toast('🎙️ 운동 이름을 못 알아들었어요: 「' + p.text + '」'); return; }
    var e = EXM[p.ex]; ensureCur(); addExToCur(p.ex);
    var it = CUR.items[CUR.at];
    if (!p.r) { saveCur(); render(); openLogger(p.ex); toast('🎙️ ' + e.n + ' — 횟수는 화면에서 넣어 주세요'); return; }
    for (var i = 0; i < p.n; i++) {
      var s = { r: p.r, t: Date.now(), u: p.u, w: p.w || 0 };
      if (e.t === 'bb' || e.t === 'sm' || e.t === 'hm') { s.u = p.u; s.bar = e.t === 'bb' ? 20 : 0; s.pl = null; }
      if (e.t === 'bw') { s.mode = p.w ? 'add' : 'bw'; s.u = 'kg'; }
      it.sets.push(s);
    }
    saveCur(); render(); toast('🎙️ ' + e.n + ' ' + (p.w ? fmtW(p.w) + p.u + ' ' : '') + p.r + '회 × ' + p.n + '세트 기록!');
    gymMark(p.ex);
    if (e.m !== 'cardio') startRest(restFor(p.ex));
  }
  var REC = null;
  function startVoice() {
    sheet('<div class="sh"><b>🎙️ 말로 기록하기</b></div><p class="note">예) 「벤치 60 10개 3세트」 · 「랫풀다운 50킬로 12개」 · 「스쿼트 100 5회 5세트」 · 「풀업 8개 3세트」</p><div class="voice" id="vTxt">듣고 있어요…</div><button class="btn w" id="vStop">그만 듣기</button>', function (sb) {
      sb.querySelector('#vStop').onclick = function () { stopVoice(); closeSheet(); };
    });
    if (NATIVE && KKA.micStart) { try { KKA.micStart('pk'); } catch (e) { } return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $('vTxt').textContent = '이 브라우저는 음성 인식을 지원하지 않아요. 앱에서 써 주세요.'; return; }
    REC = new SR(); REC.lang = 'ko-KR'; REC.interimResults = true;
    REC.onresult = function (ev) { var r = ev.results[ev.results.length - 1]; $('vTxt').textContent = r[0].transcript; if (r.isFinal) { var p = parseVoice(r[0].transcript); stopVoice(); closeSheet(); applyVoice(p); } };
    REC.onerror = function () { if ($('vTxt')) $('vTxt').textContent = '잘 못 들었어요. 다시 눌러 주세요.'; };
    try { REC.start(); } catch (e) { }
  }
  function stopVoice() { try { if (NATIVE && KKA.micStop) KKA.micStop(); if (REC) REC.stop(); } catch (e) { } REC = null; }
  window.gsMic = function (o) {
    if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { return; } }
    var v = $('vTxt');
    if (o.t === 'part' && v) v.textContent = o.text;
    else if (o.t === 'final') { stopVoice(); closeSheet(); applyVoice(parseVoice(o.text)); }
    else if (o.t === 'err' && v) v.textContent = o.msg || '마이크를 열지 못했어요.';
  };
  window.PK_parseVoice = parseVoice; // 검사용

  /* ───────── 📈 기록·분석 탭 ───────── */
  var HX = store.get('hx', '');
  var OWOPEN = '', OWALL = false;
  /* ───── 오운완 달력 · 거르기 · 백업 알림 · CSV ───── */
  var CALM = ymd().slice(0, 7), CALD = '', CALF = { m: '', q: '' }, CALSEL = null, CALUNDO = null;   /* 10/24 날짜 골라 지우기: CALSEL = {날짜:1} · CALUNDO = 방금 지운 기록 */
  function wMatch(w) {
    if (!CALF.m && !CALF.q) return true;
    return w.items.some(function (it) { var e = EXM[it.ex]; return e && it.sets.length && (!CALF.m || e.m === CALF.m) && (!CALF.q || exMatch(e, CALF.q)); });
  }
  function owCard(w) {
    var o = wSum(w), op = OWOPEN === String(w.id), multi = W.some(function (x) { return x !== w && x.date === w.date; });
    return '<div class="owd' + (op ? ' on' : '') + '"><button class="owh" data-ow="' + w.id + '"><b>🎉 ' + mdw(w.date) + (multi || wNo(w) > 1 ? ' #' + wNo(w) : '') + '</b><span>' + o.min + '분 · ' + o.sets + '세트 · 약 ' + o.kcal + 'kcal</span><em>' + (op ? '▲' : '▼') + '</em></button>' +
      '<div class="chips">' + musChips(o.mus) + (o.cmin ? '<span class="chip on">유산소 ' + o.cmin + '분</span>' : '') + '</div>' +
      (op ? '<div class="owb">' + w.items.map(function (it) {
        var e = EXM[it.ex]; if (!e) return '';
        return '<div class="owx"><span class="tag">' + MUSN[e.m] + '</span><b>' + (it.g ? '🔗 ' : '') + esc(e.n) + '</b><small>' + (e.m === 'cardio' ? '' : TYPEN[e.t]) + '</small><div class="sets">' + it.sets.map(function (st, k) { return '<span class="st ok">' + (k + 1) + ') ' + esc(setTxt(st, e)) + '</span>'; }).join('') + '</div></div>';
      }).join('') +
        '<p class="note">기록 번호 ' + wKey(w) + ' · 볼륨 ' + Math.round(o.vol).toLocaleString() + 'kg · 체중 ' + o.kg + 'kg 기준 소모 약 ' + o.kcal + 'kcal(🔶 추정)' + (o.food ? ' · 🍱 그날 먹은 ' + o.food + 'kcal' : '') + '</p>' +
        '<button class="btn p w" data-owig="' + w.id + '">📸 인스타·스레드 이미지 만들기</button><div class="g2" style="margin-top:6px"><button class="btn" data-owsh="' + w.id + '">📤 글로 공유</button><button class="btn" data-owed="' + w.id + '">✏️ 시간·체중</button></div><button class="btn w" data-owfix="' + w.id + '" style="margin-top:6px">🛠 운동·세트 고치기</button><button class="btn sm" data-dw="' + w.id + '" style="margin-top:6px">🗑 이 기록 지우기</button></div>' : '') + '</div>';
  }
  function calHTML() {
    var y = +CALM.slice(0, 4), mo = +CALM.slice(5, 7), first = new Date(y, mo - 1, 1), nd = new Date(y, mo, 0).getDate(), today = ymd();
    var mw = W.filter(function (w) { return w.date.slice(0, 7) === CALM; }), fw = mw.filter(wMatch), byD = {};
    (CALSEL ? mw : fw).forEach(function (w) { byD[w.date] = (byD[w.date] || 0) + 1; });
    var h = '<div class="card cal"><div class="calh"><button class="ib" id="calP">‹</button><b>' + y + '년 ' + mo + '월</b><button class="ib" id="calN">›</button></div><div class="calg">' +
      WD.map(function (d, i) { return '<span class="wd' + (i === 0 ? ' su' : i === 6 ? ' sa' : '') + '">' + d + '</span>'; }).join('');
    for (var k = 0; k < first.getDay(); k++) h += '<span></span>';
    for (var d = 1; d <= nd; d++) {
      var ds = CALM + '-' + pad(d), c = byD[ds] || 0;
      h += '<button class="cd' + (c ? ' has' : '') + (ds === today ? ' td' : '') + (!CALSEL && ds === CALD ? ' sel' : '') + (CALSEL && CALSEL[ds] ? ' pick' : '') + '" data-cd="' + ds + '"' + (c ? '' : ' disabled') + '>' + d + (c ? '<i>' + (c > 1 ? c : '') + '</i>' : '') + '</button>';
    }
    h += '</div>';
    /* 날짜 골라 지우기 (10/24 스티브) */
    if (CALSEL) {
      var pk = Object.keys(CALSEL), pn = W.filter(function (w) { return CALSEL[w.date]; }).length, md = Object.keys(byD), allOn = md.length && md.every(function (x) { return CALSEL[x]; });
      h += '<div class="delbar"><b>🗑 지울 날짜를 눌러 고르세요</b><small>' + (pk.length ? pk.length + '일 · ' + pn + '회 골랐어요 (다른 달도 함께 고를 수 있어요)' : '운동한 날(분홍)만 고를 수 있어요') + '</small>' +
        '<div class="g3"><button class="btn" id="delAll"' + (md.length ? '' : ' disabled') + '>' + (allOn ? '이달 빼기' : '이달 모두') + '</button><button class="btn" id="delX">취소</button><button class="btn rd" id="delGo"' + (pk.length ? '' : ' disabled') + '>🗑 지우기</button></div></div>';
    } else if (W.length) h += '<button class="btn sm w" id="delOn" style="margin-top:8px">🗑 날짜 골라 지우기</button>';
    if (CALUNDO && !CALSEL) h += '<div class="delbar ok"><b>🗑 방금 ' + CALUNDO.n + '일 · ' + CALUNDO.w.length + '회를 지웠어요</b><button class="btn" id="delUndo">↩ 되돌리기</button></div>';
    /* 거르기 */
    var used = {}; W.forEach(function (w) { w.items.forEach(function (it) { var e = EXM[it.ex]; if (e && it.sets.length) used[e.m] = 1; }); });
    h += '<div class="chips calf"><button class="chip' + (!CALF.m ? ' on' : '') + '" data-cf="">전체</button>' + D.MUS.filter(function (m) { return used[m[0]]; }).map(function (m) { return '<button class="chip' + (CALF.m === m[0] ? ' on' : '') + '" data-cf="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<input id="calQ" type="search" placeholder="🔍 운동 이름으로 거르기 (예: ㅂㅊ → 벤치)" value="' + esc(CALF.q) + '">';
    /* 이달 요약 */
    var sm = { d: Object.keys(byD).length, n: fw.length, sets: 0, kcal: 0, mus: {} };
    fw.forEach(function (w) { var o = wSum(w); sm.sets += o.sets; sm.kcal += o.kcal; Object.keys(o.mus).forEach(function (m) { sm.mus[m] = (sm.mus[m] || 0) + o.mus[m]; }); });
    h += '<div class="kpi" style="margin-top:10px"><div><b>' + sm.d + '일</b><small>운동한 날(' + sm.n + '회)</small></div><div><b>' + sm.sets + '</b><small>세트</small></div><div><b>' + sm.kcal.toLocaleString() + '</b><small>소모 kcal(추정)</small></div></div>';
    var mx = Math.max.apply(null, [1].concat(Object.keys(sm.mus).map(function (m) { return sm.mus[m]; })));
    if (sm.sets) h += '<div class="bars" style="margin-top:8px">' + D.MUS.filter(function (m) { return m[0] !== 'cardio'; }).map(function (m) {
      var x = sm.mus[m[0]] || 0; return '<div class="br"><span>' + m[1] + '</span><div class="tr"><i class="' + (x ? '' : 'lo') + '" style="width:' + (x / mx * 100) + '%"></i></div><em>' + x + '</em></div>';
    }).join('') + '</div><p class="note">이달 부위별 세트(주 부위 기준). 막대가 짧은 부위가 덜 한 부위예요.</p>';
    h += '</div>';
    /* 목록 */
    var list, ttl;
    if (CALD) { list = W.filter(function (w) { return w.date === CALD; }).filter(wMatch); ttl = mdw(CALD) + ' 운동 <button class="btn sm" id="calX">✕ 날짜 풀기</button>'; }
    else if (CALF.m || CALF.q) { list = fw.slice().reverse(); ttl = CALM.slice(5, 7).replace(/^0/, '') + '월 · 거른 결과 ' + list.length + '회'; }
    else { list = W.slice().reverse(); ttl = '최근 기록 <small>' + W.length + '회 · 날짜를 누르면 그날만</small>'; }
    var cut = !CALD && !CALF.m && !CALF.q && !OWALL ? 5 : 400;
    h += '<div class="h3">🗓 ' + ttl + '</div><div class="lst">' + (list.length ? list.slice(0, cut).map(owCard).join('') : '<p class="note">조건에 맞는 기록이 없어요.</p>') + '</div>';
    if (list.length > 5 && !CALD && !CALF.m && !CALF.q) h += '<button class="btn w" id="owAll" style="margin-bottom:10px">' + (OWALL ? '▲ 최근 5개만' : '▼ 전체 보기 (' + W.length + '회)') + '</button>';
    h += '<button class="btn w" id="csvOut" style="margin-bottom:12px">📊 엑셀(CSV)로 내보내기</button>';
    return h;
  }
  function bindCal(pg) {
    if (!$('calP')) return;
    function mv(n) { var y = +CALM.slice(0, 4), m = +CALM.slice(5, 7) - 1 + n; var d = new Date(y, m, 1); CALM = d.getFullYear() + '-' + pad(d.getMonth() + 1); CALD = ''; render(); }
    $('calP').onclick = function () { mv(-1); }; $('calN').onclick = function () { mv(1); };
    pg.querySelectorAll('[data-cd]').forEach(function (b) { b.onclick = function () {
      if (CALSEL) { var d = b.dataset.cd; if (CALSEL[d]) delete CALSEL[d]; else CALSEL[d] = 1; render(); return; }
      CALD = CALD === b.dataset.cd ? '' : b.dataset.cd; OWOPEN = ''; render(); }; });
    if ($('delOn')) $('delOn').onclick = function () { CALSEL = {}; CALD = ''; CALF = { m: '', q: '' }; CALUNDO = null; OWOPEN = ''; render(); };
    if ($('delX')) $('delX').onclick = function () { CALSEL = null; render(); };
    if ($('delAll')) $('delAll').onclick = function () {
      var md = {}; W.forEach(function (w) { if (w.date.slice(0, 7) === CALM) md[w.date] = 1; });
      var all = Object.keys(md).every(function (x) { return CALSEL[x]; });
      Object.keys(md).forEach(function (x) { if (all) delete CALSEL[x]; else CALSEL[x] = 1; }); render(); };
    if ($('delGo')) $('delGo').onclick = function () {
      var ds = Object.keys(CALSEL).sort(), gone = W.filter(function (w) { return CALSEL[w.date]; });
      if (!gone.length) return;
      if (!confirmBox(ds.length + '일 · ' + gone.length + '회 운동 기록을 지울까요?\n(' + ds.map(mdw).slice(0, 6).join(', ') + (ds.length > 6 ? ' 외 ' + (ds.length - 6) + '일' : '') + ')\n\n지운 뒤 바로 「↩ 되돌리기」로 살릴 수 있어요.')) return;
      W = W.filter(function (w) { return !CALSEL[w.date]; }); saveW();
      CALUNDO = { w: gone, n: ds.length }; CALSEL = null; vib(30); toast('🗑 ' + ds.length + '일 · ' + gone.length + '회 지웠어요'); render(); };
    if ($('delUndo')) $('delUndo').onclick = function () {
      if (!CALUNDO) return; var ids = {}; W.forEach(function (w) { ids[w.id] = 1; });
      W = W.concat(CALUNDO.w.filter(function (w) { return !ids[w.id]; })).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0); });
      saveW(); toast('↩ ' + CALUNDO.w.length + '회 되살렸어요'); CALUNDO = null; render(); };
    pg.querySelectorAll('[data-cf]').forEach(function (b) { b.onclick = function () { CALF.m = b.dataset.cf; render(); }; });
    var q = $('calQ'), tmr; q.oninput = function () { clearTimeout(tmr); tmr = setTimeout(function () { CALF.q = q.value.trim(); render(); var q2 = $('calQ'); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } }, 350); };
    if ($('calX')) $('calX').onclick = function () { CALD = ''; render(); };
    $('csvOut').onclick = exportCSV;
  }
  function bkBanner() {
    if (W.length < 3) return '';
    var last = S.lastBk || '', days = last ? Math.round((parseYmd(ymd()) - parseYmd(last)) / 864e5) : 999;
    if (days < 30 || S.bkSnooze === ymd()) return '';
    return '<div class="card bkb"><div class="h3">📦 백업할 때예요</div><p class="note" style="margin:4px 0 8px">' + (last ? '마지막 백업 ' + days + '일 전' : '아직 백업한 적이 없어요') + ' · 기록은 이 폰 안에만 있어서 폰을 바꾸거나 앱을 지우면 사라져요.</p><div class="g2"><button class="btn p" id="bkNow">📦 지금 백업</button><button class="btn" id="bkLater">오늘은 그만</button></div></div>';
  }
  function bindBk() {
    if ($('bkNow')) $('bkNow').onclick = function () { exportAll(); render(); };
    if ($('bkLater')) $('bkLater').onclick = function () { S.bkSnooze = ymd(); saveS(); render(); };
  }
  function saveText(name, txt, mime) {
    if (NATIVE && KKA.saveFile) { KKA.saveFile(name, txt); return; }
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('📤 ' + name + ' 저장'); } catch (e) { copyText(txt); }
  }
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    var rows = [['기록번호', '날짜', '요일', '운동시간(분)', '소모kcal(추정)', '부위', '운동', '기구', '세트', '무게', '단위', '무게(kg)', '횟수/분', '볼륨(kg)']];
    W.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start; }).forEach(function (w) {
      var o = wSum(w), d = parseYmd(w.date);
      w.items.forEach(function (it) {
        var e = EXM[it.ex]; if (!e) return;
        it.sets.forEach(function (st, k) {
          var kg = setKg(st, e);
          rows.push([wKey(w), w.date, WD[d.getDay()], o.min, o.kcal, MUSN[e.m], e.n, e.m === 'cardio' ? '유산소' : TYPEN[e.t], k + 1, e.m === 'cardio' ? '' : st.w, e.m === 'cardio' ? '' : (st.u || 'kg'), e.m === 'cardio' ? '' : r1(kg), st.r, e.m === 'cardio' ? '' : Math.round(kg * st.r)]);
        });
      });
    });
    saveText('마크삼식헬스_오운완_' + ymd().replace(/-/g, '') + '.csv', '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'), 'text/csv');
  }
  function renderHist() {
    var t = ymd(), from = addDays(t, -6), h = '';
    var ws = W.filter(function (w) { return w.date >= from; }), n = 0, v = 0;
    ws.forEach(function (w) { w.items.forEach(function (it) { var e = EXM[it.ex]; it.sets.forEach(function (s) { n++; v += setKg(s, e) * s.r; }); }); });
    if (CUR) {
      var cs = wSum(CUR);
      h += '<div class="card owc"><div class="h3">' + (CUR.date !== ymd() ? '⏰ ' + mdw(CUR.date) + ' 운동 (아직 저장 안 됨)' : '🏋️ 오늘 운동 중 · ' + elapsed()) + '</div><p class="note" style="margin:4px 0 8px">' + cs.sets + '세트 · ' + Object.keys(cs.mus).map(function (m) { return MUSN[m]; }).join('·') + (cs.cmin ? ' · 유산소 ' + cs.cmin + '분' : '') + '</p><button class="big" id="owBtn" style="justify-content:center"><i>🎉</i><div style="flex:none"><b>오운완 — 오늘 운동 저장</b></div></button></div>';
    }
    h += '<div class="card"><div class="h3">📅 최근 7일</div><div class="kpi" style="margin-top:8px"><div><b>' + Object.keys(ws.reduce(function (a, w) { a[w.date] = 1; return a; }, {})).length + '</b><small>운동한 날</small></div><div><b>' + n + '</b><small>세트</small></div><div><b>' + Math.round(v).toLocaleString() + '</b><small>볼륨 kg</small></div></div></div>';
    h += bkBanner();
    if (W.length) h += calHTML();
    var c = weekSets(from, t), mx = 20;
    h += '<div class="card"><div class="h3">💪 부위별 주간 세트 <small>근비대엔 부위당 주 10~20세트가 흔히 쓰이는 기준(🔶)</small></div><div class="bars" style="margin-top:8px">' +
      D.MUS.filter(function (m) { return m[0] !== 'cardio'; }).map(function (m) {
        var x = r1(c[m[0]]), cls = x < 6 ? 'lo' : x > 20 ? 'hi' : '';
        return '<div class="br"><span>' + m[1] + '</span><div class="tr"><i class="' + cls + '" style="width:' + Math.min(100, x / mx * 100) + '%"></i></div><em>' + x + '</em></div>';
      }).join('') + '</div><p class="note">보조 부위는 0.5세트로 셈해요 (예: 벤치프레스 1세트 = 가슴 1 + 삼두·어깨 0.5).</p></div>';
    h += '<div class="card"><div class="h3">🦍 킹콩 코치</div><div style="margin-top:8px">' + coachLines().map(function (l) { return '<div class="coach">' + esc(l) + '</div>'; }).join('') + '</div></div>';
    var done = {}; W.forEach(function (w) { w.items.forEach(function (it) { done[it.ex] = 1; }); });
    var ids = Object.keys(done).filter(function (x) { return EXM[x]; });
    if (ids.length) {
      if (!HX || !done[HX]) HX = ids[0];
      h += '<div class="card"><div class="h3">📈 운동별 성장</div><select id="hxSel" style="margin-top:8px">' + ids.map(function (x) { return '<option value="' + x + '"' + (x === HX ? ' selected' : '') + '>' + esc(EXM[x].n) + '</option>'; }).join('') + '</select><div id="hxBox"></div></div>';
    }
    h += '<div class="card"><div class="h3">🤖 내 AI에게 물어보기</div><p class="note">최근 2주 운동·식단 요약을 정리해서, 쓰고 있는 Claude·ChatGPT·Gemini 앱으로 보내요. 앱이 따로 서버로 보내는 건 없어요.</p><div class="g2" style="margin-top:8px"><button class="btn p" id="aiShare">📤 AI 앱으로 보내기</button><button class="btn" id="aiCopy">📋 복사</button></div></div>';
    $('pg').innerHTML = h;
    if ($('hxSel')) { $('hxSel').onchange = function () { HX = this.value; store.set('hx', HX); drawHx(); }; drawHx(); }
    $('aiShare').onclick = function () { shareText(aiSummary()); };
    $('aiCopy').onclick = function () { copyText(aiSummary()); };
    if ($('owBtn')) $('owBtn').onclick = endWorkout;
    bindCal($('pg')); bindBk();
    if ($('owAll')) $('owAll').onclick = function () { OWALL = !OWALL; render(); };
    function wById(id) { return W.filter(function (w) { return String(w.id) === id; })[0]; }
    $('pg').querySelectorAll('[data-ow]').forEach(function (b) { b.onclick = function () { OWOPEN = OWOPEN === b.dataset.ow ? '' : b.dataset.ow; render(); }; });
    $('pg').querySelectorAll('[data-owig]').forEach(function (b) { b.onclick = function () { cardSheet(wById(b.dataset.owig)); }; });
    $('pg').querySelectorAll('[data-owsh]').forEach(function (b) { b.onclick = function () { shareText(wShare(wById(b.dataset.owsh))); }; });
    $('pg').querySelectorAll('[data-owed]').forEach(function (b) { b.onclick = function () { owSheet(wById(b.dataset.owed), null); }; });
    $('pg').querySelectorAll('[data-owfix]').forEach(function (b) { b.onclick = function () { fixSheet(wById(b.dataset.owfix)); }; });
    $('pg').querySelectorAll('[data-dw]').forEach(function (b) { b.onclick = function () { if (confirmBox('이 운동 기록을 지울까요?')) { W = W.filter(function (w) { return String(w.id) !== b.dataset.dw; }); saveW(); render(); } }; });
  }
  function drawHx() {
    var e = EXM[HX], hs = history(HX), box = $('hxBox'); if (!box) return;
    var pts = hs.map(function (x) { var b = 0, top = null; x.sets.forEach(function (s) { var k = e1rm(setKg(s, e), s.r); if (k >= b) { b = k; top = s; } }); return { d: x.date, v: b, top: top }; });
    var h = '';
    if (e.t === 'bw' && !pts.some(function (p) { return p.v > 0; })) {
      var reps = hs.map(function (x) { return x.sets.reduce(function (a, s) { return a + s.r; }, 0); });
      h += '<p class="note">맨몸 운동은 총 횟수로 봐요: ' + reps.slice(-8).join(' → ') + '</p>';
    } else if (pts.length) {
      var vs = pts.map(function (p) { return p.v; }), mx = Math.max.apply(null, vs), mn = Math.min.apply(null, vs), W2 = 320, H2 = 140, P = 16;
      var xy = pts.map(function (p, i) { var x = pts.length === 1 ? W2 / 2 : P + i * (W2 - 2 * P) / (pts.length - 1); var y = mx === mn ? H2 / 2 : H2 - P - (p.v - mn) / (mx - mn) * (H2 - 2 * P); return [x, y]; });
      h += '<svg class="ch" viewBox="0 0 ' + W2 + ' ' + H2 + '"><polyline fill="none" stroke="#ff5fa2" stroke-width="3" points="' + xy.map(function (q) { return q.join(','); }).join(' ') + '"/>' + xy.map(function (q, i) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="4" fill="#ffb3d3"/>' + (i === xy.length - 1 || i === 0 ? '<text x="' + q[0] + '" y="' + (q[1] - 8) + '" fill="#ece8e4" font-size="11" text-anchor="middle">' + Math.round(pts[i].v) + '</text>' : ''); }).join('') + '</svg>';
      var last = pts[pts.length - 1];
      h += '<p class="note">추정 1RM(한 번 최대) <b style="color:#fff">' + Math.round(last.v) + 'kg</b> · 최고 ' + Math.round(mx) + 'kg · ' + pts.length + '번 기록. 추정치는 Epley 공식(무게×(1+횟수/30), 12회까지)으로 계산한 참고값이에요 🔶</p>';
    }
    var sg = suggest(HX); if (sg) h += '<div class="coach">' + esc(sg.t) + '</div>';
    box.innerHTML = h;
  }
  function aiSummary() {
    var t = ymd(), from = addDays(t, -13), out = ['[마크삼식 헬스 기록 요약 — ' + addDays(t, -13) + ' ~ ' + t + ']', ''];
    out.push('■ 운동');
    W.filter(function (w) { return w.date >= from; }).forEach(function (w) {
      out.push('- ' + w.date + ': ' + w.items.map(function (it) { var e = EXM[it.ex]; return e ? e.n + ' ' + it.sets.map(function (s) { return setTxt(s, e); }).join(', ') : ''; }).join(' / '));
    });
    var c = weekSets(addDays(t, -6), t);
    out.push('', '■ 최근 7일 부위별 세트: ' + D.MUS.filter(function (m) { return c[m[0]]; }).map(function (m) { return m[1] + ' ' + r1(c[m[0]]); }).join(', '));
    var fd = foodDays(14);
    if (fd.n) out.push('', '■ 식단(기록한 ' + fd.n + '일 평균): ' + Math.round(fd.k) + 'kcal · 단백질 ' + Math.round(fd.p) + 'g · 탄수 ' + Math.round(fd.c) + 'g · 지방 ' + Math.round(fd.f) + 'g');
    var bp = BP;
    if (bp) { var tg = bpTarget(); out.push('', '■ 바디프로필: 촬영 ' + bp.date + ' (D-' + daysBetween(t, bp.date) + ') · 현재 ' + (lastWeight() || bp.w) + 'kg · 목표 ' + (bp.goal || '-') + 'kg · 하루 목표 ' + tg.k + 'kcal'); }
    out.push('', '위 기록을 보고 ① 잘하고 있는 점 ② 부족한 부위·습관 ③ 다음 주 루틴과 식단을 구체적으로 제안해 줘. 나는 헬스장에서 운동하고 있어.');
    return out.join('\n');
  }
  function shareText(txt) {
    if (NATIVE && KKA.shareText) { KKA.shareText(txt); return; }
    if (navigator.share) { navigator.share({ text: txt }).catch(function () { }); return; }
    copyText(txt);
  }
  function copyText(txt) {
    try { navigator.clipboard.writeText(txt).then(function () { toast('복사했어요. AI 앱에 붙여 넣어 보세요.'); }, fallback); } catch (e) { fallback(); }
    function fallback() { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('복사했어요.'); } catch (e2) { toast('복사를 못 했어요.'); } ta.remove(); }
  }

  /* ───────── 🍱 식단 탭 ───────── */
  var FL = store.get('fl', {});        // { 'YYYY-MM-DD': { 아침:[{n,q,k,p,c,f}], ... } }
  var MYF = store.get('myf', []);      // 내 음식 [이름, 분량, kcal, p, c, f, '내 음식']
  var MEALS = store.get('meals', []);  // 자주 먹는 끼니 [{n, items:[...]}]
  var FD = ymd(), MEALK = ['아침', '점심', '저녁', '간식'];
  function saveFL() { store.set('fl', FL); }
  function allFoods() { return MYF.concat(D.FOOD); }
  function dayTot(d) { var o = { k: 0, p: 0, c: 0, f: 0 }; var x = FL[d]; if (!x) return o; MEALK.forEach(function (m) { (x[m] || []).forEach(function (i) { o.k += i.k; o.p += i.p; o.c += i.c; o.f += i.f; }); }); return o; }
  function foodDays(n) { var t = ymd(), s = { k: 0, p: 0, c: 0, f: 0, n: 0 }; for (var i = 0; i < n; i++) { var d = addDays(t, -i), o = dayTot(d); if (o.k > 0) { s.n++; s.k += o.k; s.p += o.p; s.c += o.c; s.f += o.f; } } if (s.n) { s.k /= s.n; s.p /= s.n; s.c /= s.n; s.f /= s.n; } return s; }
  function foodItem(f, q) { return { n: f[0], u: f[1], q: q, k: Math.round(f[2] * q), p: r1(f[3] * q), c: r1(f[4] * q), f: r1(f[5] * q) }; }
  function target() { if (BP) return bpTarget(); return S.kcal ? { k: S.kcal, p: Math.round(S.kcal * .3 / 4), c: Math.round(S.kcal * .45 / 4), f: Math.round(S.kcal * .25 / 9) } : null; }
  function renderFood() {
    var tot = dayTot(FD), tg = target(), h = '';
    h += '<div class="row" style="justify-content:space-between"><button class="btn sm" id="fdPrev">‹ 전날</button><b style="font-size:16px">' + mdw(FD) + (FD === ymd() ? ' 오늘' : '') + '</b><button class="btn sm" id="fdNext"' + (FD >= ymd() ? ' disabled' : '') + '>다음날 ›</button></div>';
    var pct = tg ? Math.min(1, tot.k / tg.k) : 0, C = 2 * Math.PI * 38;
    h += '<div class="card ring"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="38" stroke="#25282d" stroke-width="10" fill="none"/><circle cx="46" cy="46" r="38" stroke="' + (tg && tot.k > tg.k * 1.05 ? '#e0a53a' : '#ff5fa2') + '" stroke-width="10" fill="none" stroke-dasharray="' + (C * pct) + ' ' + C + '" transform="rotate(-90 46 46)" stroke-linecap="round"/><text x="46" y="44" fill="#fff" font-size="17" font-weight="900" text-anchor="middle">' + Math.round(tot.k) + '</text><text x="46" y="60" fill="#a0a4ab" font-size="10" text-anchor="middle">' + (tg ? '/ ' + tg.k + 'kcal' : 'kcal') + '</text></svg><div class="bars" style="flex:1">' +
      [['단백질', 'p', '#ff5fa2'], ['탄수', 'c', '#5b8fd9'], ['지방', 'f', '#e0a53a']].map(function (m) {
        var g = tg ? tg[m[1]] : 0, v = tot[m[1]];
        return '<div class="br" style="grid-template-columns:44px 1fr 66px"><span>' + m[0] + '</span><div class="tr"><i style="background:' + m[2] + ';width:' + (g ? Math.min(100, v / g * 100) : 0) + '%"></i></div><em>' + Math.round(v) + (g ? '/' + g : '') + 'g</em></div>';
      }).join('') + '</div></div>';
    if (!tg) h += '<p class="note">🎯 목표가 아직 없어요. 📸 바프 탭에서 플랜을 만들면 칼로리·탄단지 목표가 자동으로 잡혀요.</p>';
    var day = FL[FD] || {};
    h += MEALK.map(function (m) {
      var its = day[m] || [], k = its.reduce(function (a, i) { return a + i.k; }, 0);
      return '<div class="card meal"><div class="h3">' + { '아침': '🌅', '점심': '☀️', '저녁': '🌙', '간식': '🍌' }[m] + ' ' + m + ' <small>' + k + 'kcal</small><span style="flex:1"></span>' + (its.length ? '<button class="btn sm" data-svm="' + m + '">⭐ 끼니 저장</button>' : '') + '<button class="btn sm p" data-addf="' + m + '">＋</button></div>' +
        its.map(function (i, j) { return '<div class="fd"><div>' + esc(i.n) + ' <small>' + esc(i.u) + (i.q !== 1 ? ' ×' + i.q : '') + ' · ' + i.k + 'kcal · 단' + i.p + ' 탄' + i.c + ' 지' + i.f + '</small></div><button data-dlf="' + m + '|' + j + '">✕</button></div>'; }).join('') + '</div>';
    }).join('');
    h += '<p class="note">📚 음식 영양 정보 출처: 농촌진흥청 국가표준식품성분 DB 10.4 · 식품의약품안전처 식품영양성분 데이터베이스(K-FCDB). 분량에 맞춰 100g당 값을 환산했고, 공식 DB에 없는 음식은 「🔶추정」으로 표시했어요. 실제 값은 식당·제품·조리법마다 달라요. 자주 먹는 제품은 「＋ › 내 음식 만들기」로 포장지 성분표 값을 넣어 두면 정확해져요.</p>';
    $('pg').innerHTML = h;
    $('fdPrev').onclick = function () { FD = addDays(FD, -1); render(); };
    $('fdNext').onclick = function () { if (FD < ymd()) { FD = addDays(FD, 1); render(); } };
    $('pg').querySelectorAll('[data-addf]').forEach(function (b) { b.onclick = function () { openFoodPick(b.dataset.addf); }; });
    $('pg').querySelectorAll('[data-dlf]').forEach(function (b) { b.onclick = function () { var a = b.dataset.dlf.split('|'); FL[FD][a[0]].splice(+a[1], 1); saveFL(); render(); }; });
    $('pg').querySelectorAll('[data-svm]').forEach(function (b) { b.onclick = function () {
      var m = b.dataset.svm, its = (FL[FD] || {})[m] || [];
      var nm = prompt2('끼니 이름', its.slice(0, 2).map(function (i) { return i.n; }).join('+'));
      if (nm == null) return; MEALS.push({ n: nm || '내 끼니', items: JSON.parse(JSON.stringify(its)) }); store.set('meals', MEALS); toast('⭐ 「' + (nm || '내 끼니') + '」 저장! 다음엔 탭 한 번이에요.');
    }; });
  }
  function prompt2(m, d) { try { return window.prompt(m, d); } catch (e) { return d; } }
  function addFood(meal, item) { FL[FD] = FL[FD] || {}; FL[FD][meal] = FL[FD][meal] || []; FL[FD][meal].push(item); saveFL(); }
  var FPK = { q: '', cat: '' };
  var FCAT = ['내 음식', '단백질', '고기', '탄수', '한식', '분식', '중식·양식', '치킨', '편의점', '과일', '채소', '지방', '간식', '음료'];
  var FICO = { '단백질': '🍗', '고기': '🥩', '탄수': '🍚', '한식': '🍲', '분식': '🍢', '중식·양식': '🍝', '치킨': '🍗', '편의점': '🏪', '과일': '🍎', '채소': '🥦', '지방': '🥜', '간식': '🍪', '음료': '🥤', '내 음식': '⭐' };
  var FSRC = { N: '농진청', M: '식약처', E: '🔶추정' };
  function srcTag(f) { var t = f[6] === '내 음식' ? '' : FSRC[f[7]]; return t ? ' · <span class="fsrc' + (f[7] === 'E' ? ' est' : '') + '">' + t + '</span>' : ''; }
  function fcatI(c) { var i = FCAT.indexOf(c); return i < 0 ? 99 : i; }
  function openFoodPick(meal) {
    FPK.q = ''; FPK.cat = '';
    var cats = []; allFoods().forEach(function (f) { if (cats.indexOf(f[6]) < 0) cats.push(f[6]); }); cats.sort(function (a, b) { return fcatI(a) - fcatI(b); });
    sheet('<div class="sh"><b>' + meal + ' 추가</b><button class="ib" id="fpX">✕</button></div>' +
      (MEALS.length ? '<div class="h3">⭐ 자주 먹는 끼니</div><div class="chips">' + MEALS.map(function (m, i) { return '<button class="chip on" data-ml="' + i + '">' + esc(m.n) + ' · ' + m.items.reduce(function (a, x) { return a + x.k; }, 0) + 'kcal</button>'; }).join('') + '</div>' : '') +
      '<input id="fpQ" placeholder="🔍 음식 찾기 (초성도 돼요)"><div class="chips"><button class="chip on" data-fc="">전체</button>' + cats.map(function (c) { return '<button class="chip" data-fc="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="lst" id="fpList"></div><button class="btn sm" id="fpNew">＋ 내 음식 만들기 (성분표 보고 입력)</button>', function (sb) {
      sb.querySelector('#fpX').onclick = closeSheet;
      sb.querySelector('#fpQ').oninput = function () { FPK.q = this.value; if (FPK.q.trim() && FPK.cat) { FPK.cat = ''; sb.querySelectorAll('[data-fc]').forEach(function (x) { x.classList.toggle('on', !x.dataset.fc); }); } drawFood(meal); };
      sb.querySelectorAll('[data-fc]').forEach(function (b) { b.onclick = function () { FPK.cat = b.dataset.fc; sb.querySelectorAll('[data-fc]').forEach(function (x) { x.classList.toggle('on', x === b); }); drawFood(meal); }; });
      sb.querySelectorAll('[data-ml]').forEach(function (b) { b.onclick = function () { MEALS[+b.dataset.ml].items.forEach(function (i) { addFood(meal, JSON.parse(JSON.stringify(i))); }); closeSheet(); render(); toast('⭐ 끼니를 한 번에 담았어요'); }; });
      sb.querySelector('#fpNew').onclick = function () { newFoodSheet(meal); };
      drawFood(meal);
    });
  }
  function drawFood(meal) {
    var el = $('fpList'); if (!el) return;
    var q = FPK.q.replace(/\s/g, '');
    var l = allFoods().filter(function (f) { if (!q && FPK.cat && f[6] !== FPK.cat) return false; if (!q) return true; var nm = f[0].replace(/\s/g, ''); return nm.indexOf(q) >= 0 || (isCho(q) && cho(nm).indexOf(q) >= 0); });
    if (!FPK.cat) l = l.map(function (f, i) { return [f, i]; }).sort(function (a, b) { return fcatI(a[0][6]) - fcatI(b[0][6]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    el.innerHTML = l.map(function (f, i) { return '<button class="it" data-fi="' + allFoods().indexOf(f) + '"><span class="ic">' + (FICO[f[6]] || '🍽') + '</span><div><b>' + esc(f[0]) + '</b><small>' + esc(f[1]) + ' · ' + f[2] + 'kcal · 단' + f[3] + ' 탄' + f[4] + ' 지' + f[5] + srcTag(f) + '</small></div><span class="go">＋</span></button>'; }).join('') || '<p class="note">없어요. 「내 음식 만들기」로 추가해요.</p>';
    el.querySelectorAll('[data-fi]').forEach(function (b) { b.onclick = function () { qtySheet(meal, allFoods()[+b.dataset.fi]); }; });
  }
  function qtySheet(meal, f) {
    var q = 1;
    sheet('<div class="sh"><b>' + esc(f[0]) + '</b></div><div class="wsub">' + esc(f[1]) + ' 기준 ' + f[2] + 'kcal' + srcTag(f) + '</div><div class="chips" style="justify-content:center">' + [0.5, 1, 1.5, 2, 3].map(function (x) { return '<button class="chip' + (x === 1 ? ' on' : '') + '" data-q="' + x + '">×' + x + '</button>'; }).join('') + '</div><div class="wbig" id="qK">' + f[2] + '<small>kcal</small></div><button class="btn p w" id="qOk">' + meal + '에 담기</button>', function (sb) {
      sb.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { q = +b.dataset.q; sb.querySelectorAll('[data-q]').forEach(function (x) { x.classList.toggle('on', x === b); }); sb.querySelector('#qK').innerHTML = Math.round(f[2] * q) + '<small>kcal</small>'; }; });
      sb.querySelector('#qOk').onclick = function () { addFood(meal, foodItem(f, q)); closeSheet(); render(); toast('🍱 ' + f[0] + ' 담았어요'); };
    });
  }
  function newFoodSheet(meal) {
    sheet('<div class="sh"><b>내 음식 만들기</b></div><p class="note">포장지 영양성분표의 1회 제공량 값을 넣어요.</p><input id="nfN" placeholder="이름 (예: ○○ 닭가슴살 스테이크)"><input id="nfU" placeholder="분량 (예: 1팩 100g)"><div class="g2"><input id="nfK" inputmode="decimal" placeholder="칼로리 kcal"><input id="nfP" inputmode="decimal" placeholder="단백질 g"><input id="nfC" inputmode="decimal" placeholder="탄수 g"><input id="nfF" inputmode="decimal" placeholder="지방 g"></div><button class="btn p w" id="nfOk">저장하고 담기</button>', function (sb) {
      sb.querySelector('#nfOk').onclick = function () {
        var g = function (id) { return parseFloat(sb.querySelector(id).value) || 0; }, n = sb.querySelector('#nfN').value.trim();
        if (!n || !g('#nfK')) { toast('이름과 칼로리는 꼭 넣어 주세요'); return; }
        var f = [n, sb.querySelector('#nfU').value.trim() || '1회', g('#nfK'), g('#nfP'), g('#nfC'), g('#nfF'), '내 음식'];
        MYF.unshift(f); store.set('myf', MYF); addFood(meal, foodItem(f, 1)); closeSheet(); render(); toast('⭐ 내 음식에 저장했어요');
      };
    });
  }


  /* ───────── 📊 인바디 탭 ───────── */
  var IB = store.get('ib', []);   /* [{d, w, smm, bfm, pbf, bmi, bmr, vfl, sc, tbw, ra, la, tr, rl, ll}] */
  var IBF = [
    ['w', '체중', 'kg', [/(?<![정표])체\s*중(?!\s*조\s*절)/, /Weight(?!\s*Control)/i], 25, 300],
    ['smm', '골격근량', 'kg', [/골\s*격\s*근\s*량/, /Skeletal\s*Muscle\s*Mass/i, /\bSMM\b/], 5, 90],
    ['bfm', '체지방량', 'kg', [/체\s*지\s*방\s*량/, /Body\s*Fat\s*Mass/i], 1, 150],
    ['pbf', '체지방률', '%', [/체\s*지\s*방\s*률/, /P[a-z]{2,4}ent\s*Body\s*Fat/i, /\bPBF\b/], 2, 70],
    ['bmi', 'BMI', '', [/\bBMI\b/i, /신체\s*질량\s*지수/, /Body\s*Mass\s*Index/i], 12, 60],
    ['bmr', '기초대사량', 'kcal', [/기\s*초\s*대\s*사\s*량/, /Basal\s*Metabolic\s*Rate/i, /\bBMR\b/], 700, 4500],
    ['vfl', '내장지방 레벨', '', [/내\s*장\s*지\s*방\s*레\s*벨/, /Visceral\s*Fat\s*Level/i], 1, 30],
    ['sc', '인바디 점수', '점', [/인\s*바\s*디\s*점\s*수/, /InBody\s*Score/i], 30, 120],
    ['tbw', '체수분', 'L', [/체\s*수\s*분\s*\(?\s*L\s*\)?/, /Total\s*Body\s*Water/i, /체\s*수\s*분(?!\s*,)/, /이루고\s*있는\s*물/], 10, 90],
    ['lbm', '제지방량', 'kg', [/제\s*지\s*방\s*량/, /Fat\s*Free\s*Mass/i], 20, 150]
  ];
  var IBSEG = [['ra', '오른팔'], ['la', '왼팔'], ['tr', '몸통'], ['rl', '오른다리'], ['ll', '왼다리']];
  function saveIB() { IBSEL = null; IB.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }); store.set('ib', IB); }
  function ibRecent(days) { var x = IB[IB.length - 1]; if (!x) return null; return daysBetween(x.d, ymd()) <= days ? x : null; }
  function parseInbody(text) {
    /* 결과지 글자(OCR) → 숫자. 원칙: 이름 뒤 같은 줄(+다음 줄)의 첫 「그럴듯한」 숫자.
       막대그래프 눈금 줄(숫자 4개 이상 … %)은 % 뒤 숫자만 본다. 괄호 속 표준범위·a~b는 버린다.
       마지막에 체중·키·체지방량으로 BMI·체지방률을 검산해 틀리면 계산값으로 바꾼다. */
    var t = String(text || '').replace(/\r/g, '').replace(/,(?=\d{3}\b)/g, '').replace(/[|]/g, ' ').replace(/(\d)\s*[.·]\s*(\d)/g, '$1.$2'), out = {}, got = [], fixed = [];
    var raw = t;
    /* 32차: ACCUNIQ(셀바스) 결과지 — 주요 수치가 왼쪽 아래 「신체변화 누적그래프」에 있음. 이 양식은 따로 읽음 */
    var ACC = /ACCUN|BC\s*7\d0|누\s*적\s*그\s*래\s*프|S[EB]LVA|8ELVA|종\s*합\s*평\s*점/i.test(t), ht = null;   /* 34차: 「ACCUNIA」처럼 끝 글자가 틀려도 */
    /* 33차: ACCUNIQ 첫째 장(체성분 분석·골격근/지방분석·부위별 근육 분석) — 막대 끝 숫자. 막대 끝 표시가 「1」로 읽혀 붙는 일(130.9→30.9)·소수점 빠짐(947→94.7) 보정 */
    var ACC1 = ACC && !/누\s*적\s*그\s*래\s*프/.test(t) && /골\s*격\s*근\s*\/\s*지\s*방|부\s*위\s*별\s*근\s*육\s*분\s*석|종\s*합\s*평\s*점/.test(t);
    if (ACC1) (function () {
      var L = t.split('\n');
      function put(k, v) { if (v != null && out[k] == null) { out[k] = v; got.push(k); } }
      function fix1(x, lo, hi, dec) {   /* 범위 밖이면 앞자리 「1」 떼기 · 소수점 빠진 정수면 /10 */
        if (x >= lo && x <= hi) return x;
        var s = String(x); if (s.charAt(0) === '1' && s.length > 2) { var y = parseFloat(s.slice(1)); if (y >= lo && y <= hi) return y; }
        if (dec && s.indexOf('.') < 0) { var z = x / 10; if (z >= lo && z <= hi) return z; }
        return null;
      }
      function lab(re, k, lo, hi, dec) {
        for (var i = 0; i < L.length && out[k] == null; i++) {
          var m = L[i].match(re); if (!m) continue;
          var rest = L[i].slice(m.index + m[0].length), scale = (L[i].match(/\d+(?:\.\d+)?/g) || []).length >= 5;
          var n = scale ? null : rest.match(/^[^\d\n\-+]{0,3}(\d+(?:\.\d+)?)/);
          if (n) { put(k, fix1(parseFloat(n[1]), lo, hi, dec)); continue; }
          /* 34차: 이름만 있는 줄(또는 눈금 줄)이면 아래 3줄에서 「숫자 하나(+단위)만 있는 줄」 — 사진에 따라 숫자가 이름 아랫줄로 떨어짐 */
          if (/[가-힣]/.test(rest) && !scale) continue;
          for (var q = i + 1; q <= i + 3 && q < L.length; q++) {
            var mm = L[q].match(/^\s*(?:kg\/m²?|kg|%)?\s*(\d+(?:\.\d+)?)\s*(?:kg|kg\/m²?|%|cm)?\s*$/i);
            if (mm) { var v = fix1(parseFloat(mm[1]), lo, hi, dec); if (v != null) { put(k, v); break; } }
          }
        }
      }
      var g = t.search(/골\s*격\s*근\s*\/\s*지\s*방/), gi = g < 0 ? 0 : t.slice(0, g).split('\n').length - 1;
      var L0 = L; L = L0.slice(gi);
      lab(/체\s*중(?!\s*조)/, 'w', 25, 300, 1); lab(/골\s*격\s*근\s*량/, 'smm', 5, 90, 1); lab(/체\s*지\s*방\s*량/, 'bfm', 1, 150, 1);
      lab(/BMI(?!\s*:)/, 'bmi', 12, 60, 1); lab(/[체제]\s*지\s*방\s*률/, 'pbf', 2, 70, 1);
      L = L0;
      if (out.w >= 100 && String(out.w).charAt(0) === '1') { var w2 = String(out.w).slice(1); if (new RegExp('(^|[^\\d.])' + w2.replace('.', '\\.') + '(?![\\d])').test(t.replace(String(out.w), ''))) out.w = parseFloat(w2); }   /* 36차: 막대 끝 「1」이 붙은 194.7 — 다른 곳에 94.7이 있으면 */
      lab(/종\s*합\s*평\s*점/, 'sc', 30, 120, 0);
      /* 기초대사량: 「복부비만 예측도」 맨 아래 줄 = 지금 나이 줄(나이 · 면적 · BMR) → 없으면 이름 앞뒤 줄의 네 자리 */
      var age = (t.match(/연\s*령\s*[:：]?\s*(\d{2})/) || [])[1];
      if (age) L.some(function (ln, li) { var m = ln.match(new RegExp('^\\s*' + age + '\\s+\\d{2,3}\\s+(\\d{4})\\s*$')) || (new RegExp('^\\s*' + age + '\\s+\\d{2,3}\\s*$').test(ln) && (L[li + 1] || '').match(/^\s*(\d{4})\s*$/)); if (m && +m[1] >= 700 && +m[1] <= 4500) { put('bmr', +m[1]); return true; } return false; });
      if (out.bmr == null) for (var i = 0; i < L.length; i++) if (/기\s*초\s*대\s*사\s*량/.test(L[i])) { [i, i - 1, i + 1].some(function (j) { var m = (L[j] || '').match(/(?:^|\D)(\d{4})(?!\d)/); if (m && +m[1] >= 700 && +m[1] <= 4500) { put('bmr', +m[1]); return true; } return false; }); break; }
      /* 내장지방레벨: 같은 줄 → 바로 윗줄 숫자만 있는 줄 → 같은 줄 앞자리 1 떼기 */
      for (var i = 0; i < L.length; i++) if (/내\s*장\s*지\s*방\s*레\s*벨/.test(L[i])) {
        var rest = L[i].replace(/^.*?레\s*벨/, ''), ns = rest.match(/\d+/g) || [];
        var v = null; ns.some(function (x) { if (x.length <= 2 && +x >= 1 && +x <= 30) { v = +x; return true; } return false; });
        if (v == null && /^\s*\d{1,2}\s*$/.test(L[i - 1] || '') && +L[i - 1] >= 1 && +L[i - 1] <= 30) v = +L[i - 1];
        if (v == null && /^\s*\d{1,3}\s*$/.test(L[i + 1] || '')) v = fix1(+L[i + 1], 1, 30, 0);   /* 아랫줄 「110」(막대 끝 1 + 10) */
        if (v == null && ns[0]) v = fix1(+ns[0], 1, 30, 0);
        put('vfl', v); break;
      }
      /* 체수분 = 세포내수분 + 세포외수분(각 이름 아래 4줄 안의 소수만 있는 줄) */
      function after(re) { for (var i = 0; i < L.length; i++) if (re.test(L[i])) { for (var q = i + 1; q <= i + 6 && q < L.length; q++) { var m = L[q].match(/^\s*(\d{1,2}\.\d)\s*$/); if (m) return parseFloat(m[1]); } return null; } return null; }
      var icw = after(/세\s*포\s*내\s*수\s*분(?!\s*비)/), ecw = after(/세\s*포\s*외\s*수\s*분(?!\s*비)/);
      if (icw && ecw) put('tbw', Math.round((icw + ecw) * 10) / 10);
      /* 부위별 근육량: 「4.09 0.379」처럼 근육량 + 세포외수분비가 붙은 줄을 위에서부터 오른팔·왼팔·몸통·오른다리·왼다리 */
      var sg = [], si = t.search(/부\s*위\s*별\s*근\s*육/);
      if (si >= 0) t.slice(si).split('\n').forEach(function (ln) { var m = ln.match(/^\s*(\d{1,2}\.\d{2})\s+0\.\d{3}\b/); if (m && sg.length < 5) sg.push(parseFloat(m[1])); });
      /* 34차: 부위 이름 줄부터 3줄 안의 「소수 둘째 자리 숫자」(0.xxx 세포외수분비 제외) — 줄이 흩어진 사진용 */
      if (!(sg.length === 5 && sg[2] > sg[0] && sg[2] > sg[3]) && si >= 0) {
        var SL = t.slice(si).split('\n'), en = SL.findIndex(function (x) { return /체\s*수\s*분\s*분\s*석/.test(x); }); if (en > 0) SL = SL.slice(0, en);
        sg = [/^\s*오\s*른\s*팔/, /^\s*[왼윈]\s*팔/, /^\s*몸\s*[통동]/, /^\s*오\s*른\s*다\s*리/, /^\s*[왼윈환]\s*다\s*리/].map(function (re) {
          var i = SL.findIndex(function (x) { return re.test(x); }); if (i < 0) return null;
          for (var q = i; q <= i + 3 && q < SL.length; q++) { var ms = SL[q].match(/(?:^|[^\d.])(\d{1,2}\.\d{2})(?![\d°])/g) || []; for (var z = 0; z < ms.length; z++) { var x = parseFloat(ms[z].replace(/^[^\d]/, '')); if (x >= 1) return x; } }
          return null;
        });
      }
      if (sg.length === 5 && sg.every(function (x) { return x != null; }) && sg[2] > sg[0] && sg[2] > sg[3]) IBSEG.forEach(function (x, k) { out[x[0]] = sg[k]; });
      var hm2 = t.match(/신\s*장\s*[:：]?\s*(1[3-9]\d|2[0-2]\d)\s*[.,]?\s*(\d)?/); if (hm2) ht = parseFloat(hm2[1] + '.' + (hm2[2] || '0'));
    })();
    if (ACC && !ACC1) (function () {
      var a = t.search(/누\s*적\s*그\s*래\s*프/), L = (a >= 0 ? t.slice(a) : t).split('\n');
      var LAB = [['w', /^\s*체\s*중/, 25, 300], ['smm', /^\s*골\s*격\s*근\s*량/, 5, 90], ['bfm', /^\s*체\s*지\s*방\s*량/, 1, 150], ['pbf', /^\s*체\s*지\s*방\s*률/, 2, 70], ['bmi', /^\s*BMI(?!\s*:)/i, 12, 60], ['_x', /^\s*(복\s*부\s*비\s*만|세\s*포\s*외|측\s*정\s*일)/]];
      function labAt(ln) { for (var j = 0; j < LAB.length; j++) if (LAB[j][1].test(ln)) return j; return -1; }
      for (var i = 0; i < L.length; i++) {
        var j = labAt(L[i]); if (j < 0 || LAB[j][0] === '_x') continue;
        var f = LAB[j], v = null;
        for (var q = i + 1; q < L.length && q <= i + 4 && v == null; q++) {   /* 이름 다음 줄들 중 「소수로 시작하는 줄」 — 여러 번 측정이면 맨 오른쪽(최근) */
          if (labAt(L[q]) >= 0) break;
          var m = L[q].match(/^\s*((?:\d+\.\d+\s+)*\d+\.\d+)(?!\d)/); if (!m) continue;
          var ns = m[1].trim().split(/\s+/), x = parseFloat(ns[ns.length - 1]);
          if (x >= f[2] && x <= f[3]) v = x;
        }
        if (v != null && out[f[0]] == null) { out[f[0]] = v; got.push(f[0]); }
      }
      var hm2 = t.match(/신\s*장\s*[:：]?\s*(1[3-9]\d|2[0-2]\d)\s*[.,]?\s*(\d)?/); if (hm2) ht = parseFloat(hm2[1] + '.' + (hm2[2] || '0'));
      var dd = (a >= 0 ? t.slice(a) : '').match(/측\s*정\s*일[^\n]*/); if (dd) { var ds = dd[0].match(/20\d{2}\s*[.\-\/]\s*\d{1,2}\s*[.\-\/]\s*\d{1,2}/g); if (ds) out._accD = ds[ds.length - 1]; }
    })();
    /* 30차: 지난 측정 기록(신체변화) 표는 읽지 않음 — 그 줄부터 오른쪽 칸 항목(점수·적정체중·연구항목 등)이 다시 나오기 전까지(최대 14줄)만 지움 */
    if (!ACC) (function () {
      var L = t.split('\n'), st = -1;
      for (var i = 0; i < L.length; i++) if (/신\s*체\s*변\s*화|Body\s*Comp\w*\s*History/i.test(L[i])) { st = i; break; }
      if (st < 0) return;
      var en = Math.min(L.length, st + 14);
      for (var j = st + 1; j < en; j++) if (/인\s*바\s*디\s*점\s*수|적\s*정\s*체\s*중|체\s*중\s*조\s*절|연\s*구\s*항\s*목|제\s*지\s*방\s*량|기\s*초\s*대\s*사|내\s*장\s*지\s*방|임\s*피\s*던\s*스/.test(L[j])) { en = j; break; }
      L.splice(st, en - st); t = L.join('\n');
    })();
    var scm = ACC ? null : t.match(/(?:^|[^\d.])(\d{2,3})\s*\/\s*1\s*0\s*0/) || t.match(/(?:^|[^\d.])(\d{2,3})100\s*점/); if (scm && +scm[1] >= 30 && +scm[1] <= 120) out.sc = +scm[1];   /* 인바디 점수 = 「83/100점」 */
    /* 31차: 영어 이름 바로 옆(같은 줄)에 숫자가 있으면 그 값이 가장 확실 — BMI·체지방률은 먼저 이걸로 */
    var em = t.match(/Body\s*Mass\s*Index[^\n\d]*(\d{2}\.\d)/i); if (em && +em[1] >= 12 && +em[1] <= 60) out.bmi = +em[1];
    em = t.match(/P[a-z]{2,4}ent\s*B[a-z]{2,4}\s*Fat[^\n\d]*(\d{1,2})\s*[.,]\s*(\d)(?!\d)/i); if (em) { var pv = +(em[1] + '.' + em[2]); if (pv >= 2 && pv <= 70) out.pbf = pv; }   /* 38차: 「Bocdy」·「24,7」 */
    function tailOf(idx) {
      var rest = t.slice(idx), nl = rest.indexOf('\n'), lines = rest.split('\n'), seg = lines[0], n = 0;
      for (var q = 1; q < lines.length && n < 2; q++) { if (lines[q].trim()) { seg += '\n' + lines[q]; n++; } }
      seg = seg.slice(0, 200);
      seg = seg.replace(/\([^)]*\)/g, ' ').replace(/\(\s*[\d.\s~∼\-_]+$/, ' ').replace(/\d+(\.\d+)?\s*[~∼]\s*\d+(\.\d+)?/g, ' ').replace(/\b\d{2,4}\s*-\s*\d{2,4}\b/g, ' ');
      var line = nl < 0 ? seg : seg.slice(0, nl), nums = line.match(/\d+(?:\.\d+)?/g) || [];
      if (nums.length >= 4 && line.indexOf('%') >= 0) seg = seg.slice(line.lastIndexOf('%') + 1);   /* 막대 눈금 줄 */
      return seg;
    }
    if (!ACC) IBF.forEach(function (f) {
      for (var i = 0; i < f[3].length && out[f[0]] == null; i++) {
        var re = new RegExp(f[3][i].source, f[3][i].flags.replace('g', '') + 'g'), m;
        while ((m = re.exec(t)) && out[f[0]] == null) {
          var seg = tailOf(m.index + m[0].length);
          if (f[0] === 'vfl') { var hi = seg.search(/높\s*음/); if (hi >= 0) seg = seg.slice(hi + 2); else seg = seg.replace(/낮\s*음\s*\d+/, ' '); }
          /* 30차: 같은 줄에서 먼저 찾고, 없을 때만 다음 줄(다른 줄의 숫자를 훔쳐 오지 않게) */
          seg.split('\n').some(function (ln, li) {
            if (li > 0) { var nn = ln.match(/\d+(?:\.\d+)?/g) || []; if (nn.length >= 6) return false; }   /* 다음 줄이 눈금 줄(숫자 6개 이상)이면 건너뜀 */
            var nums = f[0] === 'sc' ? (ln.match(/\d+(?:\.\d+)?/g) || []) : (ln.replace(/\d+\s*\/\s*1\s*0\s*0\s*점?|\d+\s*점/g, ' ').match(/\d+(?:\.\d+)?/g) || []);   /* 38차: 「물 83/100점」의 점수를 체수분으로 집지 않게 */
            for (var k = 0; k < nums.length; k++) { var v = parseFloat(nums[k]); if (v >= f[4] && v <= f[5]) { out[f[0]] = v; return true; } }
            return false;
          });
        }
      }
      if (out[f[0]] != null) got.push(f[0]);
    });
    /* 31차: 「체성분분석」 표는 위→아래 순서가 체수분·단백질·무기질·체지방량. 사진이 기울면 숫자가 이름보다 윗줄에 붙으므로,
       이름 대신 「숫자 (표준범위)」 순서로 네 값을 뽑고 서로 비율로 검산. 통과하면 이름으로 읽은 값보다 우선 */
    var ST = null;
    (function () {
      var a = ACC ? -1 : t.search(/체\s*성\s*분\s*분\s*석|Body\s*Comp\w*\s*Anal/i); if (a < 0) return;
      var blk = t.slice(a), e = blk.search(/골\s*격\s*근\s*[·ㆍ\-]?\s*지\s*방\s*분\s*석|Muscle\s*[\-·]?\s*Fat\s*Anal/i); blk = blk.slice(0, e > 0 ? e : 1200);
      var re = /(\d+\.\d+)\s*\(\s*[_\-~.,'\s]*\d+(?:\.\d+)?\s*[~∼\-\s]\s*\d+(?:\.\d+)?\s*\)/g, m, v = [];
      while ((m = re.exec(blk)) && v.length < 4) v.push(parseFloat(m[1]));
      if (v.length < 4) return;
      var tw = v[0], pr = v[1], mi = v[2], fm = v[3];
      if (!(tw >= 10 && tw <= 90 && pr >= 3 && pr <= 40 && mi >= 1 && mi <= 10 && fm >= 1 && fm <= 150)) return;
      if (!(pr / tw >= 0.18 && pr / tw <= 0.4 && mi / pr >= 0.2 && mi / pr <= 0.5)) return;
      var sum = tw + pr + mi + fm; if (sum < 25 || sum > 300) return;
      if (fm > tw * 1.2) return;   /* 체지방량이 체수분보다 훨씬 크면 다른 칸(체중)을 집은 것 */
      var pw = null, ns = blk.match(/\d+\.\d/g) || [];   /* 결과지에 찍힌 체중 숫자(합과 ±0.15) */
      for (var i = 0; i < ns.length; i++) { var x = parseFloat(ns[i]); if (Math.abs(x - sum) <= 0.15) { pw = x; break; } }
      ST = { tbw: tw, prot: pr, mine: mi, bfm: fm, w: pw != null ? pw : Math.round(sum * 10) / 10, wPrinted: pw != null };
    })();
    if (ST) {
      ['tbw', 'bfm'].forEach(function (k) { out[k] = ST[k]; if (got.indexOf(k) < 0) got.push(k); });
      out.w = ST.w; if (ST.wPrinted) { if (got.indexOf('w') < 0) got.push('w'); } else fixed.push('w');
    }
    if (!ht) { var hm = t.match(/(1[3-9]\d|2[0-2]\d)(?:\.\d)?\s*cm/i); ht = hm ? parseFloat(hm[0]) : null; } if (ht) out._h = ht;
    function drop(k) { delete out[k]; var gi = got.indexOf(k); if (gi >= 0) got.splice(gi, 1); }
    /* 30차: 체중 = 체수분 + 단백질 + 무기질 + 체지방량(결과지 「모두 합하면 체중」). 네 값이 다 읽히면 그 합으로 체중을 검산 */
    function firstNum(re, lo, hi, dec) { var m = t.match(re); if (!m) return null; var seg = t.slice(m.index + m[0].length, m.index + m[0].length + 40).replace(/\([^)]*\)/g, ' '); var ns = seg.match(dec ? /\d+\.\d+/g : /\d+(?:\.\d+)?/g) || []; for (var i = 0; i < ns.length; i++) { var v = parseFloat(ns[i]); if (v >= lo && v <= hi) return v; } return null; }
    if (out.sc != null && out.tbw != null && out.sc === out.tbw) drop('tbw');   /* 38차: 합 검산 전에 */
    var prot = ST ? ST.prot : firstNum(/단\s*백\s*질/, 3, 40, 1), mine = ST ? ST.mine : firstNum(/무\s*기\s*질/, 1, 10, 1);
    if (!ST && out.tbw && prot && mine && out.bfm) { var ws = Math.round((out.tbw + prot + mine + out.bfm) * 10) / 10; var wOk = out.w != null && got.indexOf('w') >= 0 && out.lbm && out.bfm && Math.abs(out.lbm + out.bfm - out.w) <= 0.3; if (!wOk && ws >= 25 && ws <= 300 && (out.w == null || Math.abs(out.w - ws) > 1)) { drop('w'); out.w = ws; fixed.push('w'); } }
    var ideal = firstNum(/적\s*정\s*체\s*중/, 25, 300); if (ideal != null && out.w === ideal && fixed.indexOf('w') < 0) drop('w');   /* 적정체중을 체중으로 읽은 경우 */
    if (out.w) {
      if (out.tbw != null && (out.tbw > out.w * 0.8 || out.tbw < out.w * 0.3)) drop('tbw');
      if (out.bmr != null && (out.bmr < out.w * 12 || out.bmr > out.w * 40)) drop('bmr');
    }
    if (out.bmi != null && out.bmi > 60) drop('bmi');
    if (out.sc != null && out.tbw != null && out.sc === out.tbw) drop('tbw');
    if (out.smm && out.w && (out.smm > out.w * 0.65 || out.smm < out.w * 0.15)) drop('smm');
    if (out.lbm && out.w && out.lbm >= out.w) drop('lbm');
    if (out.lbm && out.bfm && fixed.indexOf('w') < 0) { var wc = Math.round((out.lbm + out.bfm) * 10) / 10; if (wc >= 25 && wc <= 300 && (out.w == null || Math.abs(out.w - wc) > 1)) { drop('w'); out.w = wc; fixed.push('w'); } }   /* 체중 = 제지방량 + 체지방량 */
    if (out.w && out.lbm && !out.bfm) { out.bfm = Math.round((out.w - out.lbm) * 10) / 10; fixed.push('bfm'); }
    /* 36차: ACCUNIQ는 체지방률 줄이 더 잘 읽힘(체지방량은 막대 끝 숫자가 깨지기 쉬움) → 엇갈리면 체지방량을 고침 */
    if (ACC && out.w && out.bfm && out.pbf != null && got.indexOf('pbf') >= 0 && Math.abs(out.bfm - out.w * out.pbf / 100) > 1) { out.bfm = Math.round(out.w * out.pbf / 10) / 10; fixed.push('bfm'); }
    if (out.w && out.bfm) { var pc = Math.round(out.bfm / out.w * 1000) / 10; if (out.pbf == null || Math.abs(out.pbf - pc) > 1.5) { out.pbf = pc; fixed.push('pbf'); } }
    if (out.w && out.pbf && !out.bfm) { out.bfm = Math.round(out.w * out.pbf / 10) / 10; fixed.push('bfm'); }
    if (out.w && ht) { var bc = Math.round(out.w / Math.pow(ht / 100, 2) * 10) / 10; if (out.bmi == null || Math.abs(out.bmi - bc) > 1) { out.bmi = bc; fixed.push('bmi'); } }
    if (ACC && out.w && out.bfm && out.lbm == null) { out.lbm = Math.round((out.w - out.bfm) * 10) / 10; fixed.push('lbm'); }   /* 제지방량 = 체중 − 체지방량 */
    got = got.filter(function (k) { return fixed.indexOf(k) < 0; });
    var dm = (out._accD || t).match(/(20\d{2})\s*[.,\-\/년]\s*(\d{1,2})\s*[.,\-\/월]\s*(\d{1,2})/);
    if (dm && +dm[2] >= 1 && +dm[2] <= 12 && +dm[3] >= 1 && +dm[3] <= 31) out.d = dm[1] + '-' + pad(+dm[2]) + '-' + pad(+dm[3]);
    if (out.sc != null && got.indexOf('sc') < 0) got.push('sc');
    delete out._accD; out._got = got.filter(function (k) { return out[k] != null; }); out._calc = fixed; out._raw = raw;
    return out;
  }
  window.PK_parseInbody = parseInbody;
  function ibDelta(a, b, k, unit, good) {
    if (a == null || b == null) return '';
    var d = Math.round((a - b) * 10) / 10; if (!d) return '<em class="dz">±0</em>';
    var up = d > 0, cls = good === 'up' ? (up ? 'dg' : 'db') : good === 'down' ? (up ? 'db' : 'dg') : 'dz';
    return '<em class="' + cls + '">' + (up ? '▲' : '▼') + Math.abs(d) + unit + '</em>';
  }
  function ibChart(rows) {
    var pts = rows.filter(function (r) { return r.smm || r.bfm; }); if (pts.length < 2) return '<p class="note">인바디를 두 번 이상 기록하면 골격근량·체지방량 그래프가 그려져요.</p>';
    var W2 = 320, H2 = 140, P = 20, vals = []; pts.forEach(function (r) { if (r.smm) vals.push(r.smm); if (r.bfm) vals.push(r.bfm); });
    var mn = Math.floor(Math.min.apply(null, vals) - 1), mx = Math.ceil(Math.max.apply(null, vals) + 1);
    function X(i) { return P + i * (W2 - 2 * P) / (pts.length - 1); } function Y(v) { return H2 - P - (v - mn) / (mx - mn || 1) * (H2 - 2 * P); }
    function line(k, col) { var xy = pts.map(function (r, i) { return r[k] ? X(i).toFixed(1) + ',' + Y(r[k]).toFixed(1) : null; }).filter(Boolean); return xy.length > 1 ? '<polyline fill="none" stroke="' + col + '" stroke-width="3" points="' + xy.join(' ') + '"/>' + xy.map(function (p) { var a = p.split(','); return '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="3.5" fill="' + col + '"/>'; }).join('') : ''; }
    return '<svg class="ch" viewBox="0 0 ' + W2 + ' ' + H2 + '">' + line('smm', '#4fb47a') + line('bfm', '#ff5fa2') +
      '<text x="' + P + '" y="12" fill="#9aa2ab" font-size="10">' + mx + 'kg</text><text x="' + P + '" y="' + (H2 - 4) + '" fill="#9aa2ab" font-size="10">' + mn + 'kg · ' + mdw(pts[0].d) + ' → ' + mdw(pts[pts.length - 1].d) + '</text></svg>' +
      '<div class="row" style="gap:12px;margin-top:4px"><span class="note" style="margin:0"><b style="color:#4fb47a">━ 골격근량</b></span><span class="note" style="margin:0"><b style="color:#ff5fa2">━ 체지방량</b></span></div>';
  }
  var IBSEL = null;   /* 39차: 측정 기록을 누르면 그 날짜를 위 카드에(그 전 측정과 비교) */
  function renderIb() {
    if (IBSEL != null && !(IBSEL >= 0 && IBSEL < IB.length - 1)) IBSEL = null;
    var si = IBSEL != null ? IBSEL : IB.length - 1, h = '', L2 = IB[si], P2 = IB[si - 1];
    h += '<div class="hero"><div class="fc"></div><div><small>인바디 기록</small><b>결과지 사진을 찍으면 숫자를 자동으로 읽어 와요. 근육은 늘고 지방은 줄었는지 한눈에 봐요.</b></div></div>';
    h += '<div class="g2"><label class="btn p" style="text-align:center">📷 결과지 사진으로 입력<input id="ibPh" type="file" accept="image/*" multiple hidden></label><button class="btn" id="ibMan">✍️ 직접 입력</button></div>';
    if (L2) {
      h += '<div class="card' + (IBSEL != null ? ' ibsel' : '') + '" id="ibCard" style="margin-top:10px"><div class="h3">' + (IBSEL != null ? '📋 ' + mdw(L2.d) + ' 측정' : '📊 최근 측정 ' + mdw(L2.d)) + (P2 ? ' <small>' + (IBSEL != null ? '그 전' : '지난번') + ' ' + mdw(P2.d) + ' 대비</small>' : '') + '</div>' + (IBSEL != null ? '<button class="btn sm" id="ibBack" style="margin:0 0 8px">↩ 최근 측정으로</button>' : '') + '<div class="ibk">' +
        [['w', '체중', 'kg', ''], ['smm', '골격근량', 'kg', 'up'], ['bfm', '체지방량', 'kg', 'down'], ['pbf', '체지방률', '%', 'down'], ['bmr', '기초대사량', 'kcal', 'up'], ['vfl', '내장지방', '레벨', 'down']].filter(function (x) { return L2[x[0]] != null; }).map(function (x) {
          return '<div><b>' + fmtW(L2[x[0]]) + '<small>' + x[2] + '</small></b><span>' + x[1] + '</span>' + (P2 ? ibDelta(L2[x[0]], P2[x[0]], x[0], x[2] === '레벨' ? '' : x[2], x[3]) : '') + '</div>';
        }).join('') + '</div>';
      if (P2 && L2.smm != null && P2.smm != null && L2.bfm != null && P2.bfm != null) {
        var dm = Math.round((L2.smm - P2.smm) * 10) / 10, df = Math.round((L2.bfm - P2.bfm) * 10) / 10;
        h += '<div class="coach">' + (dm >= 0 && df <= 0 ? '🦍 좋아요! 근육 ' + (dm ? '+' + dm + 'kg' : '유지') + ', 지방 ' + (df ? '−' + Math.abs(df) + 'kg' : '유지') + '. 이 방향 그대로 가요.' : dm < 0 && df > 0 ? '🦍 근육은 줄고 지방이 늘었어요. 단백질(체중×1.6~2g)과 근력 운동 횟수를 먼저 점검해 봐요.' : dm < 0 ? '🦍 지방과 함께 근육도 ' + dm + 'kg 줄었어요. 감량 속도가 빠르진 않은지, 근력 운동 무게를 지키고 있는지 봐요.' : '🦍 근육 +' + dm + 'kg, 지방 +' + df + 'kg. 벌크업 중이라면 정상이고, 감량 중이라면 칼로리를 조금 줄여요.') + '</div>';
      }
      if (IBSEG.some(function (sg) { return L2[sg[0]] != null; })) h += '<div class="h3" style="margin-top:8px">💪 부위별 근육량</div><div class="chips">' + IBSEG.filter(function (sg) { return L2[sg[0]] != null; }).map(function (sg) { return '<span class="chip">' + sg[1] + ' ' + fmtW(L2[sg[0]]) + 'kg</span>'; }).join('') + '</div>';
      h += '</div>';
      h += '<div class="card"><div class="h3">📈 변화 그래프</div>' + ibChart(IB) + '</div>';
      h += '<div class="h3">🗂 측정 기록 <small>' + IB.length + '회</small></div><div class="lst">' + IB.slice().reverse().map(function (r, i) {
        var ix = IB.length - 1 - i; return '<div class="it' + (ix === si ? ' on' : '') + '" data-ibv="' + ix + '" style="cursor:pointer' + (ix === si ? ';border-color:var(--main)' : '') + '"><div style="flex:1"><b>' + mdw(r.d) + (ix === IB.length - 1 ? ' <small>최근</small>' : '') + '</b><small>' + [['w', '체중', 'kg'], ['smm', '근육', 'kg'], ['bfm', '지방', 'kg'], ['pbf', '', '%']].filter(function (x) { return r[x[0]] != null; }).map(function (x) { return x[1] + ' ' + fmtW(r[x[0]]) + x[2]; }).join(' · ') + '</small></div><button class="go" data-ibe="' + (IB.length - 1 - i) + '">✏️</button></div>';
      }).join('') + '</div>';
      h += '<p class="note">🔶 인바디(생체전기저항) 수치는 측정 시간·식사·수분 상태에 따라 달라져요. 같은 기계로, 같은 시간대(아침 공복·화장실 다녀온 뒤)에 재야 비교가 정확해요. 진단 도구가 아니에요.</p>';
    } else {
      h += '<p class="note" style="margin-top:10px">아직 기록이 없어요. 인바디를 재셨다면 결과지를 찍어 보세요. 체중·골격근량·체지방량·체지방률·BMI·기초대사량·내장지방 레벨을 읽어 와요.</p>';
    }
    $('pg').innerHTML = h;
    $('ibMan').onclick = function () { ibSheet({ d: ymd() }, null); };
    $('ibPh').onchange = function () { var fs = Array.prototype.slice.call(this.files || [], 0, 3); if (fs.length) ibOcrMany(fs, null); if ((this.files || []).length > 3) toast('사진은 한 번에 3장까지 읽어요'); this.value = ''; };
    $('pg').querySelectorAll('[data-ibe]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); ibSheet(JSON.parse(JSON.stringify(IB[+b.dataset.ibe])), +b.dataset.ibe); }; });
    $('pg').querySelectorAll('[data-ibv]').forEach(function (r) { r.onclick = function () { var v = +r.dataset.ibv; IBSEL = v === IB.length - 1 ? null : v; renderIb(); var c = $('ibCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    if ($('ibBack')) $('ibBack').onclick = function () { IBSEL = null; renderIb(); };
  }
  function ibSheet(r, idx, auto) {
    var got = (auto && auto._got) || [];
    sheet('<div class="sh"><b>📊 인바디 ' + (idx == null ? '기록' : '수정') + '</b><button class="ib" id="ibX">✕</button></div>' +
      (auto ? '<p class="note" style="color:var(--gold)">🔶 사진에서 ' + got.length + '개 항목을 읽었어요(분홍 칸)' + (auto._calc && auto._calc.length ? ', 🧮 칸 ' + auto._calc.length + '개는 체중·키·체지방량으로 계산했어요' : '') + '. 결과지와 한 번 맞춰 보고 저장해 주세요. 빈칸은 직접 넣으면 돼요.</p>' + (r.smm == null ? '<p class="note" style="color:#ff8db8">✍️ 골격근량은 결과지 「골격근·지방분석」 막대 끝에 적힌 숫자예요. 막대 위 숫자는 사진으로 잘 안 읽혀서 직접 넣어 주세요.</p>' : '') + (auto._imgs && auto._imgs.length ? '<div class="ibimgs">' + auto._imgs.map(function (u, k) { return '<img class="ibimg" src="' + u + '" alt="결과지 ' + (k + 1) + '장">'; }).join('') + '</div>' : auto._img ? '<img class="ibimg" src="' + auto._img + '" alt="결과지">' : '') : '') +
      '<div class="ibf"><label>측정일<input id="ib_d" type="date" value="' + (r.d || ymd()) + '"></label>' +
      IBF.map(function (f) { var calc = auto && auto._calc && auto._calc.indexOf(f[0]) >= 0, need = auto && f[0] === 'smm' && r.smm == null; return '<label' + (got.indexOf(f[0]) >= 0 ? ' class="auto"' : calc ? ' class="calc"' : need ? ' class="need"' : '') + '>' + (need ? '✍️ ' : '') + (calc ? '🧮 ' : '') + f[1] + (f[2] ? ' <small>' + f[2] + '</small>' : '') + '<input id="ib_' + f[0] + '" type="number" inputmode="decimal" step="0.1" value="' + (r[f[0]] != null ? r[f[0]] : '') + '"></label>'; }).join('') + '</div>' +
      '<details' + (IBSEG.some(function (sg) { return r[sg[0]] != null; }) ? ' open' : '') + '><summary>💪 부위별 근육량 (선택)</summary><div class="ibf">' + IBSEG.map(function (sg) { return '<label>' + sg[1] + ' <small>kg</small><input id="ib_' + sg[0] + '" type="number" inputmode="decimal" step="0.1" value="' + (r[sg[0]] != null ? r[sg[0]] : '') + '"></label>'; }).join('') + '</div></details>' +
      (auto && auto._raw ? '<details style="margin-top:8px"><summary>📄 사진에서 읽은 글자 보기</summary><p class="note">숫자가 엉뚱하면 이 글자를 캡처해서 보내 주세요(읽는 규칙을 고치는 데 써요).</p><textarea id="ibRaw" readonly style="width:100%;height:220px;font-size:11px;line-height:1.35">' + esc(auto._raw) + '</textarea><button class="btn sm" id="ibRawCp">📋 글자 복사</button></details>' : '') +
      (auto ? '<label class="btn w" style="margin-top:10px;text-align:center">➕ 결과지 다음 장 더 읽기 <small>(빈칸만 채워요)</small><input id="ibMore" type="file" accept="image/*" multiple hidden></label>' : '') +
      '<button class="btn p w" id="ibSave" style="margin-top:10px">💾 저장</button>' + (idx != null ? '<button class="btn w" id="ibDel" style="margin-top:6px">🗑 이 기록 지우기</button>' : '') +
      '<p class="note">체중을 넣으면 📸 바프 체중 기록에도 그날 체중이 들어가요(이미 있으면 그대로 둬요).</p>', function (sb) {
      sb.querySelector('#ibX').onclick = closeSheet;
      if (sb.querySelector('#ibMore')) sb.querySelector('#ibMore').onchange = function () {
        var fs = Array.prototype.slice.call(this.files || [], 0, 3); this.value = ''; if (!fs.length) return;
        var cur = { d: sb.querySelector('#ib_d').value || ymd() };   /* 지금 화면 값(직접 고친 값 포함)을 그대로 두고 빈칸만 채움 */
        IBF.concat(IBSEG).forEach(function (f) { var v = parseFloat(sb.querySelector('#ib_' + f[0]).value); if (!isNaN(v)) cur[f[0]] = v; });
        ibOcrMany(fs, { base: cur, auto: auto });
      };
      if (sb.querySelector('#ibRawCp')) sb.querySelector('#ibRawCp').onclick = function () { var ta = sb.querySelector('#ibRaw'); try { navigator.clipboard.writeText(ta.value).then(function () { toast('📋 복사했어요'); }, function () { ta.select(); document.execCommand('copy'); toast('📋 복사했어요'); }); } catch (e) { ta.select(); try { document.execCommand('copy'); } catch (e2) { } toast('📋 복사했어요'); } };
      sb.querySelector('#ibSave').onclick = function () {
        var o = { d: sb.querySelector('#ib_d').value || ymd() }, n = 0;
        IBF.concat(IBSEG.map(function (sg) { return [sg[0]]; })).forEach(function (f) { var v = parseFloat(sb.querySelector('#ib_' + f[0]).value); if (!isNaN(v)) { o[f[0]] = v; n++; } });
        if (!n) { toast('숫자를 하나 이상 넣어 주세요'); return; }
        /* 33차: 같은 날짜 기록이 이미 있으면(결과지 2장 등) 새 기록을 만들지 않고 그 기록의 빈칸만 채움 — 이미 있는 값은 그대로 */
        var mi = idx == null ? IB.findIndex(function (x) { return x.d === o.d; }) : -1, msg = '📊 인바디를 저장했어요';
        if (mi >= 0) {
          var ex = IB[mi], add = 0, keep = 0;
          Object.keys(o).forEach(function (k) { if (k === 'd') return; if (ex[k] == null) { ex[k] = o[k]; add++; } else if (ex[k] !== o[k]) keep++; });
          msg = '📊 ' + mdw(o.d) + ' 기록에 빈칸 ' + add + '개를 채웠어요' + (keep ? ' (값이 다른 ' + keep + '개는 원래 값 유지 · ✏️로 고칠 수 있어요)' : '');
          o = ex;
        } else if (idx != null) IB[idx] = o; else IB.push(o);
        saveIB();
        if (o.w && !BW.some(function (x) { return x.d === o.d; })) { BW.push({ d: o.d, w: o.w }); BW.sort(function (a, b) { return a.d < b.d ? -1 : 1; }); store.set('bw', BW); }
        closeSheet(); render(); toast(msg);
      };
      if (sb.querySelector('#ibDel')) sb.querySelector('#ibDel').onclick = function () { if (confirmBox('이 인바디 기록을 지울까요?')) { IB.splice(idx, 1); saveIB(); closeSheet(); render(); } };
    });
  }
  /* 사진 → 글자 읽기: 앱은 휴대폰 안 글자 인식(KKApp.ocr → window.pkOcr), 웹 미리보기는 Tesseract.js */
  var OCRWAIT = null;
  window.pkOcr = function (txt) { if (OCRWAIT) { var f = OCRWAIT; OCRWAIT = null; f(txt || ''); } };
  function ibOcrDone(text, img) {
    var r = parseInbody(text); r._img = img;
    if (!r._got.length) { toast('결과지 글자를 읽지 못했어요. 직접 입력해 주세요'); ibSheet({ d: ymd() }, null); return; }
    var base = { d: r.d || ymd() }; IBF.concat(IBSEG).forEach(function (f) { if (r[f[0]] != null) base[f[0]] = r[f[0]]; });
    ibSheet(base, null, r);
  }
  /* 35차: 결과지 여러 장 — 한 장씩 차례로 읽고, 앞 장에서 읽은 칸은 그대로 두고 빈칸만 뒤 장 값으로 채움(사진에서 읽은 값이 계산값보다 우선) */
  function ocrOne(url) {
    return new Promise(function (ok) {
      if (NATIVE && KKA.ocr) { OCRWAIT = function (txt) { ok(txt || ''); }; try { KKA.ocr(url.split(',')[1]); } catch (e) { OCRWAIT = null; ok(''); } return; }
      ocrWeb(url).then(ok, function () { ok(null); });
    });
  }
  function readUrl(file) { return new Promise(function (ok) { var rd = new FileReader(); rd.onload = function () { ok(rd.result); }; rd.onerror = function () { ok(null); }; rd.readAsDataURL(file); }); }
  function mergeIb(list, prev) {
    var keys = IBF.concat(IBSEG).map(function (f) { return f[0]; }), out = { _got: [], _calc: [], _imgs: [], _raw: '' }, base = prev ? JSON.parse(JSON.stringify(prev.base)) : { d: null };
    if (prev && prev.auto) { out._got = (prev.auto._got || []).slice(); out._calc = (prev.auto._calc || []).slice(); out._imgs = (prev.auto._imgs || (prev.auto._img ? [prev.auto._img] : [])).slice(); out._raw = prev.auto._raw || ''; }
    var n0 = out._imgs.length;
    keys.forEach(function (k) {
      if (base[k] != null) return;
      var hit = null; list.forEach(function (r) { if (hit == null && r._got.indexOf(k) >= 0 && r[k] != null) hit = r; });
      if (hit) { base[k] = hit[k]; if (out._got.indexOf(k) < 0) out._got.push(k); return; }
      list.forEach(function (r) { if (base[k] == null && r[k] != null) { base[k] = r[k]; if (r._calc.indexOf(k) >= 0 && out._calc.indexOf(k) < 0) out._calc.push(k); else if (out._got.indexOf(k) < 0) out._got.push(k); } });
    });
    var hh = null; list.forEach(function (r) { if (!hh && r._h) hh = r._h; });
    ibFix(base, out, hh);
    list.forEach(function (r, i) { if (!base.d && r.d) base.d = r.d; out._imgs.push(r._img); out._raw += (out._raw ? '\n\n' : '') + '=== ' + (n0 + i + 1) + '장 ===\n' + (r._raw || ''); });
    if (!base.d) base.d = ymd();
    return { base: base, auto: out };
  }
  /* 36차: 여러 장을 합친 뒤 서로 맞는지 검산 — 체중은 BMI×키²로, 체지방량은 체중×체지방률로, 제지방량은 체중−체지방량으로.
     장마다 따로 읽은 값이 엇갈리면(예: 막대 끝 「1」이 붙은 194.7) 맞는 쪽으로 고치고 🧮 표시 */
  function ibFix(b, o, h) {
    function asCalc(k, v) { b[k] = Math.round(v * 10) / 10; var gi = o._got.indexOf(k); if (gi >= 0) o._got.splice(gi, 1); if (o._calc.indexOf(k) < 0) o._calc.push(k); }
    function isGot(k) { return o._got.indexOf(k) >= 0; }
    if (b.w && b.bmi && h) {
      var wb = b.bmi * Math.pow(h / 100, 2);
      if (Math.abs(b.w - wb) / wb > 0.05) [String(b.w).charAt(0) === '1' && b.w >= 100 ? parseFloat(String(b.w).slice(1)) : null, b.w / 10].some(function (x) { if (x && Math.abs(x - wb) / wb <= 0.03) { b.w = x; return true; } return false; });
    }
    if (b.w && b.pbf && b.bfm != null) {
      var eb = b.w * b.pbf / 100;
      if (Math.abs(b.bfm - eb) > 1) {
        var bfmOk = b.lbm != null && isGot('lbm') && Math.abs(b.w - b.lbm - b.bfm) <= 1;   /* 제지방량과 맞으면 체지방량이 맞음 → 체지방률을 고침 */
        if (bfmOk || (!isGot('pbf') && isGot('bfm'))) asCalc('pbf', b.bfm / b.w * 100); else asCalc('bfm', eb);
      }
    } else if (b.w && b.pbf && b.bfm == null) asCalc('bfm', b.w * b.pbf / 100);
    if (b.w && b.bfm != null && (b.lbm == null || (Math.abs(b.w - b.bfm - b.lbm) > 1 && !isGot('lbm')))) asCalc('lbm', b.w - b.bfm);
  }
  function ibOcrMany(files, prev) {
    sheet('<div class="sh"><b>📷 결과지 읽는 중…</b></div><p class="note" id="ocrMsg">사진에서 숫자를 찾고 있어요' + (files.length > 1 ? ' (1/' + files.length + '장)' : '') + '. 10~30초쯤 걸려요.</p>', null);
    var list = [], fail = 0;
    files.reduce(function (p, f, i) {
      return p.then(function () { var e = $('ocrMsg'); if (e && files.length > 1) e.textContent = '사진에서 숫자를 찾고 있어요 (' + (i + 1) + '/' + files.length + '장)…'; return readUrl(f); })
        .then(function (url) { if (!url) { fail++; return; } return ocrOne(url).then(function (txt) { if (txt == null) { fail++; return; } var r = parseInbody(txt); r._img = url; list.push(r); }); });
    }, Promise.resolve()).then(function () {
      closeSheet();
      if (!list.length || (!prev && !list.some(function (r) { return r._got.length; }))) { toast(fail && !list.length ? '이 화면에서는 사진 읽기를 못 했어요. 직접 입력해 주세요' : '결과지 글자를 읽지 못했어요. 직접 입력해 주세요'); if (prev) ibSheet(prev.base, null, prev.auto); else ibSheet({ d: ymd() }, null); return; }
      var m = mergeIb(list, prev); ibSheet(m.base, null, m.auto);
      if (prev) toast('➕ 다음 장에서 빈칸을 채웠어요');
    });
  }
  function ibOcr(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var url = rd.result;
      sheet('<div class="sh"><b>📷 결과지 읽는 중…</b></div><p class="note" id="ocrMsg">사진에서 숫자를 찾고 있어요. 10~30초쯤 걸려요.</p><img class="ibimg" src="' + url + '" alt="">', null);
      if (NATIVE && KKA.ocr) { OCRWAIT = function (txt) { closeSheet(); ibOcrDone(txt, url); }; try { KKA.ocr(url.split(',')[1]); } catch (e) { OCRWAIT = null; closeSheet(); toast('글자 인식을 못 했어요'); } return; }
      ocrWeb(url).then(function (txt) { closeSheet(); ibOcrDone(txt, url); }, function () { closeSheet(); toast('이 화면에서는 사진 읽기를 못 했어요(인터넷 필요). 직접 입력해 주세요'); ibSheet({ d: ymd() }, null); });
    };
    rd.readAsDataURL(file);
  }
  function ocrWeb(url) {
    return new Promise(function (ok, no) {
      function run() {
        window.Tesseract.recognize(url, 'kor+eng', { logger: function (m) { var e = $('ocrMsg'); if (e && m.progress != null) e.textContent = '사진에서 숫자를 찾고 있어요… ' + Math.round(m.progress * 100) + '%'; } })
          .then(function (r) { ok(r.data.text); }, no);
      }
      if (window.Tesseract) return run();
      var sc = document.createElement('script'); sc.src = 'https:\/\/cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; sc.onload = run; sc.onerror = no; document.head.appendChild(sc);
    });
  }

  /* ───────── 📸 바프 탭 ───────── */
  var BP = store.get('bp', null), BW = store.get('bw', []);   // BW: [{d,w}]
  var ACT = [[1.2, '거의 안 움직임(사무직, 운동 X)'], [1.375, '가벼운 운동 주 1~3회'], [1.55, '운동 주 3~5회'], [1.725, '운동 주 6~7회·몸 쓰는 일']];
  function lastWeight() { return BW.length ? BW[BW.length - 1].w : null; }
  function avgW(from, to) { var a = BW.filter(function (x) { return x.d >= from && x.d <= to; }); return a.length ? a.reduce(function (s, x) { return s + x.w; }, 0) / a.length : null; }
  function bpTarget() {
    var w = lastWeight() || BP.w, bmr = 10 * w + 6.25 * BP.h - 5 * BP.age + (BP.sex === 'm' ? 5 : -161), src = '키·나이 추정(Mifflin-St Jeor)';
    var ib = ibRecent(60);
    if (ib && ib.pbf) { bmr = 370 + 21.6 * w * (1 - ib.pbf / 100); src = '인바디 체지방률 ' + ib.pbf + '% (' + mdw(ib.d) + ')로 계산(Katch-McArdle)'; }
    else if (ib && ib.bmr) { bmr = ib.bmr; src = '인바디 기초대사량 (' + mdw(ib.d) + ')'; }
    var tdee = bmr * BP.act;
    var wk = daysBetween(ymd(), BP.date) / 7, def = wk > 8 ? .15 : wk > 1 ? .2 : .1;
    var floor = Math.max(bmr, BP.sex === 'm' ? 1500 : 1200);
    var k = Math.round(Math.max(floor, tdee * (1 - def) + (BP.adj || 0)) / 10) * 10;
    var p = Math.round(w * 2.0), f = Math.round(Math.max(w * 0.8, k * 0.22 / 9)), c = Math.max(50, Math.round((k - p * 4 - f * 9) / 4));
    return { k: k, p: p, c: c, f: f, bmr: Math.round(bmr), tdee: Math.round(tdee), wk: wk, def: def, floor: k <= floor + 5, src: src };
  }
  function phaseName(wk) { return wk > 8 ? '🌱 준비기 — 천천히 줄이며 운동 습관 만들기' : wk > 4 ? '🔥 감량기 — 꾸준한 감량, 근력 운동 무게 지키기' : wk > 1 ? '✨ 마무리기 — 감량 속도 유지, 컨디션 관리' : wk >= 0 ? '📸 촬영 주간 — 평소대로, 무리한 단수·단식 금지' : '✅ 촬영 끝 — 수고했어요! 천천히 유지 칼로리로'; }
  function renderBp() {
    var h = '';
    if (!BP) {
      h += '<div class="hero"><div class="fc"></div><div><small>바디프로필 플랜</small><b>촬영일만 정하면 D-day, 하루 칼로리·탄단지 목표, 주간 체중 점검까지 킹콩이 같이 챙겨요.</b></div></div>';
      h += bpForm({ sex: 'm', age: 30, h: 175, w: 75, goal: '', act: 1.55, date: addDays(ymd(), 84) });
      $('pg').innerHTML = h; bindBpForm(); return;
    }
    var t = ymd(), dd = daysBetween(t, BP.date), tg = bpTarget(), cw = lastWeight() || BP.w;
    h += '<div class="card" style="background:linear-gradient(135deg,#3a1528,#1d1f23);border-color:#5a2342"><div class="row" style="justify-content:space-between"><div><div style="font-size:13px;color:var(--main2);font-weight:800">📸 촬영 ' + mdw(BP.date) + '</div><div style="font-size:34px;font-weight:900;color:#fff">' + (dd > 0 ? 'D-' + dd : dd === 0 ? 'D-DAY' : 'D+' + (-dd)) + '</div></div><div style="text-align:right"><div style="font-size:13px;color:var(--muted)">' + (BP.goal ? '현재 → 목표' : '현재 체중') + '</div><div style="font-size:20px;font-weight:900;color:#fff">' + fmtW(cw) + (BP.goal ? ' → ' + BP.goal : '') + 'kg</div></div></div><p class="note" style="color:var(--ivory)">' + phaseName(tg.wk) + '</p></div>';
    h += '<div class="card"><div class="h3">🎯 오늘 목표</div><div class="kpi" style="margin-top:8px;grid-template-columns:repeat(4,1fr)"><div><b>' + tg.k + '</b><small>kcal</small></div><div><b>' + tg.p + '</b><small>단백질 g</small></div><div><b>' + tg.c + '</b><small>탄수 g</small></div><div><b>' + tg.f + '</b><small>지방 g</small></div></div><p class="note">기초대사량 약 ' + tg.bmr + ' · 하루 소모 약 ' + tg.tdee + 'kcal에서 ' + Math.round(tg.def * 100) + '% 줄인 값' + (BP.adj ? ' (주간 점검 조정 ' + (BP.adj > 0 ? '+' : '') + BP.adj + ')' : '') + '. 단백질은 체중×2g.' + (tg.floor ? ' ⚠️ 기초대사량보다 낮게 먹지 않도록 하한선에 맞췄어요.' : '') + ' 🔶 기초대사량 근거: ' + tg.src + '. 계산으로 낸 출발점이라 2주 체중 변화를 보고 조정해요.' + (tg.src.indexOf('인바디') < 0 ? ' 📊 인바디 탭에 결과를 넣으면 더 정확해져요.' : '') + '</p></div>';
    var tw = (BW.filter(function (x) { return x.d === t; })[0] || {}).w;
    h += '<div class="card"><div class="h3">⚖️ 체중 기록 <small>아침 공복·화장실 다녀온 뒤가 가장 정확해요</small></div><div class="row" style="margin-top:8px"><input id="bwIn" inputmode="decimal" placeholder="오늘 체중 kg" value="' + (tw || '') + '" style="flex:1"><button class="btn p" id="bwOk">저장</button></div>' + bwChart() + bwCheck() + '</div>';
    h += '<div class="card"><div class="h3">🍱 하루 메뉴 예시 <small>목표 ' + tg.k + 'kcal에 가까운 것부터</small></div><div class="lst" style="margin-top:8px">' + D.MENUS.map(function (m, i) {
      var k = menuKcal(m); return { m: m, i: i, k: k, d: Math.abs(k - tg.k) };
    }).sort(function (a, b) { return a.d - b.d; }).map(function (x) {
      return '<div class="it" style="flex-direction:column;align-items:stretch"><div><b>' + esc(x.m.n) + ' <span class="tag">약 ' + x.k + 'kcal</span></b><small>' + esc(x.m.d) + '</small><small style="color:var(--muted);margin-top:4px">' + x.m.m.map(function (ml) { return ml[0] + ': ' + ml[1].map(function (f) { return f[0] + (f[1] !== 1 ? '×' + f[1] : ''); }).join(', '); }).join('<br>') + '</small></div><button class="btn sm p" data-mn="' + x.i + '" style="align-self:flex-start;margin-top:6px">📥 오늘 식단에 담기</button></div>';
    }).join('') + '</div></div>';
    h += '<div class="card"><div class="h3">🍽 외식·편의점 대체 요령</div><div style="margin-top:6px">' + D.SWAPS.map(function (s) { return '<div class="coach"><b>' + s[0] + '</b> ' + esc(s[1]) + '</div>'; }).join('') + '</div></div>';
    h += '<div class="card"><div class="h3">⚠️ 안전하게</div><p class="note">· 일주일에 체중의 1%보다 빨리 빠지면 근육도 같이 빠지기 쉬워요.<br>· 촬영 직전 물을 끊거나 굶는 「수분 컷」은 어지럼·탈수·부정맥 위험이 있어요. 하려면 반드시 전문가와 상의하세요.<br>· 지병이 있거나 약을 먹는 중이면 칼로리를 크게 줄이기 전에 의사와 먼저 상의하세요.<br>· 이 앱의 수치는 일반적인 계산값이며 진단·처방을 대신하지 않아요.</p></div>';
    h += '<button class="btn w" id="bpEdit">✏️ 플랜 수정</button>';
    $('pg').innerHTML = h;
    $('bwOk').onclick = function () { var v = parseFloat($('bwIn').value); if (!v || v < 25 || v > 300) { toast('체중을 확인해 주세요'); return; } BW = BW.filter(function (x) { return x.d !== t; }); BW.push({ d: t, w: v }); BW.sort(function (a, b) { return a.d < b.d ? -1 : 1; }); store.set('bw', BW); render(); toast('⚖️ ' + v + 'kg 기록'); };
    $('bpEdit').onclick = function () { $('pg').innerHTML = bpForm(BP); bindBpForm(); };
    $('pg').querySelectorAll('[data-mn]').forEach(function (b) { b.onclick = function () {
      var m = D.MENUS[+b.dataset.mn], keep = FD; FD = ymd();
      m.m.forEach(function (ml) { ml[1].forEach(function (x) { var f = D.FOOD.filter(function (y) { return y[0] === x[0]; })[0]; if (f) addFood(ml[0], foodItem(f, x[1])); }); });
      FD = keep; toast('📥 오늘 식단에 담았어요 (🍱 식단 탭)');
    }; });
    if ($('bwAdj')) $('bwAdj').onclick = function () { BP.adj = (BP.adj || 0) + (+$('bwAdj').dataset.v); BP.adjAt = t; store.set('bp', BP); render(); toast('목표 칼로리를 조정했어요'); };
  }
  function menuKcal(m) { var k = 0; m.m.forEach(function (ml) { ml[1].forEach(function (x) { var f = D.FOOD.filter(function (y) { return y[0] === x[0]; })[0]; if (f) k += f[2] * x[1]; }); }); return Math.round(k / 10) * 10; }
  function bwChart() {
    var a = BW.slice(-28); if (a.length < 2) return '<p class="note">체중을 이틀 이상 넣으면 그래프가 그려져요.</p>';
    var vs = a.map(function (x) { return x.w; }), mx = Math.max.apply(null, vs), mn = Math.min.apply(null, vs), W2 = 320, H2 = 120, P = 14;
    var xy = a.map(function (x, i) { return [P + i * (W2 - 2 * P) / (a.length - 1), mx === mn ? H2 / 2 : H2 - P - (x.w - mn) / (mx - mn) * (H2 - 2 * P)]; });
    return '<svg class="ch" style="height:120px" viewBox="0 0 ' + W2 + ' ' + H2 + '"><polyline fill="none" stroke="#ff5fa2" stroke-width="2.5" points="' + xy.map(function (q) { return q.join(','); }).join(' ') + '"/><text x="4" y="12" fill="#a0a4ab" font-size="10">' + mx + '</text><text x="4" y="' + (H2 - 2) + '" fill="#a0a4ab" font-size="10">' + mn + '</text></svg>';
  }
  function bwCheck() {
    var t = ymd(), a = avgW(addDays(t, -6), t), b = avgW(addDays(t, -13), addDays(t, -7));
    if (!a || !b) return '<p class="note">📊 2주치 체중이 모이면 주간 점검(감량 속도와 칼로리 조정 제안)이 나와요.</p>';
    var rate = (b - a) / b * 100, msg, adj = 0;
    if (BP.adjAt && daysBetween(BP.adjAt, t) < 7) msg = '이번 주에 이미 조정했어요. 다음 주에 다시 볼게요.';
    else if (rate < 0.3) { msg = '지난주 대비 ' + r1(b - a) + 'kg(' + r1(rate) + '%) — 감량이 더뎌요. 하루 150kcal 줄여 볼까요?'; adj = -150; }
    else if (rate > 1.2) { msg = '지난주 대비 ' + r1(b - a) + 'kg(' + r1(rate) + '%) — 너무 빨라요. 근손실을 막으려면 하루 100kcal 늘려요.'; adj = 100; }
    else msg = '지난주 대비 ' + r1(b - a) + 'kg(' + r1(rate) + '%) — 딱 좋은 속도예요 👍 지금처럼!';
    return '<div class="coach">📊 주간 점검: 7일 평균 ' + r1(a) + 'kg · ' + msg + '</div>' + (adj ? '<button class="btn sm p" id="bwAdj" data-v="' + adj + '" style="margin-top:6px">목표 ' + (adj > 0 ? '+' : '') + adj + 'kcal 적용</button>' : '');
  }
  function bpForm(b) {
    return '<div class="card"><div class="h3">📝 플랜 만들기</div><div class="g2" style="margin-top:8px">' +
      '<label class="note">성별<select id="bfS"><option value="m"' + (b.sex === 'm' ? ' selected' : '') + '>남</option><option value="f"' + (b.sex === 'f' ? ' selected' : '') + '>여</option></select></label>' +
      '<label class="note">나이<input id="bfA" inputmode="numeric" value="' + b.age + '"></label>' +
      '<label class="note">키 cm<input id="bfH" inputmode="decimal" value="' + b.h + '"></label>' +
      '<label class="note">지금 체중 kg<input id="bfW" inputmode="decimal" value="' + b.w + '"></label>' +
      '<label class="note">목표 체중 kg(선택)<input id="bfG" inputmode="decimal" value="' + (b.goal || '') + '"></label>' +
      '<label class="note">촬영일<input id="bfD" type="date" value="' + b.date + '"></label></div>' +
      '<label class="note">활동량<select id="bfC">' + ACT.map(function (a) { return '<option value="' + a[0] + '"' + (+b.act === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn p w" id="bfOk" style="margin-top:10px">플랜 시작</button>' + (BP ? '<button class="btn w" id="bfDel" style="margin-top:6px">🗑 플랜 지우기</button>' : '') + '</div>';
  }
  function bindBpForm() {
    $('bfOk').onclick = function () {
      var n = function (id) { return parseFloat($(id).value); };
      var b = { sex: $('bfS').value, age: n('bfA'), h: n('bfH'), w: n('bfW'), goal: n('bfG') || '', act: n('bfC'), date: $('bfD').value, adj: BP ? BP.adj || 0 : 0 };
      if (!b.age || !b.h || !b.w || !b.date) { toast('나이·키·체중·촬영일을 넣어 주세요'); return; }
      BP = b; store.set('bp', BP);
      if (!BW.length) { BW.push({ d: ymd(), w: b.w }); store.set('bw', BW); }
      render();
    };
    if ($('bfDel')) $('bfDel').onclick = function () { if (confirmBox('바프 플랜을 지울까요? (체중 기록은 남아요)')) { BP = null; store.set('bp', null); render(); } };
  }

  /* ───────── ⚙️ 설정 · 백업 ───────── */
  function gymSheet() {
    var g = curGym();
    sheet('<div class="sh"><b>📍 내 헬스장</b><button class="ib" id="gyX">✕</button></div>' +
      '<p class="note">회사 근처·집 근처처럼 다니는 헬스장이 여러 곳이면 따로 만들어요. 헬스장마다 원판 종류, 머신 kg/lb, 덤벨 간격, 지난번 무게를 따로 기억해요.</p>' +
      '<div class="h3">지금: ' + esc(g.n) + '</div><div class="row"><input id="gyN" value="' + esc(g.n) + '" style="flex:1"><button class="btn sm" id="gyRen">이름 바꾸기</button></div>' +
      '<div class="h3">새 헬스장</div><div class="row"><input id="gyNew" placeholder="예: 회사 앞 ○○짐" style="flex:1"><button class="btn sm p" id="gyAddB">＋ 추가</button></div>' +
      (S.gyms.length > 1 ? '<button class="btn w" id="gyDel" style="margin-top:8px">🗑 ' + esc(g.n) + ' 지우기 (운동 기록은 남아요)</button>' : ''), function (sb) {
      sb.querySelector('#gyX').onclick = function () { closeSheet(); render(); };
      sb.querySelector('#gyRen').onclick = function () { var v = sb.querySelector('#gyN').value.trim(); if (!v) return; g.n = v.slice(0, 20); saveS(); closeSheet(); render(); toast('이름을 바꿨어요'); };
      sb.querySelector('#gyAddB').onclick = function () { var v = sb.querySelector('#gyNew').value.trim(); if (!v) { toast('헬스장 이름을 넣어 주세요'); return; } var id = 'g' + Date.now(); S.gyms.push({ id: id, n: v.slice(0, 20), ex: {} }); switchGym(id); saveS(); closeSheet(); render(); };
      if (sb.querySelector('#gyDel')) sb.querySelector('#gyDel').onclick = function () { if (!confirmBox(g.n + '을(를) 지울까요? 운동 기록은 그대로 남아요.')) return; var rest = S.gyms.filter(function (x) { return x.id !== g.id; }); var to = rest[0].id; switchGym(to); S.gyms = rest; saveS(); closeSheet(); render(); };
    });
  }
  function openSettings() {
    sheet('<div class="sh"><b>⚙️ 설정</b><button class="ib" id="stX">✕</button></div>' +
      '<div class="h3">⏱ 기본 휴식 시간</div><div class="chips">' + [30, 60, 90, 120, 180].map(function (s) { return '<button class="chip' + (S.rest === s ? ' on' : '') + '" data-rs="' + s + '">' + s + '초</button>'; }).join('') + '</div>' +
      '<div class="h3">📍 내 헬스장 <small>원판·바·머신 단위·덤벨 간격·지난번 무게를 헬스장마다 따로 기억해요</small></div><div class="chips">' + S.gyms.map(function (g) { return '<button class="chip' + (g.id === S.gym ? ' on' : '') + '" data-sgym="' + g.id + '">' + esc(g.n) + '</button>'; }).join('') + '<button class="chip" id="stGym">✏️ 추가·이름</button></div>' +
      '<div class="h3">🏋️ ' + esc(curGym().n) + ' 원판</div><div class="chips">' + ['1.25', '2.5', '5', '10', '15', '20', '25'].map(function (p) { return '<button class="chip' + (S.plates[p] ? ' on' : '') + '" data-pp="' + p + '">' + p + 'kg</button>'; }).join('') + '</div>' +
      '<div class="h3">🎯 식단 목표(바프 플랜이 없을 때)</div><div class="row"><input id="stK" inputmode="numeric" placeholder="하루 kcal" value="' + (S.kcal || '') + '" style="flex:1"><button class="btn sm" id="stKok">저장</button></div>' +
      '<div class="h3">💾 백업</div><p class="note" style="margin:0">기록은 이 휴대폰 안에만 있어요. 폰을 바꾸기 전에 꼭 내보내 두세요.</p><div class="g2"><button class="btn p" id="bkOut">📤 내보내기</button><button class="btn" id="bkIn">📥 가져오기</button></div><input type="file" id="bkFile" accept=".json,application/json" class="hide">' +
      '<button class="btn" id="bkDel">🗑 모든 기록 지우기</button>' +
      '<p class="note">마크삼식 헬스 기록 · 인터넷 없이 작동 · 회원가입·광고 없음. 운동·식단 기록은 휴대폰 안에만 저장되고 어디로도 보내지 않아요.</p>', function (sb) {
      sb.querySelector('#stX').onclick = closeSheet;
      sb.querySelectorAll('[data-sgym]').forEach(function (b) { b.onclick = function () { switchGym(b.dataset.sgym); openSettings(); }; });
      sb.querySelector('#stGym').onclick = gymSheet;
      sb.querySelectorAll('[data-rs]').forEach(function (b) { b.onclick = function () { S.rest = +b.dataset.rs; saveS(); openSettings(); }; });
      sb.querySelectorAll('[data-pp]').forEach(function (b) { b.onclick = function () { S.plates[b.dataset.pp] = !S.plates[b.dataset.pp]; saveS(); openSettings(); }; });
      sb.querySelector('#stKok').onclick = function () { S.kcal = parseInt(sb.querySelector('#stK').value) || 0; saveS(); toast('저장했어요'); };
      sb.querySelector('#bkOut').onclick = exportAll;
      sb.querySelector('#bkIn').onclick = function () { sb.querySelector('#bkFile').click(); };
      sb.querySelector('#bkFile').onchange = function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importAll(rd.result); }; rd.readAsText(f); };
      sb.querySelector('#bkDel').onclick = function () { if (confirmBox('운동·식단·바프 기록을 모두 지울까요? 되돌릴 수 없어요.')) { Object.keys(localStorage).filter(function (k) { return k.indexOf('pk_') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); location.reload(); } };
    });
  }
  function exportAll() {
    var o = { app: 'marksamsik-health', v: 1, at: new Date().toISOString(), data: {} };
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('pk_') === 0) o.data[k] = localStorage.getItem(k); }); } catch (e) { }
    var txt = JSON.stringify(o), name = '마크삼식헬스_백업_' + ymd().replace(/-/g, '') + '.json';
    S.lastBk = ymd(); saveS();
    if (NATIVE && KKA.saveFile) { KKA.saveFile(name, txt); return; }
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('📤 ' + name + ' 저장'); } catch (e) { copyText(txt); }
  }
  function importAll(txt) {
    try {
      var o = JSON.parse(txt); if (o.app !== 'marksamsik-health' || !o.data) throw 0;
      if (!confirmBox('백업을 불러오면 지금 기록을 덮어써요. 계속할까요?')) return;
      Object.keys(o.data).forEach(function (k) { if (k.indexOf('pk_') === 0) localStorage.setItem(k, o.data[k]); });
      location.reload();
    } catch (e) { toast('백업 파일을 읽지 못했어요'); }
  }

  /* ───────── 시작 ───────── */
  document.querySelectorAll('.nav button').forEach(function (b) { b.onclick = function () { closeSheet(); go(b.dataset.p); }; });
  $('setBtn').onclick = openSettings;
  $('micBtn').onclick = startVoice;
  $('restSkip').onclick = stopRest;
  $('undoB').onclick = function () { $('undo').classList.add('hide'); clearTimeout(undoT); if (undoFn) { var f = undoFn; undoFn = null; f(); } };
  $('restAdd').onclick = function () { if (REST) { REST.end += 30000; REST.done = false; $('rest').classList.remove('end'); tickRest(); if (NATIVE && KKA.restAlarm) try { KKA.restAlarm(Math.round((REST.end - Date.now()) / 1000)); } catch (e) { } } };
  window.kkBack = function () { if ($('sheet')) { closeSheet(); render(); return true; } if (PAGE !== 'wk') { go('wk'); return true; } return false; };
  setInterval(function () { if (CUR && !stale() && PAGE === 'wk') $('sub').textContent = mdw(ymd()) + ' · 운동 중 ' + elapsed(); }, 30000);
  go(PAGE);
  if (NATIVE && KKA.pageReady) try { KKA.pageReady(); } catch (e) { }
})();
