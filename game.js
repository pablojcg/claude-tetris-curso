'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Paleta por skin, indexada igual que PIECES: I, O, T, S, Z, J, L, H (hueca)
const RETRO_COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // H - hollow (rosa)
];

const NEON_COLORS = [
  null,
  '#00f0ff', '#fff200', '#d000ff', '#39ff14', '#ff2a2a', '#2a6bff', '#ff8c00', '#ff2d95',
];

const PASTEL_COLORS = [
  null,
  '#a8e6ef', '#fff1b8', '#d9b8e6', '#b8e6c1', '#f5b8b8', '#b8d4f5', '#f9d4a8', '#f5b8d0',
];

const PIXEL_COLORS = [
  null,
  '#00bcd4', '#fbc02d', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#d81b60',
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // H - cuadrado 3x3 hueco
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const HOLLOW_TYPE = 8;
const HOLLOW_CHANCE = 1 / 15;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayMessage = document.getElementById('overlay-message');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const overlayViews = {
  gameover: document.getElementById('gameover-view'),
  pause: document.getElementById('pause-view'),
  controls: document.getElementById('controls-view'),
};
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level');
const skinSelect = document.getElementById('skin-select');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsEl = document.getElementById('records');
const recordsList = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const bestComboRow = document.getElementById('best-combo-row');
const maxLinesRow = document.getElementById('max-lines-row');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const THEME_STORAGE_KEY = 'tetris-theme';
const SKIN_STORAGE_KEY = 'tetris-skin';
const DEFAULT_SKIN = 'retro';
const START_LEVEL_STORAGE_KEY = 'tetris-start-level';
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 10;
const RECORDS_STORAGE_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const MAX_NAME_LENGTH = 12;
const DEFAULT_NAME = 'ANÓNIMO';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridLineColor;
let theme = 'dark';
let skinName = DEFAULT_SKIN;
let overlayView;
// startLevel is the selector value (applies to the next game); baseLevel is the one the running game started with.
let startLevel = MIN_START_LEVEL;
let baseLevel = MIN_START_LEVEL;
let combo, maxCombo;
let records, pendingScore = null, highlightIndex = -1, highlightCombo = false, highlightLines = false;

function intervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < HOLLOW_CHANCE
    ? HOLLOW_TYPE
    : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  combo = clearLines() ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRetroBlock(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawNeonBlock(context, x, y, color, size, alpha) {
  const px = x * size + 3, py = y * size + 3, s = size - 6;
  context.save();
  context.globalAlpha = alpha * 0.25;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.strokeRect(px, py, s, s);
  context.restore();
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPastelBlock(context, x, y, color, size, alpha) {
  const px = x * size + 2, py = y * size + 2, s = size - 4;
  context.save();
  context.globalAlpha = alpha;
  roundedRectPath(context, px, py, s, s, 8);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(0,0,0,0.12)';
  context.lineWidth = 1;
  context.stroke();
  // brillo suave
  roundedRectPath(context, px + 4, py + 4, s - 8, 5, 2.5);
  context.fillStyle = 'rgba(255,255,255,0.5)';
  context.fill();
  context.restore();
}

function drawPixelBlock(context, x, y, color, size, alpha) {
  const u = Math.max(2, Math.floor(size / 8)); // tamaño de "píxel"
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // interior con patrón de tablero (dither)
  const inner = s - 2 * u;
  context.fillStyle = 'rgba(255,255,255,0.14)';
  for (let j = 0; j * u < inner; j++) {
    for (let i = 0; i * u < inner; i++) {
      if ((i + j) % 2) continue;
      context.fillRect(px + u + i * u, py + u + j * u, Math.min(u, inner - i * u), Math.min(u, inner - j * u));
    }
  }
  // bisel: luz arriba/izquierda, sombra abajo/derecha
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.fillRect(px, py, s, u);
  context.fillRect(px, py, u, s);
  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.fillRect(px, py + s - u, s, u);
  context.fillRect(px + s - u, py, u, s);
  // píxel de brillo
  context.fillStyle = '#fff';
  context.fillRect(px + 2 * u, py + 2 * u, u, u);
  context.restore();
}

// forceDark: la skin exige tablero/página oscuros e ignora el modo claro
const SKINS = {
  retro:  { colors: RETRO_COLORS,  drawBlock: drawRetroBlock,  forceDark: false },
  neon:   { colors: NEON_COLORS,   drawBlock: drawNeonBlock,   forceDark: true },
  pastel: { colors: PASTEL_COLORS, drawBlock: drawPastelBlock, forceDark: false },
  pixel:  { colors: PIXEL_COLORS,  drawBlock: drawPixelBlock,  forceDark: false },
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[skinName];
  skin.drawBlock(context, x, y, skin.colors[colorIndex], size, alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function showOverlayView(name) {
  overlayView = name;
  for (const [key, el] of Object.entries(overlayViews)) el.classList.toggle('hidden', key !== name);
  overlay.classList.remove('hidden');
}

function pauseGame() {
  paused = true;
  cancelAnimationFrame(animId);
  showOverlayView('pause');
  resumeBtn.focus();
}

function resumeGame() {
  paused = false;
  overlay.classList.add('hidden');
  // Drop focus so a held Space/Enter can't re-activate a menu button or leak into the game.
  document.activeElement?.blur();
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
}

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY));
    if (!data || !Array.isArray(data.top)) return emptyRecords();
    const top = data.top
      .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
    return {
      top,
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch {
    return emptyRecords();
  }
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // storage unavailable or full: records just won't persist
  }
}

// Position a score would take in the top; ties go below existing entries.
function rankFor(value) {
  const idx = records.top.findIndex(e => e.score < value);
  return idx === -1 ? records.top.length : idx;
}

function qualifiesForTop(value) {
  return value > 0 && rankFor(value) < MAX_RECORDS;
}

function renderRecords() {
  recordsList.replaceChildren();
  for (let i = 0; i < MAX_RECORDS; i++) {
    const entry = records.top[i];
    const li = document.createElement('li');
    li.classList.toggle('highlight', i === highlightIndex);
    for (const [cls, text] of [
      ['rank', `${i + 1}.`],
      ['name', entry ? entry.name : '—'],
      ['points', entry ? entry.score.toLocaleString() : ''],
    ]) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      li.appendChild(span);
    }
    recordsList.appendChild(li);
  }
  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
  bestComboRow.classList.toggle('highlight', highlightCombo);
  maxLinesRow.classList.toggle('highlight', highlightLines);
}

function pendingMessage() {
  return `¡Entras en el top #${rankFor(pendingScore) + 1}!`;
}

function savePendingScore() {
  if (pendingScore === null) return;
  const name = nameInput.value.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;
  highlightIndex = rankFor(pendingScore);
  records.top.splice(highlightIndex, 0, { name, score: pendingScore });
  records.top.length = Math.min(records.top.length, MAX_RECORDS);
  pendingScore = null;
  saveRecords();
  nameForm.classList.add('hidden');
  overlayMessage.textContent = `Guardado en el puesto #${highlightIndex + 1}`;
  renderRecords();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  records = emptyRecords();
  highlightIndex = -1;
  highlightCombo = highlightLines = false;
  saveRecords();
  if (pendingScore !== null) {
    // The pending score is not lost: it can still be saved as #1
    overlayMessage.textContent = pendingMessage();
  }
  renderRecords();
}

function showOverlay({ title, scoreText = '', showRecords = false, action = 'Reiniciar' }) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('start', action === 'Jugar');
  overlayScore.textContent = scoreText;
  overlayMessage.textContent = '';
  nameForm.classList.add('hidden');
  recordsEl.classList.toggle('hidden', !showRecords);
  restartBtn.textContent = action;
  showOverlayView('gameover');
}

