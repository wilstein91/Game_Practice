/*
 * game.js — SNAKE
 *
 * 32 x 18 그리드, 시작 길이 5, 길이 355 달성 시 승리.
 * 속도는 1.4칸/초에서 시작해 먹이 하나당 균일한 폭으로 올라 355칸에서 18칸/초에 도달한다.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------- 상수 */

  var COLS = 32, ROWS = 18, TILE = 32;
  var W = COLS * TILE, H = ROWS * TILE;

  var START_LEN = 5;
  var WIN_LEN = 355;

  var MIN_SPEED = 1.4;    // 시작 속도 (칸/초)
  var MAX_SPEED = 18;     // 승리 길이에서 도달하는 최고 속도 (칸/초)

  var COUNTDOWN = ['3', '2', '1', 'Go!'];
  var COUNT_MS = 700;
  var WANDER_MS = 140;

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

  var COL_HEAD = [185, 255, 110];
  var COL_TAIL = [13, 110, 74];

  /* ---------------------------------------------------------- DOM 참조 */

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var startBtn = document.getElementById('startBtn');
  var retryBtn = document.getElementById('retryBtn');
  var homeBtn = document.getElementById('homeBtn');
  var muteBtn = document.getElementById('muteBtn');
  var muteIcon = document.getElementById('muteIcon');
  var hiScoreEl = document.getElementById('hiScore');
  var toWinEl = document.getElementById('toWin');
  var hint = document.getElementById('hint');

  /* ------------------------------------------------------------- 상태 */

  var state = 'title';          // title | countdown | playing | paused | win | lose
  var snake, dir, queue, food;
  var moveMs, moveAcc;
  var countdownIdx, countdownAcc;
  var wander, wanderAcc;
  var flash = 0;
  var now = 0, lastTs = 0;

  var hiScore = 0;
  try { hiScore = parseInt(window.localStorage.getItem('snake.hiscore'), 10) || 0; } catch (e) {}

  /* --------------------------------------------------------- 속도 곡선 */

  // 먹이 하나당 (MAX_SPEED - MIN_SPEED) / (WIN_LEN - START_LEN) 만큼 균일하게 빨라진다.
  function speedFor(len) {
    var t = (len - START_LEN) / (WIN_LEN - START_LEN);
    t = Math.max(0, Math.min(1, t));
    return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t;
  }

  function intervalFor(len) { return 1000 / speedFor(len); }

  function intensityFor(len) {
    return (speedFor(len) - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  }

  /* ------------------------------------------------------------- HUD */

  function renderHud() {
    hiScoreEl.innerHTML = 'HI-SCORE <b>' + hiScore + '</b>';
    var len = (state === 'title' || !snake) ? START_LEN : snake.length;
    toWinEl.innerHTML = '승리까지 <b>' + Math.max(0, WIN_LEN - len) + '</b>';
  }

  function recordScore() {
    if (snake && snake.length > hiScore) {
      hiScore = snake.length;
      try { window.localStorage.setItem('snake.hiscore', String(hiScore)); } catch (e) {}
    }
  }

  /* --------------------------------------------------- 타이틀 배경 뱀 */

  function newWanderer() {
    var cells = [];
    var sx = 8 + Math.floor(Math.random() * 16);
    var sy = 4 + Math.floor(Math.random() * 10);
    for (var i = 0; i < 9; i++) cells.push({ x: sx - i, y: sy });
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
      Chip.sfx('eat');
      renderHud();
      if (snake.length >= WIN_LEN) { win(); return; }
      food = spawnFood();
    } else {
      snake.pop();
    }

    moveMs = intervalFor(snake.length);
    Chip.setIntensity(intensityFor(snake.length));
  }

  /* ------------------------------------------------------- 화면 전환 */

  function setState(s) {
    state = s;
    startBtn.classList.toggle('hidden', s !== 'title');
    retryBtn.classList.toggle('hidden', s !== 'lose');
    homeBtn.classList.toggle('hidden', s !== 'win');
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
    recordScore();
    Chip.setPaused(false);
    setState('win');
    Chip.play('win');
  }

  function lose() {
    recordScore();
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

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function mix(a, b, t) {
    return 'rgb(' +
      Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  function drawBg() {
    ctx.fillStyle = '#080b0f';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(57,255,136,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 1; x < COLS; x++) { ctx.moveTo(x * TILE + 0.5, 0); ctx.lineTo(x * TILE + 0.5, H); }
    for (var y = 1; y < ROWS; y++) { ctx.moveTo(0, y * TILE + 0.5); ctx.lineTo(W, y * TILE + 0.5); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(57,255,136,0.30)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  function drawSnake(cells, alpha, headDir) {
    var n = cells.length;
    var glow = n <= 60;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(57,255,136,0.75)';

    for (var i = n - 1; i >= 0; i--) {
      var c = cells[i];
      var t = n > 1 ? Math.min(1, (i / (n - 1)) * 1.25) : 0;
      var pad = 2 + t * 1.6;
      ctx.shadowBlur = (i === 0) ? 18 : (glow ? 7 : 0);
      ctx.fillStyle = mix(COL_HEAD, COL_TAIL, t);
      rrect(c.x * TILE + pad, c.y * TILE + pad, TILE - pad * 2, TILE - pad * 2, 7);
      ctx.fill();
    }
    ctx.restore();

    drawEyes(cells[0], headDir, alpha);
  }

  function drawEyes(c, d, alpha) {
    var v = DIRS[d] || DIRS.right;
    var cx = c.x * TILE + TILE / 2, cy = c.y * TILE + TILE / 2;
    var fx = v.x * TILE * 0.17, fy = v.y * TILE * 0.17;
    var sx = -v.y * TILE * 0.19, sy = v.x * TILE * 0.19;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#06130a';
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.arc(cx + fx + sx * s, cy + fy + sy * s, TILE * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------- 먹이: 쥐 */

  function drawMouse(f) {
    var s = TILE;
    var cx = f.x * s + s / 2;
    var cy = f.y * s + s / 2 + Math.sin(now / 320) * 0.9;   // 살짝 들썩이는 숨결
    var face = f.face || 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(face, 1);
    ctx.shadowColor = 'rgba(255,170,190,0.55)';
    ctx.shadowBlur = 12;

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
    ctx.fillStyle = '#ff9fb2';
    ctx.beginPath(); ctx.arc(s * 0.07, -s * 0.16, s * 0.058, 0, Math.PI * 2); ctx.fill();

    // 몸통 + 머리
    ctx.shadowColor = 'rgba(255,170,190,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#dfe5ee';
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
        ctx.fillStyle = 'rgba(57,255,136,0.10)';
        ctx.strokeStyle = 'rgba(57,255,136,0.42)';
        ctx.lineWidth = 1.5;
        rrect(x, y - badgeH / 2, w, badgeH, size * 0.32);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(210,255,230,0.92)';
        ctx.fillText(tokens[i].key, x + w / 2, y + 1);
      } else {
        ctx.fillStyle = 'rgba(200,255,225,0.55)';
        ctx.fillText(tokens[i].text, x + w / 2, y + 1);
      }
      x += w + gap;
    }

    ctx.restore();
  }

  /* ------------------------------------------------- SNAKE 로고 (뱀 몸통) */

  // 각 글자를 0..4 x 0..6 좌표계의 꺾은선으로 정의한다.
  // 첫 획의 시작점에 머리가, 마지막 획의 끝점에 꼬리가 붙는다.
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

    strokeAll('#04160c', w + 10, 0);                        // 외곽선
    strokeAll('#0f7f4a', w + 4, 0);                         // 어두운 몸통
    strokeAll('#39ff88', w, 22);                            // 네온 몸통
    strokeAll('rgba(205,255,195,0.45)', w * 0.34, 0,        // 비늘 하이라이트
              [s * 0.34, s * 0.5]);

    // ── 머리 (S 획의 시작점)
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

    // 갈라진 혀 (가끔 날름거린다)
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

    // ── 꼬리 (E 획의 끝점에서 뾰족하게 빠진다)
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
    ctx.fillStyle = 'rgba(8,11,15,' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    drawBg();

    if (state === 'title') {
      drawSnake(wander.cells, 0.30, wander.dir);
      veil(0.55);
      drawLogo(W / 2, H * 0.30, 27);

      drawKeys(W / 2, H * 0.565, [
        { key: 'W' }, { key: 'A' }, { key: 'S' }, { key: 'D' }, { text: '/' },
        { key: '←' }, { key: '↑' }, { key: '↓' }, { key: '→' }, { text: '  이동' }
      ], 19);

      drawKeys(W / 2, H * 0.675, [
        { key: 'ESC' }, { text: '  일시정지' }, { text: '  ' },
        { key: 'M' }, { text: '  배경음악 On / Off' }
      ], 19);

    } else {
      if (food) drawMouse(food);
      drawSnake(snake, 1, dir);

      if (state === 'countdown') {
        veil(0.6);
        var label = COUNTDOWN[Math.min(countdownIdx, COUNTDOWN.length - 1)];
        var p = countdownAcc / COUNT_MS;
        text(label, W / 2, H * 0.45, 150 - p * 28,
             label === 'Go!' ? '#b9ff5a' : '#e8fff3');

      } else if (state === 'paused') {
        veil(0.7);
        text('PAUSED', W / 2, H * 0.42, 86, '#e8fff3');
        drawKeys(W / 2, H * 0.58, [{ key: 'ESC' }, { text: '  를 눌러 계속' }], 22);

      } else if (state === 'win') {
        veil(0.72);
        text('You Win!', W / 2, H * 0.34, 96, '#b9ff5a');
        text('LENGTH ' + snake.length, W / 2, H * 0.48, 26,
             'rgba(200,255,225,0.75)', 'none');

      } else if (state === 'lose') {
        veil(0.72);
        text('Better Luck Next Time', W / 2, H * 0.34, 60, '#ff6b81',
             'rgba(255,59,92,0.75)');
        text('LENGTH ' + snake.length + '   ·   승리까지 ' + Math.max(0, WIN_LEN - snake.length) + ' 남았습니다',
             W / 2, H * 0.48, 24, 'rgba(255,205,215,0.75)', 'none');
      }
    }

    if (flash > 0) {
      ctx.fillStyle = 'rgba(185,255,110,' + (flash * 0.10) + ')';
      ctx.fillRect(0, 0, W, H);
    }
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
      togglePause();
      return;
    }

    if (e.key === 'm' || e.key === 'M' || e.key === 'ㅡ') { toggleMute(); return; }

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
  retryBtn.addEventListener('click', function () { wake(); goTitle(); });
  homeBtn.addEventListener('click', function () { wake(); goTitle(); });
  muteBtn.addEventListener('click', function () { wake(); toggleMute(); });

  /* ------------------------------------------------------------- 기동 */

  // 콘솔에서 속도 곡선을 확인·검증하기 위한 훅
  window.SNAKE = {
    state: function () {
      return {
        state: state,
        length: snake ? snake.length : 0,
        intervalMs: snake ? Math.round(intervalFor(snake.length) * 10) / 10 : null,
        cellsPerSec: snake ? Math.round(speedFor(snake.length) * 100) / 100 : null,
        toWin: snake ? Math.max(0, WIN_LEN - snake.length) : WIN_LEN - START_LEN
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
    }
  };

  syncMuteUi();
  goTitle();
  requestAnimationFrame(frame);
})();
