/*
 * game.js — SNAKE
 *
 * 32 x 18 그리드, 시작 길이 5, 길이 400 달성 시 승리.
 * 속도는 2.4칸/초에서 시작해 쥐 한 마리당 균일한 폭으로 올라 400칸에서 18칸/초에 도달한다.
 * 쥐를 먹을 때마다 Mice 1이 쌓이고, Mice로 상점에서 뱀 스킨을 살 수 있다.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------- 상수 */

  var COLS = 32, ROWS = 18, TILE = 32;
  var W = COLS * TILE, H = ROWS * TILE;

  var START_LEN = 5;
  var WIN_LEN = 400;

  var MIN_SPEED = 2.4;    // 시작 속도 (칸/초)
  var MAX_SPEED = 18;     // 승리 길이에서 도달하는 최고 속도 (칸/초)

  var COUNTDOWN = ['3', '2', '1', 'Go!'];
  var COUNT_MS = 700;
  var WANDER_MS = 140;
  var POP_MS = 190;       // 새 쥐가 튀어나오는 연출 길이

  var FONT = '"Trebuchet MS", "Malgun Gothic", "Segoe UI", sans-serif';

  var DIRS = {
    up:    { x:  0, y: -1 },
    down:  { x:  0, y:  1 },
    left:  { x: -1, y:  0 },
    right: { x:  1, y:  0 }
  };
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var DIR_NAMES = ['up', 'down', 'left', 'right'];

  // 방향키 + WASD, 한글 자판 상태(한/영 미전환)에서도 동작하도록 ㅈㅁㄴㅇ 포함
  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right',
    W: 'up', A: 'left', S: 'down', D: 'right',
    'ㅈ': 'up', 'ㅁ': 'left', 'ㄴ': 'down', 'ㅇ': 'right'
  };

  function mod(a, b) { return ((a % b) + b) % b; }

  /* -------------------------------------------------------- 뱀 스킨 */

  /*
   * 실제 뱀의 생김새를 반영한다.
   *   girth      — 몸통 굵기 배수 (아나콘다가 가장 굵다)
   *   headShape  — lance(창끝) / blunt(뭉툭) / narrow(길쭉)
   *   hood       — 목을 펼친 후드 (킹코브라)
   *   pupil      — round / slit
   *   bands      — 세그먼트 단위로 반복되는 띠 색
   * 무늬는 세그먼트마다 붙는 고유 번호(seq)를 기준으로 찍히므로,
   * 뱀이 길어져도 이미 그려진 무늬가 몸을 따라 흐르지 않는다.
   */
  var SKINS = [
    {
      id: 'calking', ko: '캘리포니아 킹스네이크', sci: 'Lampropeltis californiae', price: 0,
      pattern: 'bands',
      bands: ['#23252c', '#23252c', '#f0e8d6'],
      base: '#23252c', line: '#0b0c10', mark: '#f0e8d6',
      head: '#2a2c34', eye: '#c9b27a', pupil: 'round',
      girth: 0.95, headShape: 'lance',
      note: '검은 몸에 크림색 띠가 촘촘하게 감긴다.'
    },
    {
      id: 'milk', ko: '밀크스네이크', sci: 'Lampropeltis triangulum', price: 500,
      pattern: 'bands',
      bands: ['#c9302c', '#c9302c', '#2b2024', '#f2ece0', '#2b2024'],
      base: '#c9302c', line: '#120d0f', mark: '#f2ece0',
      head: '#2b2024', eye: '#d8b45c', pupil: 'round',
      girth: 0.92, headShape: 'lance',
      note: '빨강·검정·흰색 띠가 자로 잰 듯 균일하게 반복된다.'
    },
    {
      id: 'ball', ko: '볼파이톤', sci: 'Python regius', price: 700,
      pattern: 'ballblotch',
      base: '#4a3720', line: '#170f06', mark: '#d4ac52',
      head: '#57411f', eye: '#c08a3e', pupil: 'slit',
      girth: 1.14, headShape: 'blunt', markStep: 2,
      note: '굵고 짧은 몸에 황금빛 얼룩이 좌우로 번갈아 물린다.'
    },
    {
      id: 'anaconda', ko: '그린 아나콘다', sci: 'Eunectes murinus', price: 700,
      pattern: 'ovals',
      base: '#5c6b34', line: '#191e0d', mark: '#171b0c', mark2: '#d8c25a',
      head: '#67763c', eye: '#c8b25e', pupil: 'slit',
      girth: 1.28, headShape: 'blunt', markStep: 2,
      note: '가장 육중한 몸통. 올리브색 위에 검은 타원이 어긋나게 박힌다.'
    },
    {
      id: 'cobra', ko: '킹코브라', sci: 'Ophiophagus hannah', price: 1000,
      pattern: 'chevron',
      base: '#6b5c33', line: '#211a0c', mark: '#e9dfa6',
      head: '#7a6a3c', eye: '#b99a45', pupil: 'round',
      girth: 0.9, headShape: 'narrow', hood: true, hoodMark: '#e9dfa6',
      note: '목을 활짝 펼친 후드. 몸에는 옅은 갈매기 무늬가 이어진다.'
    }
  ];

  var DEFAULT_SKIN = 'calking';

  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }
  function skinExists(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return true;
    return false;
  }

  /* ------------------------------------------------------------- 저장 */

  function load(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) {}
  }

  var hiScore = parseInt(load('snake.hiscore', '0'), 10) || 0;
  // 예전 '은' 잔액이 있으면 Mice로 넘겨받는다
  var mice = parseInt(load('snake.mice', load('snake.silver', '0')), 10) || 0;

  var equipped = load('snake.skin', DEFAULT_SKIN);
  var owned;
  try { owned = JSON.parse(load('snake.owned', '[]')); } catch (e) { owned = []; }
  if (!Array.isArray(owned)) owned = [];
  owned = owned.filter(skinExists);
  if (owned.indexOf(DEFAULT_SKIN) < 0) owned.push(DEFAULT_SKIN);
  if (!skinExists(equipped) || owned.indexOf(equipped) < 0) equipped = DEFAULT_SKIN;

  function isOwned(id) { return owned.indexOf(id) >= 0; }
  function currentSkin() { return skinById(equipped); }

  /* ---------------------------------------------------------- DOM 참조 */

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var titleBtns = document.getElementById('titleBtns');
  var startBtn = document.getElementById('startBtn');
  var shopBtn = document.getElementById('shopBtn');
  var retryBtn = document.getElementById('retryBtn');
  var homeBtn = document.getElementById('homeBtn');
  var muteBtn = document.getElementById('muteBtn');
  var hiScoreEl = document.getElementById('hiScore');
  var miceEl = document.getElementById('silverSlot');
  var toWinEl = document.getElementById('toWin');
  var hint = document.getElementById('hint');
  var shopEl = document.getElementById('shop');
  var shopMiceEl = document.getElementById('shopSilver');
  var shopCloseBtn = document.getElementById('shopClose');
  var skinListEl = document.getElementById('skinList');

  /* ------------------------------------------------------------- 상태 */

  var state = 'title';          // title | countdown | playing | paused | win | lose
  var snake, dir, queue, food, eaten = 0, earned = 0, nextSeq = 0;
  var moveMs, moveAcc;
  var countdownIdx, countdownAcc;
  var wander, wanderAcc;
  var flash = 0;
  var now = 0, lastTs = 0;

  /* --------------------------------------------------------- 속도 곡선 */

  // 쥐 한 마리당 (MAX_SPEED - MIN_SPEED) / (WIN_LEN - START_LEN) 만큼 균일하게 빨라진다.
  function speedFor(len) {
    var t = (len - START_LEN) / (WIN_LEN - START_LEN);
    t = Math.max(0, Math.min(1, t));
    return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t;
  }

  function intervalFor(len) { return 1000 / speedFor(len); }
  function intensityFor(len) { return (speedFor(len) - MIN_SPEED) / (MAX_SPEED - MIN_SPEED); }

  /* ------------------------------------------------------------- HUD */

  function renderHud() {
    hiScoreEl.innerHTML = 'HI-SCORE <b>' + hiScore + '</b>';
    miceEl.innerHTML = '🐭 Mice <b>' + mice + '</b>';
    shopMiceEl.innerHTML = '🐭 Mice <b>' + mice + '</b>';

    // 남은 칸 수는 게임 중에만 의미가 있다
    toWinEl.classList.toggle('hidden', state === 'title');
    if (state !== 'title') {
      var len = snake ? snake.length : START_LEN;
      toWinEl.innerHTML = '승리까지 <b>' + Math.max(0, WIN_LEN - len) + '</b>';
    }
  }

  function finishRun() {
    earned = eaten;
    if (snake && snake.length > hiScore) {
      hiScore = snake.length;
      save('snake.hiscore', String(hiScore));
    }
    if (earned > 0) {
      mice += earned;
      save('snake.mice', String(mice));
    }
  }

  /* -------------------------------------------------------- 바닥 텍스처 */

  var ground = null;

  function buildGround() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');

    // 마른 흙밭 — 뱀 스킨(검정·빨강·황금·올리브·황갈)과 흰 쥐가 모두 뜨도록
    // 채도를 낮추고 충분히 어둡게 깐다.
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3a2f26');
    grad.addColorStop(0.55, '#2e251e');
    grad.addColorStop(1, '#241d18');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // 흙이 뭉친 자국
    for (var j = 0; j < 110; j++) {
      g.fillStyle = (j % 2) ? 'rgba(92,74,56,0.13)' : 'rgba(28,22,17,0.16)';
      g.beginPath();
      g.ellipse(Math.random() * W, Math.random() * H,
                Math.random() * 46 + 16, Math.random() * 26 + 10,
                Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }

    // 갈라진 골
    g.lineCap = 'round';
    for (var k = 0; k < 26; k++) {
      var x = Math.random() * W, y = Math.random() * H;
      g.strokeStyle = 'rgba(24,18,14,0.30)';
      g.lineWidth = Math.random() * 1.8 + 0.6;
      g.beginPath();
      g.moveTo(x, y);
      for (var seg = 0; seg < 4; seg++) {
        x += (Math.random() - 0.5) * 70;
        y += (Math.random() - 0.5) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }

    // 모래 알갱이와 잔돌
    var speck = ['rgba(146,120,92,0.16)', 'rgba(38,29,22,0.24)',
                 'rgba(178,152,118,0.10)', 'rgba(60,47,36,0.20)'];
    for (var i = 0; i < 2000; i++) {
      g.fillStyle = speck[i & 3];
      g.beginPath();
      g.arc(Math.random() * W, Math.random() * H, Math.random() * 2.2 + 0.4, 0, Math.PI * 2);
      g.fill();
    }
    for (var s2 = 0; s2 < 90; s2++) {
      var px = Math.random() * W, py = Math.random() * H, pr = Math.random() * 2.6 + 1.4;
      g.fillStyle = 'rgba(120,108,92,0.22)';
      g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(20,15,11,0.30)';
      g.beginPath(); g.arc(px + pr * 0.35, py + pr * 0.45, pr * 0.8, 0, Math.PI * 2); g.fill();
    }

    // 가장자리 그늘
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.26, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.46)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    return c;
  }

  /* ------------------------------------------------------- 뱀 그리기 */

  function dirAt(pts, i) {
    var a = pts[Math.max(0, i - 1)];
    var b = pts[Math.min(pts.length - 1, i + 1)];
    var dx = a[0] - b[0], dy = a[1] - b[1];
    var m = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / m, dy / m];
  }

  function bodyColor(sk, q) {
    return sk.bands ? sk.bands[mod(q, sk.bands.length)] : sk.base;
  }

  function drawMarks(g, pts, end, bw, sk, seqAt) {
    if (sk.pattern === 'bands' || end < 4) return;

    var step = sk.markStep || 3;

    for (var i = 2; i < end - 1; i++) {
      var q = seqAt(i);
      if (mod(q, step) !== 0) continue;

      var d = dirAt(pts, i);
      var side = mod(Math.floor(q / step), 2) ? 1 : -1;

      g.save();
      g.translate(pts[i][0], pts[i][1]);
      g.rotate(Math.atan2(d[1], d[0]));

      if (sk.pattern === 'chevron') {
        // 몸을 가로지르는 옅은 갈매기꼴 띠
        g.strokeStyle = sk.mark;
        g.globalAlpha = g.globalAlpha * 0.9;
        g.lineWidth = bw * 0.30;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(-bw * 0.16, -bw * 0.56);
        g.lineTo(bw * 0.14, 0);
        g.lineTo(-bw * 0.16, bw * 0.56);
        g.stroke();

      } else if (sk.pattern === 'ovals') {
        // 어긋나게 박힌 검은 타원 + 반대쪽 노란 테 반점
        g.fillStyle = sk.mark;
        g.beginPath();
        g.ellipse(0, side * bw * 0.13, TILE * 0.60, bw * 0.38, 0, 0, Math.PI * 2);
        g.fill();

        g.fillStyle = sk.mark2;
        g.beginPath(); g.arc(0, -side * bw * 0.40, bw * 0.115, 0, Math.PI * 2); g.fill();
        g.fillStyle = sk.mark;
        g.beginPath(); g.arc(0, -side * bw * 0.40, bw * 0.055, 0, Math.PI * 2); g.fill();

      } else if (sk.pattern === 'ballblotch') {
        // 좌우로 번갈아 물리는 황금 얼룩
        g.fillStyle = sk.mark;
        g.strokeStyle = sk.line;
        g.lineWidth = Math.max(1, bw * 0.09);
        g.beginPath();
        g.ellipse(0, side * bw * 0.12, TILE * 0.80, bw * 0.46, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();

        // 얼룩 사이로 드러나는 어두운 바탕 — 가운데가 살짝 잘록하다
        g.fillStyle = sk.base;
        g.beginPath();
        g.ellipse(0, side * bw * 0.62, TILE * 0.42, bw * 0.30, 0, 0, Math.PI * 2);
        g.fill();
      }

      g.restore();
    }
  }

  function drawHead(g, p, v, bw, sk, flick) {
    var shape = sk.headShape || 'lance';
    var L = bw * 1.55, B = bw * 1.06;
    if (shape === 'blunt')  { L = bw * 1.34; B = bw * 1.30; }
    if (shape === 'narrow') { L = bw * 1.74; B = bw * 0.98; }

    g.save();
    g.translate(p[0], p[1]);
    g.rotate(Math.atan2(v.y, v.x));

    // 활짝 펼친 후드 (킹코브라) — 머리 뒤로 넓게 벌어지는 방패꼴
    if (sk.hood) {
      g.beginPath();
      g.moveTo(L * 0.10, -B * 0.42);
      g.bezierCurveTo(-L * 0.28, -B * 1.02, -L * 0.90, -B * 0.98, -L * 1.55, -B * 0.34);
      g.quadraticCurveTo(-L * 1.66, 0, -L * 1.55, B * 0.34);
      g.bezierCurveTo(-L * 0.90, B * 0.98, -L * 0.28, B * 1.02, L * 0.10, B * 0.42);
      g.closePath();
      g.fillStyle = sk.head;
      g.fill();
      g.strokeStyle = sk.line;
      g.lineWidth = Math.max(1.6, bw * 0.11);
      g.stroke();

      // 킹코브라 특유의 갈매기 무늬 (스펙터클이 아니다)
      g.strokeStyle = sk.hoodMark;
      g.lineWidth = Math.max(1.6, bw * 0.15);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(-L * 1.18, -B * 0.52);
      g.lineTo(-L * 0.72, 0);
      g.lineTo(-L * 1.18, B * 0.52);
      g.stroke();
    }

    // 혀
    if (flick > 0.02) {
      var tl = L * (0.52 + 0.42 * flick);
      g.strokeStyle = '#ff4d6d';
      g.lineWidth = Math.max(1.4, bw * 0.09);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(L * 0.45, 0);
      g.lineTo(tl, 0);
      g.moveTo(tl, 0); g.lineTo(tl + L * 0.2 * flick, -B * 0.22 * flick);
      g.moveTo(tl, 0); g.lineTo(tl + L * 0.2 * flick, B * 0.22 * flick);
      g.stroke();
    }

    // 머리
    g.beginPath();
    g.moveTo(L * 0.54, 0);
    g.quadraticCurveTo(L * 0.44, -B * 0.46, L * 0.04, -B * 0.5);
    g.quadraticCurveTo(-L * 0.44, -B * 0.42, -L * 0.48, 0);
    g.quadraticCurveTo(-L * 0.44, B * 0.42, L * 0.04, B * 0.5);
    g.quadraticCurveTo(L * 0.44, B * 0.46, L * 0.54, 0);
    g.closePath();
    g.fillStyle = sk.head;
    g.fill();
    g.strokeStyle = sk.line;
    g.lineWidth = Math.max(1.5, bw * 0.11);
    g.stroke();

    // 눈
    for (var s = -1; s <= 1; s += 2) {
      var ex = L * 0.14, ey = s * B * 0.29;
      g.beginPath(); g.arc(ex, ey, bw * 0.165, 0, Math.PI * 2);
      g.fillStyle = sk.eye; g.fill();
      g.lineWidth = Math.max(1, bw * 0.05);
      g.strokeStyle = sk.line; g.stroke();

      g.fillStyle = '#150f09';
      g.beginPath();
      if (sk.pupil === 'round') g.arc(ex, ey, bw * 0.075, 0, Math.PI * 2);
      else g.ellipse(ex, ey, bw * 0.045, bw * 0.115, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.restore();
  }

  /*
   * 머리부터 꼬리까지 이어진 한 마리로 그린다.
   * pts: 픽셀 좌표 배열 (0번이 머리), o: { skin, width, alpha, headDir, seqs }
   */
  function paintSnake(g, pts, o) {
    var n = pts.length;
    if (!n) return;

    var sk = o.skin;
    var bw = o.width * (sk.girth || 1);
    var seqs = o.seqs;
    var seqAt = seqs ? function (i) { return seqs[i]; } : function (i) { return i; };
    var i, t;

    g.save();
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    var taperN = Math.min(11, Math.max(2, Math.floor(n * 0.22)));
    var end = Math.max(1, n - taperN);

    function pathTo(limit) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < limit; k++) g.lineTo(pts[k][0], pts[k][1]);
    }

    if (n > 1) {
      // 0) 바닥에 지는 그림자 — 흙바닥에서 몸이 확실히 떠 보이게 한다
      g.save();
      g.translate(2, 3);
      pathTo(end);
      g.strokeStyle = 'rgba(0,0,0,0.38)';
      g.lineWidth = bw + 7;
      g.stroke();
      g.restore();

      // 1) 외곽선
      pathTo(end);
      g.strokeStyle = sk.line;
      g.lineWidth = bw + 5;
      g.stroke();

      // 2) 몸통 — 띠 무늬는 색깔별로 묶어 한 번씩 칠한다.
      //    코너가 비지 않도록 바탕 관을 먼저 깔고, 띠는 butt 캡으로 얹어
      //    끝이 둥근 캡슐이 아니라 각진 사각 띠로 보이게 한다.
      if (sk.bands) {
        pathTo(end);
        g.strokeStyle = sk.base;
        g.lineWidth = bw;
        g.stroke();

        g.lineCap = 'butt';
        var groups = {};
        for (i = 0; i + 1 < end; i++) {
          var c = bodyColor(sk, seqAt(i));
          (groups[c] || (groups[c] = [])).push(i);
        }
        for (var col in groups) {
          g.beginPath();
          var arr = groups[col];
          for (var k2 = 0; k2 < arr.length; k2++) {
            var idx = arr[k2];
            g.moveTo(pts[idx][0], pts[idx][1]);
            g.lineTo(pts[idx + 1][0], pts[idx + 1][1]);
          }
          g.strokeStyle = col;
          g.lineWidth = bw;
          g.stroke();
        }
        g.lineCap = 'round';
      } else {
        pathTo(end);
        g.strokeStyle = sk.base;
        g.lineWidth = bw;
        g.stroke();
      }

      // 3) 광택 (무늬가 흐려지지 않도록 무늬보다 먼저)
      pathTo(end);
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = bw * 0.26;
      g.stroke();

      // 4) 무늬
      drawMarks(g, pts, end, bw, sk, seqAt);

      // 5) 꼬리 — 점점 가늘어진다 (외곽선 먼저, 그다음 몸통색)
      var from = end - 1, span = Math.max(1, (n - 1) - from);
      for (i = from; i < n - 1; i++) {
        t = (i - from) / span;
        g.beginPath();
        g.moveTo(pts[i][0], pts[i][1]);
        g.lineTo(pts[i + 1][0], pts[i + 1][1]);
        g.strokeStyle = sk.line;
        g.lineWidth = bw * (1 - t * 0.8) + 5;
        g.stroke();
      }
      for (i = from; i < n - 1; i++) {
        t = (i - from) / span;
        g.beginPath();
        g.moveTo(pts[i][0], pts[i][1]);
        g.lineTo(pts[i + 1][0], pts[i + 1][1]);
        g.strokeStyle = bodyColor(sk, seqAt(i));
        g.lineWidth = bw * (1 - t * 0.8);
        g.stroke();
      }
    }

    // 6) 머리
    var hv = o.headDir;
    if (!hv) {
      if (n > 1) {
        var dx = pts[0][0] - pts[1][0], dy = pts[0][1] - pts[1][1];
        var m = Math.sqrt(dx * dx + dy * dy) || 1;
        hv = { x: dx / m, y: dy / m };
      } else {
        hv = { x: 1, y: 0 };
      }
    }
    var flick = Math.max(0, Math.sin(now / 420) * 1.9 - 0.9);
    drawHead(g, pts[0], hv, bw, sk, Math.min(1, flick));

    g.restore();
  }

  function drawSnake(cells, alpha, headDir) {
    var pts = [], seqs = [];
    for (var i = 0; i < cells.length; i++) {
      pts.push([cells[i].x * TILE + TILE / 2, cells[i].y * TILE + TILE / 2]);
      seqs.push(cells[i].seq);
    }
    paintSnake(ctx, pts, {
      skin: currentSkin(),
      width: TILE * 0.68,
      alpha: alpha,
      headDir: DIRS[headDir],
      seqs: seqs
    });
  }

  /* --------------------------------------------------- 타이틀 배경 뱀 */

  function newWanderer() {
    var cells = [];
    var sx = 8 + Math.floor(Math.random() * 16);
    var sy = 4 + Math.floor(Math.random() * 10);
    var n = 13;
    for (var i = 0; i < n; i++) cells.push({ x: sx - i, y: sy, seq: n - i });
    return { cells: cells, dir: 'right', next: n + 1 };
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  function stepWanderer(w) {
    var head = w.cells[0];
    var opts = DIR_NAMES.filter(function (d) { return d !== OPP[w.dir]; });

    var choice = w.dir;
    if (Math.random() < 0.18) choice = opts[Math.floor(Math.random() * opts.length)];

    var nx = head.x + DIRS[choice].x;
    var ny = head.y + DIRS[choice].y;

    if (!inBounds(nx, ny)) {
      var safe = opts.filter(function (d) {
        return inBounds(head.x + DIRS[d].x, head.y + DIRS[d].y);
      });
      choice = safe.length ? safe[Math.floor(Math.random() * safe.length)] : w.dir;
      nx = head.x + DIRS[choice].x;
      ny = head.y + DIRS[choice].y;
    }

    w.dir = choice;
    w.cells.unshift({ x: nx, y: ny, seq: w.next++ });
    w.cells.pop();
  }

  /* --------------------------------------------------------- 게임 로직 */

  function resetGame() {
    var cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    snake = [];
    // 머리가 가장 큰 seq를 갖고 꼬리로 갈수록 줄어든다 → 무늬가 몸에 고정된다
    for (var i = 0; i < START_LEN; i++) {
      snake.push({ x: cx - i, y: cy, seq: START_LEN - i });
    }
    nextSeq = START_LEN + 1;
    dir = 'right';
    queue = [];
    eaten = 0;
    earned = 0;
    moveMs = intervalFor(snake.length);
    moveAcc = 0;
    food = spawnFood();
  }

  // 뱀의 머리/몸통이 없는 칸 중에서만 먹이 위치를 고른다.
  function spawnFood() {
    var taken = {};
    for (var i = 0; i < snake.length; i++) taken[snake[i].x + ',' + snake[i].y] = true;

    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!taken[x + ',' + y]) free.push({ x: x, y: y });
      }
    }
    if (!free.length) return null;

    var cell = free[Math.floor(Math.random() * free.length)];
    cell.face = Math.random() < 0.5 ? -1 : 1;   // 쥐가 바라보는 방향
    cell.born = now;                            // 등장 연출 기준 시각
    Chip.sfx('squeak');
    return cell;
  }

  function stepGame() {
    if (queue.length) dir = queue.shift();

    var head = snake[0];
    var d = DIRS[dir];
    var nx = head.x + d.x, ny = head.y + d.y;

    if (!inBounds(nx, ny)) { lose(); return; }

    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) { lose(); return; }
    }

    snake.unshift({ x: nx, y: ny, seq: nextSeq++ });

    if (food && nx === food.x && ny === food.y) {
      flash = 1;
      eaten++;
      Chip.sfx('eat');
      renderHud();
      if (snake.length >= WIN_LEN) { win(); return; }
      food = spawnFood();          // 같은 틱에 곧바로 다음 쥐가 나타난다
    } else {
      snake.pop();
    }

    moveMs = intervalFor(snake.length);
    Chip.setIntensity(intensityFor(snake.length));
  }

  /* ------------------------------------------------------- 화면 전환 */

  function setState(s) {
    state = s;
    titleBtns.classList.toggle('hidden', s !== 'title');
    retryBtn.classList.toggle('hidden', s !== 'lose');
    homeBtn.classList.toggle('hidden', s !== 'win');
    if (s !== 'title') closeShop();
    renderHud();
  }

  function goTitle() {
    wander = newWanderer();
    wanderAcc = 0;
    snake = null;
    Chip.setPaused(false);
    setState('title');
    Chip.play('title');
  }

  function startGame() {
    closeShop();
    resetGame();
    countdownIdx = 0;
    countdownAcc = 0;
    Chip.setPaused(false);
    Chip.setIntensity(0);
    setState('countdown');
    Chip.play('game');
  }

  function togglePause() {
    if (state === 'playing') {
      Chip.setPaused(true);
      setState('paused');
    } else if (state === 'paused') {
      Chip.setPaused(false);
      moveAcc = 0;
      setState('playing');
    }
  }

  function win() {
    finishRun();
    Chip.setPaused(false);
    setState('win');
    Chip.play('win');
  }

  function lose() {
    finishRun();
    Chip.setPaused(false);
    setState('lose');
    Chip.play('lose');
  }

  /* ------------------------------------------------------------ 루프 */

  function update(dt) {
    if (state === 'title') {
      wanderAcc += dt;
      while (wanderAcc >= WANDER_MS) {
        wanderAcc -= WANDER_MS;
        stepWanderer(wander);
      }
    } else if (state === 'countdown') {
      countdownAcc += dt;
      if (countdownAcc >= COUNT_MS) {
        countdownAcc -= COUNT_MS;
        countdownIdx++;
        if (countdownIdx >= COUNTDOWN.length) setState('playing');
      }
    } else if (state === 'playing') {
      moveAcc += dt;
      var guard = 0;
      while (state === 'playing' && moveAcc >= moveMs && guard++ < 20) {
        moveAcc -= moveMs;
        stepGame();
      }
    }

    if (flash > 0) flash = Math.max(0, flash - dt / 250);
  }

  function frame(ts) {
    now = ts;
    var dt = Math.min(100, ts - (lastTs || ts));
    lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ 렌더링 */

  function rrectOn(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawBg() {
    ctx.drawImage(ground, 0, 0);

    ctx.strokeStyle = 'rgba(255,236,205,0.030)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 1; x < COLS; x++) { ctx.moveTo(x * TILE + 0.5, 0); ctx.lineTo(x * TILE + 0.5, H); }
    for (var y = 1; y < ROWS; y++) { ctx.moveTo(0, y * TILE + 0.5); ctx.lineTo(W, y * TILE + 0.5); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(57,255,136,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  /* ------------------------------------------------------- 먹이: 쥐 */

  function drawMouse(f) {
    var s = TILE;
    var cx = f.x * s + s / 2;
    var cy = f.y * s + s / 2 + Math.sin(now / 320) * 0.9;
    var face = f.face || 1;

    var age = (now - (f.born || 0)) / POP_MS;
    var pop = age >= 1 ? 1 : 1 - Math.pow(1 - age, 3);
    var scale = 0.35 + 0.65 * pop;
    if (age < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - age) * 0.55;
      ctx.strokeStyle = '#ffd7e0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, s * (0.28 + age * 0.62), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(face * scale, scale);
    ctx.shadowColor = 'rgba(20,10,14,0.75)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    ctx.strokeStyle = '#e79cae';
    ctx.lineWidth = s * 0.055;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, s * 0.10);
    ctx.quadraticCurveTo(-s * 0.48, s * 0.14, -s * 0.44, -s * 0.10);
    ctx.stroke();

    ctx.fillStyle = '#c9d1dd';
    ctx.beginPath(); ctx.arc(s * 0.06, -s * 0.17, s * 0.115, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ff9fb2';
    ctx.beginPath(); ctx.arc(s * 0.07, -s * 0.16, s * 0.058, 0, Math.PI * 2); ctx.fill();

    ctx.shadowColor = 'rgba(20,10,14,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#e6ebf3';
    ctx.beginPath(); ctx.ellipse(-s * 0.04, s * 0.045, s * 0.235, s * 0.175, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.19, s * 0.055, s * 0.155, s * 0.135, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#161b22';
    ctx.beginPath(); ctx.arc(s * 0.20, s * 0.015, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6f8b';
    ctx.beginPath(); ctx.arc(s * 0.335, s * 0.085, s * 0.033, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(255,240,245,0.85)';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(s * 0.34, s * 0.07); ctx.lineTo(s * 0.49, s * 0.005);
    ctx.moveTo(s * 0.34, s * 0.11); ctx.lineTo(s * 0.50, s * 0.16);
    ctx.stroke();

    ctx.restore();
  }

  function text(str, x, y, size, color, glowColor) {
    ctx.save();
    ctx.font = 'bold ' + size + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glowColor !== 'none') {
      ctx.shadowColor = glowColor || 'rgba(57,255,136,0.75)';
      ctx.shadowBlur = size * 0.5;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  /* -------------------------------------------- 조작법 안내 (키 배지) */

  function tokenFont(tk, size) {
    ctx.font = (tk.key ? 'bold ' : '') + size + 'px ' + FONT;
  }

  function drawKeys(cxp, y, tokens, size) {
    var padX = size * 0.5, badgeH = size * 1.62, gap = size * 0.3;

    ctx.save();
    ctx.textBaseline = 'middle';

    var widths = [], total = 0, i, w;
    for (i = 0; i < tokens.length; i++) {
      tokenFont(tokens[i], size);
      w = tokens[i].key
        ? Math.max(badgeH * 0.95, ctx.measureText(tokens[i].key).width + padX * 2)
        : ctx.measureText(tokens[i].text).width;
      widths.push(w);
      total += w + (i ? gap : 0);
    }

    var x = cxp - total / 2;
    ctx.textAlign = 'center';

    for (i = 0; i < tokens.length; i++) {
      tokenFont(tokens[i], size);
      w = widths[i];
      if (tokens[i].key) {
        ctx.fillStyle = 'rgba(6,20,12,0.65)';
        ctx.strokeStyle = 'rgba(57,255,136,0.45)';
        ctx.lineWidth = 1.5;
        rrectOn(ctx, x, y - badgeH / 2, w, badgeH, size * 0.32);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(215,255,232,0.94)';
        ctx.fillText(tokens[i].key, x + w / 2, y + 1);
      } else {
        ctx.fillStyle = 'rgba(210,255,230,0.62)';
        ctx.fillText(tokens[i].text, x + w / 2, y + 1);
      }
      x += w + gap;
    }

    ctx.restore();
  }

  /* ------------------------------------------------- SNAKE 로고 (뱀 몸통) */

  var LETTERS = {
    S: [[[4, 0.9], [2.9, 0], [1.3, 0], [0.15, 1.05], [0.7, 2.35],
         [2.3, 2.95], [3.7, 3.5], [4, 4.8], [2.7, 5.95], [1.1, 6], [0, 5.1]]],
    N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
    A: [[[0.72, 3.9], [3.28, 3.9]], [[0, 6], [2, 0], [4, 6]]],
    K: [[[0, 0], [0, 6]], [[3.9, 0], [0.25, 3.05], [3.9, 6]]],
    E: [[[0.05, 3], [2.9, 3]], [[4, 0], [0.15, 0], [0, 3], [0, 6], [4, 6]]]
  };

  function drawLogo(cxp, cyp, s) {
    var word = 'SNAKE';
    var gap = 5.4;
    var totalW = (word.length - 1) * gap + 4;
    var ox = cxp - (totalW * s) / 2;
    var oy = cyp - (6 * s) / 2;

    var strokes = [];
    for (var i = 0; i < word.length; i++) {
      var polys = LETTERS[word.charAt(i)];
      for (var p = 0; p < polys.length; p++) {
        strokes.push(polys[p].map(function (pt) {
          return [ox + (i * gap + pt[0]) * s, oy + pt[1] * s];
        }));
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var w = s * 0.92;

    function strokeAll(color, width, blur, dash) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowBlur = blur || 0;
      ctx.shadowColor = blur ? 'rgba(57,255,136,0.85)' : 'transparent';
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (var k = 0; k < strokes.length; k++) {
        var pl = strokes[k];
        ctx.moveTo(pl[0][0], pl[0][1]);
        for (var m = 1; m < pl.length; m++) ctx.lineTo(pl[m][0], pl[m][1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    strokeAll('#04160c', w + 10, 0);
    strokeAll('#0f7f4a', w + 4, 0);
    strokeAll('#39ff88', w, 22);
    strokeAll('rgba(205,255,195,0.45)', w * 0.34, 0, [s * 0.34, s * 0.5]);

    var head = strokes[0][0];
    var hx = head[0] + s * 0.18, hy = head[1] - s * 0.20;

    ctx.shadowColor = 'rgba(57,255,136,0.9)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#b9ff5a';
    ctx.beginPath();
    ctx.ellipse(hx, hy, w * 0.80, w * 0.66, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#06130a';
    ctx.beginPath(); ctx.arc(hx + s * 0.26, hy - s * 0.22, w * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - s * 0.06, hy - s * 0.34, w * 0.13, 0, Math.PI * 2); ctx.fill();

    var flick = (Math.sin(now / 240) > 0.72) ? 1 : 0.4;
    var tx = hx + s * 0.62, ty = hy - s * 0.46;
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = Math.max(2, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.34, hy - s * 0.22);
    ctx.lineTo(tx, ty);
    ctx.moveTo(tx, ty); ctx.lineTo(tx + s * 0.44 * flick, ty - s * 0.22 * flick);
    ctx.moveTo(tx, ty); ctx.lineTo(tx + s * 0.44 * flick, ty + s * 0.10 * flick);
    ctx.stroke();

    var last = strokes[strokes.length - 1];
    var tp = last[last.length - 1], pp = last[last.length - 2];
    var ang = Math.atan2(tp[1] - pp[1], tp[0] - pp[0]);

    ctx.translate(tp[0], tp[1]);
    ctx.rotate(ang);
    ctx.fillStyle = '#0f9d58';
    ctx.shadowColor = 'rgba(57,255,136,0.7)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.5);
    ctx.lineTo(s * 1.2, 0);
    ctx.lineTo(0, w * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /* --------------------------------------------------------- draw() */

  function veil(a) {
    ctx.fillStyle = 'rgba(6,10,7,' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }

  // 스킨 5종을 실제 인게임 크기로 나란히 놓고 비교하는 화면 (SNAKE.sheet())
  var sheetMode = false;

  function drawSheet() {
    var rowH = H / SKINS.length;
    for (var s = 0; s < SKINS.length; s++) {
      var sk = SKINS[s];
      var yc = rowH * (s + 0.5);
      var pts = [], seqs = [];
      var n = Math.floor((W * 0.62) / TILE);
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        pts.push([W * 0.90 - i * TILE, yc + Math.sin(t * Math.PI * 2) * rowH * 0.20]);
        seqs.push(n - i);
      }
      paintSnake(ctx, pts, { skin: sk, width: TILE * 0.68, seqs: seqs });

      ctx.save();
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(220,255,235,0.85)';
      ctx.fillText(sk.ko, 14, yc - 10);
      ctx.font = 'italic 12px ' + FONT;
      ctx.fillStyle = 'rgba(200,255,225,0.45)';
      ctx.fillText(sk.sci, 14, yc + 8);
      ctx.restore();
    }
  }

  function draw() {
    drawBg();

    if (sheetMode) { drawSheet(); return; }

    if (state === 'title') {
      drawSnake(wander.cells, 0.5, wander.dir);
      veil(0.5);
      drawLogo(W / 2, H * 0.30, 27);

      drawKeys(W / 2, H * 0.565, [
        { key: 'W' }, { key: 'A' }, { key: 'S' }, { key: 'D' }, { text: '/' },
        { key: '←' }, { key: '↑' }, { key: '↓' }, { key: '→' }, { text: '  이동' }
      ], 19);

      drawKeys(W / 2, H * 0.675, [
        { key: 'ESC' }, { text: '  일시정지' }, { text: '  ' },
        { key: 'M' }, { text: '  배경음악 음량 (Mute · 1 · 2 · 3)' }
      ], 19);

    } else {
      if (food) drawMouse(food);
      drawSnake(snake, 1, dir);

      if (state === 'countdown') {
        veil(0.55);
        var label = COUNTDOWN[Math.min(countdownIdx, COUNTDOWN.length - 1)];
        var p = countdownAcc / COUNT_MS;
        text(label, W / 2, H * 0.45, 150 - p * 28,
             label === 'Go!' ? '#b9ff5a' : '#e8fff3');

      } else if (state === 'paused') {
        veil(0.68);
        text('PAUSED', W / 2, H * 0.42, 86, '#e8fff3');
        drawKeys(W / 2, H * 0.58, [{ key: 'ESC' }, { text: '  를 눌러 계속' }], 22);

      } else if (state === 'win') {
        veil(0.72);
        text('You Win!', W / 2, H * 0.32, 96, '#b9ff5a');
        text('SCORE ' + snake.length, W / 2, H * 0.455, 30,
             'rgba(210,255,230,0.85)', 'none');
        text('Mice +' + earned, W / 2, H * 0.545, 22,
             'rgba(255,222,150,0.85)', 'none');

      } else if (state === 'lose') {
        veil(0.72);
        text('Better Luck Next Time', W / 2, H * 0.32, 60, '#ff6b81',
             'rgba(255,59,92,0.75)');
        text('SCORE ' + snake.length + '   ·   승리까지 ' + Math.max(0, WIN_LEN - snake.length) + ' 남았습니다',
             W / 2, H * 0.455, 24, 'rgba(255,215,222,0.8)', 'none');
        text('Mice +' + earned, W / 2, H * 0.545, 22,
             'rgba(255,222,150,0.85)', 'none');
      }
    }

    if (flash > 0) {
      ctx.fillStyle = 'rgba(230,255,200,' + (flash * 0.09) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ------------------------------------------------------------- 상점 */

  var shopOpen = false;

  function paintPreview(cv, skin) {
    var g = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);

    // 카드 안에서 보기 좋은 비율 (인게임 실제 크기를 따르지는 않는다).
    // 띠 폭 / 몸통 굵기 비율만 인게임과 비슷하게 유지한다.
    var bw = h * 0.30 * (skin.girth || 1);
    var span = w * 0.76;
    var N = Math.max(7, Math.round(span / (bw * 1.35))) + 1;

    var pts = [];
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      pts.push([w * 0.86 - t * span, h * (0.5 + Math.sin(t * Math.PI * 2.1) * 0.135)]);
    }
    // headDir는 넘기지 않는다 — pts[0]과 pts[1]에서 바깥쪽 방향이 자동 계산된다.
    g.save();
    g.translate(skin.hood ? w * 0.03 : 0, 0);
    paintSnake(g, pts, { skin: skin, width: h * 0.24 });
    g.restore();
  }

  function renderShop() {
    skinListEl.innerHTML = '';

    SKINS.forEach(function (sk) {
      var card = document.createElement('div');
      card.className = 'skinCard'
        + (sk.id === equipped ? ' on' : '')
        + (isOwned(sk.id) ? '' : ' locked');

      var cv = document.createElement('canvas');
      cv.className = 'skinPreview';
      cv.width = 300; cv.height = 60;
      card.appendChild(cv);

      var name = document.createElement('div');
      name.className = 'skinName';
      name.textContent = sk.ko;
      card.appendChild(name);

      var foot = document.createElement('div');
      foot.className = 'skinFoot';

      var price = document.createElement('span');
      price.className = 'skinPrice' + (sk.price ? '' : ' free');
      price.textContent = sk.price ? ('🐭 ' + sk.price) : '기본 제공';
      foot.appendChild(price);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skinBtn';

      if (sk.id === equipped) {
        btn.textContent = '장착중';
        btn.classList.add('equipped');
        btn.disabled = true;
      } else if (isOwned(sk.id)) {
        btn.textContent = '장착';
        btn.classList.add('equip');
        btn.onclick = function () { equip(sk.id); };
      } else if (mice >= sk.price) {
        btn.textContent = '구매';
        btn.onclick = function () { buy(sk.id); };
      } else {
        btn.textContent = 'Mice 부족';
        btn.classList.add('poor');
        btn.onclick = function () {
          card.classList.remove('nope');
          void card.offsetWidth;
          card.classList.add('nope');
        };
      }

      foot.appendChild(btn);
      card.appendChild(foot);
      skinListEl.appendChild(card);

      paintPreview(cv, sk);
    });
  }

  function equip(id) {
    if (!isOwned(id)) return;
    equipped = id;
    save('snake.skin', equipped);
    renderShop();
  }

  function buy(id) {
    var sk = skinById(id);
    if (isOwned(id) || mice < sk.price) return;
    mice -= sk.price;
    owned.push(id);
    save('snake.mice', String(mice));
    save('snake.owned', JSON.stringify(owned));
    equip(id);
    renderHud();
  }

  function openShop() {
    if (state !== 'title') return;
    shopOpen = true;
    shopEl.classList.remove('hidden');
    renderHud();
    renderShop();
  }

  function closeShop() {
    if (!shopOpen) return;
    shopOpen = false;
    shopEl.classList.add('hidden');
  }

  /* ------------------------------------------------------------- 입력 */

  function hideHint() {
    if (hint && !hint.classList.contains('hidden')) hint.classList.add('hidden');
  }

  function wake() {
    Chip.unlock();
    hideHint();
  }

  var BGM_ICON = ['🔇', '🔈', '🔉', '🔊'];

  function syncBgmUi() {
    var lv = Chip.level();
    muteBtn.textContent = BGM_ICON[lv] + ' BGM ' + (lv === 0 ? 'Mute' : lv);
    muteBtn.classList.toggle('off', lv === 0);
  }

  // Mute -> 1 -> 2 -> 3 -> Mute
  function cycleBgm() {
    Chip.cycleLevel();
    syncBgmUi();
  }

  // 디버그: 승리 화면 검증용
  function debugGrow(n) {
    var tail = snake[snake.length - 1];
    for (var i = 0; i < n && snake.length < WIN_LEN - 1; i++) {
      snake.push({ x: tail.x, y: tail.y, seq: tail.seq - 1 - i });
    }
    moveMs = intervalFor(snake.length);
    Chip.setIntensity(intensityFor(snake.length));
    renderHud();
  }

  function debugWin() {
    var tail = snake[snake.length - 1];
    var k = 0;
    while (snake.length < WIN_LEN) snake.push({ x: tail.x, y: tail.y, seq: tail.seq - 1 - (k++) });
    win();
  }

  window.addEventListener('keydown', function (e) {
    wake();

    if (e.key === 'Escape') {
      e.preventDefault();
      if (shopOpen) { closeShop(); return; }
      togglePause();
      return;
    }

    if (e.key === 'm' || e.key === 'M' || e.key === 'ㅡ') { cycleBgm(); return; }
    if (shopOpen) return;

    if (state === 'playing' && e.shiftKey) {
      if (e.key === 'W' || e.key === 'w') { debugWin(); return; }
      if (e.key === 'L' || e.key === 'l') { lose(); return; }
    }
    if (state === 'playing' && e.key === '`') { debugGrow(50); return; }

    if (e.key === ' ' || e.key === 'Enter') {
      if (state === 'title') { e.preventDefault(); startGame(); return; }
      if (state === 'win' || state === 'lose') { e.preventDefault(); goTitle(); return; }
    }

    var d = KEYMAP[e.key];
    if (!d) return;
    e.preventDefault();
    if (state !== 'playing') return;

    // 진행 방향의 정반대 입력은 즉사로 이어지므로 무시한다.
    var lastDir = queue.length ? queue[queue.length - 1] : dir;
    if (d === lastDir || d === OPP[lastDir]) return;
    if (queue.length < 2) queue.push(d);
  });

  window.addEventListener('pointerdown', wake);

  startBtn.addEventListener('click', function () { wake(); startGame(); });
  shopBtn.addEventListener('click', function () { wake(); openShop(); });
  shopCloseBtn.addEventListener('click', function () { wake(); closeShop(); });
  retryBtn.addEventListener('click', function () { wake(); goTitle(); });
  homeBtn.addEventListener('click', function () { wake(); goTitle(); });
  muteBtn.addEventListener('click', function () { wake(); cycleBgm(); });

  /* ------------------------------------------------------------- 기동 */

  // 콘솔에서 상태·속도 곡선을 확인하기 위한 훅
  window.SNAKE = {
    state: function () {
      return {
        state: state,
        length: snake ? snake.length : 0,
        intervalMs: snake ? Math.round(intervalFor(snake.length) * 10) / 10 : null,
        cellsPerSec: snake ? Math.round(speedFor(snake.length) * 100) / 100 : null,
        toWin: snake ? Math.max(0, WIN_LEN - snake.length) : WIN_LEN - START_LEN,
        eaten: eaten,
        mice: mice,
        skin: equipped,
        owned: owned.slice(),
        head: snake ? { x: snake[0].x, y: snake[0].y, dir: dir } : null,
        food: food ? { x: food.x, y: food.y, born: food.born } : null
      };
    },
    curve: function (step) {
      var rows = [];
      for (var l = START_LEN; l <= WIN_LEN; l += (step || 50)) {
        rows.push({ length: l,
                    intervalMs: Math.round(intervalFor(l)),
                    cellsPerSec: Math.round(speedFor(l) * 100) / 100 });
      }
      return rows;
    },
    grantMice: function (n) {
      mice += n;
      save('snake.mice', String(mice));
      renderHud();
      if (shopOpen) renderShop();
      return mice;
    },
    skins: function () { return SKINS.map(function (s) { return s.id + ' / ' + s.ko + ' / ' + s.price; }); },
    // 스킨 5종을 인게임 크기로 나란히 비교 — SNAKE.sheet() 로 켜고 SNAKE.sheet(false) 로 끈다
    sheet: function (on) { sheetMode = (on !== false); return sheetMode; }
  };

  ground = buildGround();
  syncBgmUi();
  goTitle();
  requestAnimationFrame(frame);
})();