function showStartScreen() {
  highlightIndex = -1;
  highlightCombo = highlightLines = false;
  renderRecords();
  showOverlay({ title: 'TETRIS', showRecords: true, action: 'Jugar' });
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  highlightCombo = maxCombo > records.bestCombo;
  highlightLines = lines > records.maxLines;
  if (highlightCombo) records.bestCombo = maxCombo;
  if (highlightLines) records.maxLines = lines;
  if (highlightCombo || highlightLines) saveRecords();

  pendingScore = qualifiesForTop(score) ? score : null;
  highlightIndex = -1;
  renderRecords();

  showOverlay({
    title: 'GAME OVER',
    scoreText: `Puntuación: ${score.toLocaleString()}`,
    showRecords: true,
  });
  if (pendingScore !== null) {
    overlayMessage.textContent = pendingMessage();
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    nameInput.focus();
  }
}

function togglePause() {
  if (gameOver) return;
  if (paused) resumeGame();
  else pauseGame();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) {
        draw();
        return;
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  document.activeElement?.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return;
  if (e.code === 'KeyP') {
    if (!e.repeat) togglePause();
    return;
  }
  if (e.code === 'Escape') {
    if (e.repeat) return;
    if (paused && overlayView === 'controls') {
      showOverlayView('pause');
      controlsBtn.focus();
    } else {
      togglePause();
    }
    return;
  }
  // Menu open (or game over): game keys are ignored so nothing moves on return.
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function loadPref(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* sin persistencia: se ignora */ }
}

