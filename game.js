/*
 * game.js — SNAKE
 *
 * 32 x 18 그리드, 시작 길이 5, 길이 400 달성 시 승리.
 * 속도는 1.4칸/초에서 시작해 쥐 한 마리당 균일한 폭으로 올라 400칸에서 18칸/초에 도달한다.
 * 쥐를 먹을 때마다 은 1개가 쌓이고, 은으로 상점에서 뱀 스킨을 살 수 있다.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------- 상수 */

  var COLS = 32, ROWS = 18, TILE = 32;
  var W = COLS * TILE, H = ROWS * TILE;

  var START_LEN = 5;
  var WIN_LEN = 400;

  var MIN_SPEED = 1.4;    // 시작 속도 (칸/초)
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

  /* -------------------------------------------------------- 뱀 스킨 */

  // 실제 뱀을 모티브로 한 스킨. 가격은 인기도에 따라 500 / 700 / 1000.
  var SKINS = [
    {
      id: 'gtp', ko: '녹색나무비단뱀', sci: 'Morelia viridis', price: 0,
      pattern: 'spine',
      base: '#35d96a', line: '#0a3c1e', mark: '#eafff0', head: '#4ee885', eye: '#ffd45e',
      note: '선명한 잎사귀 초록에 등줄을 따라 흰 점이 흩뿌려진 기본 스킨.'
    },
    {
      id: 'garter', ko: '가터뱀', sci: 'Thamnophis sirtalis', price: 500,
      pattern: 'stripe',
      base: '#46592c', line: '#141c0c', mark: '#e9e05c', head: '#546b34', eye: '#e9e05c',
      note: '어두운 올리브 몸에 머리부터 꼬리까지 노란 세로줄이 흐른다.'
    },
    {
      id: 'corn', ko: '옥수수뱀', sci: 'Pantherophis guttatus', price: 700,
      pattern: 'saddle',
      base: '#e8834a', line: '#3d1a0c', mark: '#c9312b', head: '#ef9a63', eye: '#ffb36b',
      note: '주황 바탕 위에 검은 테를 두른 붉은 안장무늬가 이어진다.'
    },
    {
      id: 'milk', ko: '밀크스네이크', sci: 'Lampropeltis triangulum', price: 700,
      pattern: 'bands',
      bands: ['#d8232a', '#d8232a', '#15100f', '#f4efe6', '#15100f'],
      base: '#d8232a', line: '#120a0a', mark: '#f4efe6', head: '#e03a34', eye: '#ffd45e',
      note: '빨강·검정·흰색 띠가 규칙적으로 반복되는 고전적인 무늬.'
    },
    {
      id: 'albino', ko: '알비노 버미즈 파이톤', sci: 'Python bivittatus', price: 1000,
      pattern: 'blotch',
      base: '#fbf3dc', line: '#c2ab6d', mark: '#f5b23c', head: '#fffaea', eye: '#ff8f8f',
      note: '색소가 빠진 흰 바탕에 노란 얼룩이 번지듯 퍼진다.'
    },
    {
      id: 'diamondback', ko: '서부 다이아몬드방울뱀', sci: 'Crotalus atrox', price: 1000,
      pattern: 'diamond',
      base: '#9a8b6e', line: '#241f14', mark: '#efe6cf', head: '#a4957a', eye: '#e0c56b',
      note: '사막 모래빛 몸을 덮은 또렷한 다이아몬드 무늬.'
    }
  ];

  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
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
  var silver = parseInt(load('snake.silver', '0'), 10) || 0;
  var equipped = load('snake.skin', 'gtp');
  var owned;
  try { owned = JSON.parse(load('snake.owned', '["gtp"]')); } catch (e) { owned = ['gtp']; }
  if (!Array.isArray(owned) || owned.indexOf('gtp') < 0) owned = ['gtp'];
  if (owned.indexOf(equipped) < 0) equipped = 'gtp';

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
  var muteIcon = document.getElementById('muteIcon');
  var hiScoreEl = document.getElementById('hiScore');
  var silverEl = document.getElementById('silverSlot');
  var toWinEl = document.getElementById('toWin');
  var hint = document.getElementById('hint');
  var shopEl = document.getElementById('shop');
  var shopSilverEl = document.getElementById('shopSilver');
  var shopCloseBtn = document.getElementById('shopClose');
  var skinListEl = document.getElementById('skinList');

  /* ------------------------------------------------------------- 상태 */

  var state = 'title';          // title | countdown | playing | paused | win | lose
  var snake, dir, queue, food, eaten = 0, earned = 0;
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
    silverEl.innerHTML = '🪙 은 <b>' + silver + '</b>';
    var len = (state === 'title' || !snake) ? START_LEN : snake.length;
    toWinEl.innerHTML = '승리까지 <b>' + Math.max(0, WIN_LEN - len) + '</b>';
    shopSilverEl.innerHTML = '🪙 은 <b>' + silver + '</b>';
  }

  function finishRun() {
    earned = eaten;
    if (snake && snake.length > hiScore) {
      hiScore = snake.length;
      save('snake.hiscore', String(hiScore));
    }
    if (earned > 0) {
      silver += earned;
      save('snake.silver', String(silver));
    }
  }

  /* -------------------------------------------------------- 바닥 텍스처 */

  var ground = null;

  function buildGround() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');

    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#28331f');
    grad.addColorStop(0.55, '#1e2a1c');
    grad.addColorStop(1, '#151f16');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // 이끼 패치
    for (var j = 0; j < 90; j++) {
      g.fillStyle = (j % 3 === 0) ? 'rgba(88,116,62,0.10)' : 'rgba(52,40,26,0.12)';
      g.beginPath();
      g.ellipse(Math.random() * W, Math.random() * H,
                Math.random() * 40 + 14, Math.random() * 24 + 9,
                Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }

    // 흙 알갱이
    var speck = ['rgba(112,134,86,0.13)', 'rgba(62,46,30,0.18)',
                 'rgba(146,160,116,0.09)', 'rgba(30,42,28,0.20)'];
    for (var i = 0; i < 1600; i++) {
      g.fillStyle = speck[i & 3];
      g.beginPath();
      g.arc(Math.random() * W, Math.random() * H, Math.random() * 2.4 + 0.4, 0, Math.PI * 2);
      g.fill();
    }

    // 가장자리 그늘
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.24, W / 2, H / 2, H * 0.92);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
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

  function bodyColor(sk, i) {
    return sk.bands ? sk.bands[i % sk.bands.length] : sk.base;
  }

  function drawMarks(g, pts, end, bw, sk) {
    if (sk.pattern === 'bands' || end < 4) return;

    var i, d, ang;

    if (sk.pattern === 'stripe') {
      // 등을 따라 흐르는 세로줄 + 옆구리 반점
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < end; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokeStyle = sk.mark;
      g.lineWidth = bw * 0.22;
      g.stroke();

      for (i = 2; i < end - 1; i += 2) {
        d = dirAt(pts, i);
        g.save();
        g.translate(pts[i][0], pts[i][1]);
        g.rotate(Math.atan2(d[1], d[0]));
        g.fillStyle = 'rgba(233,224,92,0.55)';
        g.beginPath(); g.arc(0, -bw * 0.33, bw * 0.09, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(0, bw * 0.33, bw * 0.09, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      return;
    }

    var step = (sk.pattern === 'spine') ? 3 : (sk.pattern === 'blotch' ? 3 : 4);

    for (i = 2; i < end - 1; i += step) {
      d = dirAt(pts, i);
      ang = Math.atan2(d[1], d[0]);
      g.save();
      g.translate(pts[i][0], pts[i][1]);
      g.rotate(ang);

      if (sk.pattern === 'spine') {
        // 등줄을 따라 끊긴 흰 마름모 + 옆으로 흩뿌려진 작은 반점
        var r = bw * 0.21;
        g.fillStyle = sk.mark;
        g.beginPath();
        g.moveTo(r * 1.6, 0); g.lineTo(0, -r); g.lineTo(-r * 1.6, 0); g.lineTo(0, r);
        g.closePath(); g.fill();

        var a0 = g.globalAlpha;
        g.globalAlpha = a0 * 0.6;
        g.beginPath(); g.arc(-bw * 0.42, -bw * 0.26, bw * 0.075, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(bw * 0.42, bw * 0.26, bw * 0.075, 0, Math.PI * 2); g.fill();
        g.globalAlpha = a0;

      } else if (sk.pattern === 'saddle') {
        g.fillStyle = sk.mark;
        g.strokeStyle = sk.line;
        g.lineWidth = Math.max(1, bw * 0.07);
        rrectOn(g, -TILE * 0.72, -bw * 0.44, TILE * 1.44, bw * 0.88, bw * 0.3);
        g.fill(); g.stroke();

      } else if (sk.pattern === 'diamond') {
        g.fillStyle = sk.mark;
        g.strokeStyle = sk.line;
        g.lineWidth = Math.max(1, bw * 0.07);
        g.beginPath();
        g.moveTo(TILE * 0.85, 0); g.lineTo(0, -bw * 0.44);
        g.lineTo(-TILE * 0.85, 0); g.lineTo(0, bw * 0.44);
        g.closePath(); g.fill(); g.stroke();

      } else if (sk.pattern === 'blotch') {
        var wob = 0.72 + ((i * 37) % 11) / 22;      // i에 따라 결정되는 크기 변화
        g.fillStyle = sk.mark;
        g.beginPath();
        g.ellipse(0, 0, TILE * 0.66 * wob, bw * 0.42 * wob, 0, 0, Math.PI * 2);
        g.fill();
      }

      g.restore();
    }
  }

  function drawHead(g, p, v, bw, sk, flick) {
    var L = bw * 1.55, B = bw * 1.06;

    g.save();
    g.translate(p[0], p[1]);
    g.rotate(Math.atan2(v.y, v.x));

    // 혀 (머리 아래에 깔아 앞으로 뻗는다)
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

    // 창끝 모양 머리
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

    // 눈 — 홍채 + 세로 동공
    for (var s = -1; s <= 1; s += 2) {
      var ex = L * 0.14, ey = s * B * 0.29;
      g.beginPath(); g.arc(ex, ey, bw * 0.165, 0, Math.PI * 2);
      g.fillStyle = sk.eye; g.fill();
      g.lineWidth = Math.max(1, bw * 0.05);
      g.strokeStyle = sk.line; g.stroke();

      g.beginPath(); g.ellipse(ex, ey, bw * 0.045, bw * 0.115, 0, 0, Math.PI * 2);
      g.fillStyle = '#150f09'; g.fill();
    }

    g.restore();
  }

  /*
   * 이어진 한 마리로 그린다.
   * pts: 픽셀 좌표 배열 (0번이 머리), o: { skin, width, alpha, headDir }
   */
  function paintSnake(g, pts, o) {
    var n = pts.length;
    if (!n) return;

    var sk = o.skin, bw = o.width;
    var i, t;

    g.save();
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    var taperN = Math.min(11, Math.max(2, Math.floor(n * 0.22)));
    var end = Math.max(1, n - taperN);          // 몸통 구간의 끝 인덱스

    function pathTo(limit) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < limit; k++) g.lineTo(pts[k][0], pts[k][1]);
    }

    if (n > 1) {
      // 1) 외곽선
      pathTo(end);
      g.strokeStyle = sk.line;
      g.lineWidth = bw + 5;
      g.stroke();

      // 2) 몸통 — 밴드 무늬는 색깔별로 묶어 한 번씩 칠한다
      if (sk.bands) {
        var groups = {};
        for (i = 0; i + 1 < end; i++) {
          var c = bodyColor(sk, i);
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
      } else {
        pathTo(end);
        g.strokeStyle = sk.base;
        g.lineWidth = bw;
        g.stroke();
      }

      // 3) 광택 (무늬가 흐려지지 않도록 무늬보다 먼저 깐다)
      pathTo(end);
      g.strokeStyle = 'rgba(255,255,255,0.11)';
      g.lineWidth = bw * 0.26;
      g.stroke();

      // 4) 무늬
      drawMarks(g, pts, end, bw, sk);

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
        g.strokeStyle = bodyColor(sk, i);
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

  function cellsToPts(cells) {
    var pts = [];
    for (var i = 0; i < cells.length; i++) {
      pts.push([cells[i].x * TILE + TILE / 2, cells[i].y * TILE + TILE / 2]);
    }
    return pts;
  }

  function drawSnake(cells, alpha, headDir) {
    paintSnake(ctx, cellsToPts(cells), {
      skin: currentSkin(),
      width: TILE * 0.68,
      alpha: alpha,
      headDir: DIRS[headDir]
    });
  }

  /* --------------------------------------------------- 타이틀 배경 뱀 */

  function newWanderer() {
    var cells = [];
    var sx = 8 + Math.floor(Math.random() * 16);
    var sy = 4 + Math.floor(Math.random() * 10);
    for (var i = 0; i < 11; i++) cells.push({ x: sx - i, y: sy });
    return { cells: cells, dir: 'right' };
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
    w.cells.unshift({ x: nx, y: ny });
    w.cells.pop();
  }

  /* --------------------------------------------------------- 게임 로직 */

  function resetGame() {
    var cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    snake = [];
    for (var i = 0; i < START_LEN; i++) snake.push({ x: cx - i, y: cy });
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

    snake.unshift({ x: nx, y: ny });

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

    ctx.strokeStyle = 'rgba(255,255,255,0.032)';
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
    var cy = f.y * s + s / 2 + Math.sin(now / 320) * 0.9;   // 숨 쉬듯 들썩인다
    var face = f.face || 1;

    // 등장 연출 — 튀어나오면서 파문이 퍼진다
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

    // 꼬리
    ctx.strokeStyle = '#e79cae';
    ctx.lineWidth = s * 0.055;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, s * 0.10);
    ctx.quadraticCurveTo(-s * 0.48, s * 0.14, -s * 0.44, -s * 0.10);
    ctx.stroke();

    // 귀
    ctx.fillStyle = '#c9d1dd';
    ctx.beginPath(); ctx.arc(s * 0.06, -s * 0.17, s * 0.115, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ff9fb2';
    ctx.beginPath(); ctx.arc(s * 0.07, -s * 0.16, s * 0.058, 0, Math.PI * 2); ctx.fill();

    // 몸통 + 머리
    ctx.shadowColor = 'rgba(20,10,14,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#e6ebf3';
    ctx.beginPath(); ctx.ellipse(-s * 0.04, s * 0.045, s * 0.235, s * 0.175, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.19, s * 0.055, s * 0.155, s * 0.135, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 눈 · 코
    ctx.fillStyle = '#161b22';
    ctx.beginPath(); ctx.arc(s * 0.20, s * 0.015, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6f8b';
    ctx.beginPath(); ctx.arc(s * 0.335, s * 0.085, s * 0.033, 0, Math.PI * 2); ctx.fill();

    // 수염
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

  function draw() {
    drawBg();

    if (state === 'title') {
      drawSnake(wander.cells, 0.42, wander.dir);
      veil(0.5);
      drawLogo(W / 2, H * 0.30, 27);

      drawKeys(W / 2, H * 0.565, [
        { key: 'W' }, { key: 'A' }, { key: 'S' }, { key: 'D' }, { text: '/' },
        { key: '←' }, { key: '↑' }, { key: '↓' }, { key: '→' }, { text: '  이동' }
      ], 19);

      drawKeys(W / 2, H * 0.675, [
        { key: 'ESC' }, { text: '  일시정지' }, { text: '  ' },
        { key: 'M' }, { text: '  배경음악 On / Off' }
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
        text('은 +' + earned + ' 획득', W / 2, H * 0.545, 22,
             'rgba(255,222,150,0.85)', 'none');

      } else if (state === 'lose') {
        veil(0.72);
        text('Better Luck Next Time', W / 2, H * 0.32, 60, '#ff6b81',
             'rgba(255,59,92,0.75)');
        text('SCORE ' + snake.length + '   ·   승리까지 ' + Math.max(0, WIN_LEN - snake.length) + ' 남았습니다',
             W / 2, H * 0.455, 24, 'rgba(255,215,222,0.8)', 'none');
        text('은 +' + earned + ' 획득', W / 2, H * 0.545, 22,
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

  function previewPts(w, h) {
    var pts = [], N = 30;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      pts.push([w * (0.87 - t * 0.76), h * (0.5 + Math.sin(t * Math.PI * 2.15) * 0.24)]);
    }
    return pts;
  }

  function paintPreview(cv, skin) {
    var g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    // headDir는 넘기지 않는다 — pts[0]과 pts[1]에서 바깥쪽 방향이 자동으로 계산된다.
    paintSnake(g, previewPts(cv.width, cv.height), {
      skin: skin,
      width: cv.height * 0.30
    });
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
      cv.width = 300; cv.height = 74;
      card.appendChild(cv);

      var name = document.createElement('div');
      name.className = 'skinName';
      name.textContent = sk.ko;
      card.appendChild(name);

      var sci = document.createElement('div');
      sci.className = 'skinSci';
      sci.textContent = sk.sci;
      card.appendChild(sci);

      var note = document.createElement('div');
      note.className = 'skinNote';
      note.textContent = sk.note;
      card.appendChild(note);

      var foot = document.createElement('div');
      foot.className = 'skinFoot';

      var price = document.createElement('span');
      price.className = 'skinPrice' + (sk.price ? '' : ' free');
      price.textContent = sk.price ? ('🪙 ' + sk.price) : '기본 제공';
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
      } else if (silver >= sk.price) {
        btn.textContent = '구매';
        btn.onclick = function () { buy(sk.id); };
      } else {
        btn.textContent = '은 부족';
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
    if (isOwned(id) || silver < sk.price) return;
    silver -= sk.price;
    owned.push(id);
    save('snake.silver', String(silver));
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

  function syncMuteUi() {
    var m = Chip.isMuted();
    muteIcon.textContent = m ? '🔇' : '🔊';
    muteBtn.classList.toggle('off', m);
  }

  function toggleMute() {
    Chip.toggleMute();
    syncMuteUi();
  }

  // 디버그: 승리 화면 검증용
  function debugGrow(n) {
    var tail = snake[snake.length - 1];
    for (var i = 0; i < n && snake.length < WIN_LEN - 1; i++) {
      snake.push({ x: tail.x, y: tail.y });
    }
    moveMs = intervalFor(snake.length);
    Chip.setIntensity(intensityFor(snake.length));
    renderHud();
  }

  function debugWin() {
    var tail = snake[snake.length - 1];
    while (snake.length < WIN_LEN) snake.push({ x: tail.x, y: tail.y });
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

    if (e.key === 'm' || e.key === 'M' || e.key === 'ㅡ') { toggleMute(); return; }
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
  muteBtn.addEventListener('click', function () { wake(); toggleMute(); });

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
        silver: silver,
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
    grantSilver: function (n) {
      silver += n;
      save('snake.silver', String(silver));
      renderHud();
      if (shopOpen) renderShop();
      return silver;
    }
  };

  ground = buildGround();
  syncMuteUi();
  goTitle();
  requestAnimationFrame(frame);
})();
