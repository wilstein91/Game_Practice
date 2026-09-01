/*
 * audio.js — 8비트 칩튠 사운드 엔진 (Web Audio API 실시간 합성, 음원 파일 없음)
 *
 * 목소리 구성: 펄스파(리드/하모니) + 삼각파(베이스) + 노이즈(퍼커션)
 * 수록곡은 모두 오리지널 창작곡입니다.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------- 음표 유틸 */

  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function freq(name) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 0;
    var s = SEMI[m[1]];
    if (m[2] === '#') s += 1;
    else if (m[2] === 'b') s -= 1;
    var midi = (parseInt(m[3], 10) + 1) * 12 + s;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // [['A4', 2], [null, 2], ...] -> 16분음표 스텝 인덱스로 흩뿌린 배열
  function seq(list) {
    var out = [], i = 0;
    for (var k = 0; k < list.length; k++) {
      var n = list[k][0], d = list[k][1];
      if (n) out[i] = { f: freq(n), d: d };
      i += d;
    }
    out.length = i;
    return out;
  }

  var CHORD = {
    Am: ['A3', 'C4', 'E4', 'A4'], F:  ['F3', 'A3', 'C4', 'F4'],
    G:  ['G3', 'B3', 'D4', 'G4'], Em: ['E3', 'G3', 'B3', 'E4'],
    C:  ['C4', 'E4', 'G4', 'C5'], E:  ['E3', 'G#3', 'B3', 'E4'],
    Dm: ['D3', 'F3', 'A3', 'D4']
  };

  // 코드 진행 -> 아르페지오 (unit = 음표 길이, 16분음표 단위)
  function arp(chords, unit) {
    var list = [], per = 16 / unit;
    for (var c = 0; c < chords.length; c++) {
      var tones = CHORD[chords[c]];
      for (var i = 0; i < per; i++) list.push([tones[i % tones.length], unit]);
    }
    return list;
  }

  // 루트/5도를 번갈아 밟는 8분음표 베이스 라인
  function bass(pairs) {
    var list = [];
    for (var i = 0; i < pairs.length; i++) {
      for (var j = 0; j < 4; j++) {
        list.push([pairs[i][0], 2]);
        list.push([pairs[i][1], 2]);
      }
    }
    return list;
  }

  function rep(pattern, times) {
    var s = '';
    for (var i = 0; i < times; i++) s += pattern;
    return s;
  }

  /* ------------------------------------------------------------- 수록곡 */

  // 게임플레이: A단조 행진곡풍 오버월드 테마 (8마디 루프)
  var GAME_LEAD = [
    ['A4', 2], ['A4', 2], ['E5', 2], ['A4', 2], ['C5', 2], ['B4', 2], ['A4', 2], ['G4', 2],
    ['F4', 2], ['F4', 2], ['C5', 2], ['F4', 2], ['A4', 2], ['G4', 2], ['F4', 2], ['E4', 2],
    ['G4', 2], ['G4', 2], ['D5', 2], ['G4', 2], ['B4', 2], ['A4', 2], ['G4', 2], ['F4', 2],
    ['E4', 2], ['G4', 2], ['B4', 2], ['E5', 2], ['D5', 4], ['C5', 4],
    ['A4', 4], ['C5', 2], ['E5', 2], ['A5', 4], ['G5', 2], ['E5', 2],
    ['F5', 4], ['E5', 2], ['D5', 2], ['C5', 4], ['B4', 2], ['A4', 2],
    ['G4', 4], ['B4', 2], ['D5', 2], ['G5', 4], ['F5', 2], ['D5', 2],
    ['E5', 8], [null, 2], ['D5', 2], ['E5', 4]
  ];
  var GAME_CHORDS = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E'];
  var GAME_BASS = [
    ['A2', 'E3'], ['F2', 'C3'], ['G2', 'D3'], ['E2', 'B2'],
    ['A2', 'E3'], ['F2', 'C3'], ['G2', 'D3'], ['E2', 'B2']
  ];

  // 타이틀: 느긋하고 웅장한 어드벤처 테마 (8마디 루프)
  var TITLE_LEAD = [
    ['A4', 8], ['C5', 4], ['E5', 4],
    ['A5', 8], ['G5', 4], ['E5', 4],
    ['F5', 8], ['E5', 4], ['C5', 4],
    ['D5', 8], ['C5', 4], ['A4', 4],
    ['G4', 8], ['B4', 4], ['D5', 4],
    ['G5', 8], ['F5', 4], ['D5', 4],
    ['E5', 8], ['C5', 4], ['A4', 4],
    ['B4', 8], ['E5', 8]
  ];
  var TITLE_CHORDS = ['Am', 'Am', 'F', 'F', 'G', 'G', 'Am', 'E'];
  var TITLE_BASS = [
    ['A2', 'A3'], ['A2', 'E3'], ['F2', 'F3'], ['F2', 'C3'],
    ['G2', 'G3'], ['G2', 'D3'], ['A2', 'A3'], ['E2', 'B2']
  ];

  function song(def) {
    var len = 0;
    for (var i = 0; i < def.voices.length; i++) {
      var v = def.voices[i];
      var n = (v.kind === 'drum') ? v.pat.length : v.seq.length;
      if (n > len) len = n;
    }
    def.len = len;
    return def;
  }

  var SONGS = {
    title: song({
      bpm: 96, loop: true, dynamic: false,
      voices: [
        { kind: 'lead', gain: 0.170, seq: seq(TITLE_LEAD) },
        { kind: 'harm', gain: 0.055, seq: seq(arp(TITLE_CHORDS, 2)) },
        { kind: 'bass', gain: 0.200, seq: seq(bass(TITLE_BASS)) },
        { kind: 'drum', pat: rep('..h...h...h...h.', 8).split('') }
      ]
    }),

    game: song({
      bpm: 120, loop: true, dynamic: true,
      voices: [
        { kind: 'lead', gain: 0.160, seq: seq(GAME_LEAD) },
        { kind: 'harm', gain: 0.050, seq: seq(arp(GAME_CHORDS, 2)) },
        { kind: 'bass', gain: 0.210, seq: seq(bass(GAME_BASS)) },
        { kind: 'drum', pat: (rep('K.h.S.h.K.h.S.h.', 7) + 'K.h.S.h.KSKShShS').split('') }
      ]
    }),

    win: song({
      bpm: 150, loop: false, dynamic: false,
      voices: [
        { kind: 'lead', gain: 0.20, seq: seq([['C5', 2], ['E5', 2], ['G5', 2], ['C6', 4], [null, 1], ['G5', 1], ['C6', 8]]) },
        { kind: 'harm', gain: 0.09, seq: seq([['E4', 2], ['G4', 2], ['C5', 2], ['E5', 4], [null, 2], ['E5', 8]]) },
        { kind: 'bass', gain: 0.22, seq: seq([['C3', 6], ['G2', 6], ['C3', 8]]) }
      ]
    }),

    lose: song({
      bpm: 104, loop: false, dynamic: false,
      voices: [
        { kind: 'lead', gain: 0.19, seq: seq([['A4', 3], ['G4', 3], ['F4', 3], ['E4', 5], [null, 2], ['D4', 3], ['A3', 8]]) },
        { kind: 'bass', gain: 0.22, seq: seq([['A2', 6], ['F2', 6], ['D2', 7], ['A2', 8]]) }
      ]
    })
  };

  /* --------------------------------------------------------- 오디오 엔진 */

  var ctx = null, master = null, noiseBuf = null;
  var cur = null, stepIdx = 0, nextTime = 0, pending = null;
  var tempoMul = 1;
  var VOLUME = 0.3;

  var muted = false;
  try { muted = global.localStorage.getItem('snake.muted') === '1'; } catch (e) {}

  function makeNoise() {
    var len = Math.floor(ctx.sampleRate * 0.4);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // 브라우저 자동재생 정책상 사용자 조작 이후에만 소리를 낼 수 있다.
  function unlock() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
      noiseBuf = makeNoise();
      global.setInterval(schedule, 25);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (pending) { var p = pending; pending = null; play(p); }
    return true;
  }

  function tone(kind, t, f, dur, gain) {
    var o = ctx.createOscillator();
    o.type = (kind === 'bass') ? 'triangle' : 'square';
    o.frequency.setValueAtTime(f, t);

    var g = ctx.createGain();
    var attack = Math.min(0.008, dur * 0.1);
    var hold = dur * 0.70;
    var rel = dur * 0.97;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rel);

    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function kick(t) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.16);
  }

  function noiseHit(t, dur, gain, hp) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // 미리보기 스케줄러: 25ms마다 깨어나 150ms 앞까지 음을 예약한다.
  function schedule() {
    if (!cur || !ctx) return;
    var horizon = ctx.currentTime + 0.15;
    var guard = 0;
    while (nextTime < horizon && guard++ < 300) {
      var mul = cur.dynamic ? tempoMul : 1;
      var spb = 15 / (cur.bpm * mul);   // 60 / bpm / 4 = 16분음표 한 스텝(초)
      emit(cur, stepIdx, nextTime, spb);
      stepIdx++;
      nextTime += spb;
      if (stepIdx >= cur.len) {
        if (cur.loop) stepIdx = 0;
        else { cur = null; return; }
      }
    }
  }

  function emit(s, i, t, spb) {
    for (var v = 0; v < s.voices.length; v++) {
      var voice = s.voices[v];
      if (voice.kind === 'drum') {
        var c = voice.pat[i % voice.pat.length];
        if (c === 'K') kick(t);
        else if (c === 'S') noiseHit(t, 0.13, 0.20, 1400);
        else if (c === 'h') noiseHit(t, 0.035, 0.075, 6500);
      } else {
        var ev = voice.seq[i];
        if (ev) tone(voice.kind, t, ev.f, ev.d * spb, voice.gain);
      }
    }
  }

  function play(name) {
    var s = SONGS[name];
    if (!s) return;
    if (!ctx) { pending = name; return; }
    cur = s;
    stepIdx = 0;
    nextTime = ctx.currentTime + 0.06;
  }

  function stop() { cur = null; pending = null; }

  // 뱀 속도(0 = 시작, 1 = 최고속)에 맞춰 게임 음악 템포를 끌어올린다.
  function setIntensity(x) {
    x = Math.max(0, Math.min(1, x || 0));
    tempoMul = 0.8 + x * 0.75;          // 120bpm 기준 96 ~ 186bpm
  }

  function sfx(name) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + 0.001;
    if (name === 'eat') {
      tone('lead', t, freq('E5'), 0.055, 0.16);
      tone('lead', t + 0.055, freq('B5'), 0.075, 0.16);
    }
  }

  function setMuted(v) {
    muted = !!v;
    if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
    try { global.localStorage.setItem('snake.muted', muted ? '1' : '0'); } catch (e) {}
  }

  global.Chip = {
    unlock: unlock,
    ready: function () { return !!ctx && ctx.state === 'running'; },
    play: play,
    stop: stop,
    sfx: sfx,
    setIntensity: setIntensity,
    isMuted: function () { return muted; },
    setMuted: setMuted,
    toggleMute: function () { setMuted(!muted); return muted; }
  };
})(window);