// Aplica skin + tema al DOM y redibuja sin esperar al loop (pausa / game over)
function applyAppearance() {
  const skin = SKINS[skinName];
  const light = theme === 'light' && !skin.forceDark;
  document.body.classList.toggle('light', light);
  document.body.dataset.skin = skinName;
  themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  themeToggle.disabled = skin.forceDark;
  skinSelect.value = skinName;
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  if (board && current && next) {
    draw();
    drawNext();
  }
}

function applyTheme(newTheme) {
  theme = newTheme;
  savePref(THEME_STORAGE_KEY, theme);
  applyAppearance();
}

function applySkin(name) {
  skinName = Object.hasOwn(SKINS, name) ? name : DEFAULT_SKIN;
  savePref(SKIN_STORAGE_KEY, skinName);
  applyAppearance();
}

function initTheme() {
  theme = loadPref(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  const savedSkin = loadPref(SKIN_STORAGE_KEY);
  skinName = Object.hasOwn(SKINS, savedSkin) ? savedSkin : DEFAULT_SKIN;
  applyAppearance();
}

themeToggle.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // que las flechas sigan moviendo la pieza, no el selector
});

function initStartLevel() {
  for (let l = MIN_START_LEVEL; l <= MAX_START_LEVEL; l++) {
    startLevelSelect.add(new Option(String(l), String(l)));
  }
  const saved = Number.parseInt(localStorage.getItem(START_LEVEL_STORAGE_KEY), 10);
  if (saved >= MIN_START_LEVEL && saved <= MAX_START_LEVEL) startLevel = saved;
  startLevelSelect.value = String(startLevel);
}

startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
  localStorage.setItem(START_LEVEL_STORAGE_KEY, String(startLevel));
});

restartBtn.addEventListener('click', () => {
  savePendingScore();
  init();
});
pauseRestartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resumeGame);
controlsBtn.addEventListener('click', () => {
  showOverlayView('controls');
  controlsBackBtn.focus();
});
controlsBackBtn.addEventListener('click', () => {
  showOverlayView('pause');
  controlsBtn.focus();
});

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  savePendingScore();
});

resetRecordsBtn.addEventListener('click', resetRecords);

initTheme();
initStartLevel();
records = loadRecords();
gameOver = true; // no game running until "Jugar": keeps the keydown handler inert
showStartScreen();
