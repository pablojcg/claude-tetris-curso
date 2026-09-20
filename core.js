'use strict';

// Núcleo compartido. Se carga el primero: todos los demás scripts (skins, scores,
// menus, gameover, start, game) dependen de estas utilidades, que viven en el
// ámbito global igual que el resto del proyecto (sin módulos ni build).

// ---- Almacenamiento ---------------------------------------------------------

const STORAGE_KEYS = {
  theme: 'tetris-theme',           // 'light' | 'dark' (cadena, no JSON)
  skin: 'tetris-skin',             // id de skin (cadena)
  scores: 'tetris-scores',         // JSON: ver scores.js
  startLevel: 'tetris-start-level', // entero 1..MAX_START_LEVEL (cadena)
  lastName: 'tetris-last-name',    // último nombre usado en un record (cadena)
};

const MAX_START_LEVEL = 15;

// localStorage puede lanzar (modo privado, cuota, file://). Nunca propagamos el error.
function loadString(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function saveString(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadJSON(key, fallback) {
  const raw = loadString(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  return saveString(key, JSON.stringify(value));
}

// ---- Hooks ------------------------------------------------------------------
// game.js dispara eventos; cada feature se suscribe al cargarse. Así ningún
// archivo depende del orden de carga de otro ni edita las funciones de game.js.
//
//   ready              -> payload: undefined. DOM listo, antes de mostrar la pantalla de inicio.
//   newGame            -> { level }. Empieza una partida (init).
//   gameOver           -> { score, lines, level, maxCombo, maxLinesAtOnce }.
//   pause / resume     -> undefined.
//   lineClear          -> { cleared, combo }. Tras limpiar líneas.
//   skinChange         -> id de la skin activa.
//   startLevelChange   -> nivel inicial elegido (entero).

const HOOK_NAMES = ['ready', 'newGame', 'gameOver', 'pause', 'resume', 'lineClear', 'skinChange', 'startLevelChange'];
const hookHandlers = Object.fromEntries(HOOK_NAMES.map(name => [name, []]));

function onHook(name, fn) {
  if (!hookHandlers[name]) throw new Error(`Hook desconocido: ${name}`);
  hookHandlers[name].push(fn);
}

function fireHook(name, payload) {
  if (!hookHandlers[name]) throw new Error(`Hook desconocido: ${name}`);
  for (const fn of hookHandlers[name]) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`Error en el hook "${name}":`, err);
    }
  }
}

// ---- Pantallas --------------------------------------------------------------
// Tres pantallas a pantalla completa sobre el juego: #screen-start, #screen-pause
// y #screen-gameover. Solo una visible a la vez. Mientras haya una visible (o
// alguien llame a setInputLocked(true)) game.js ignora las teclas de juego.

const SCREEN_NAMES = ['start', 'pause', 'gameover'];
let extraInputLock = false;

function screenEl(name) {
  return document.getElementById(`screen-${name}`);
}

function showScreen(name) {
  if (!SCREEN_NAMES.includes(name)) throw new Error(`Pantalla desconocida: ${name}`);
  for (const n of SCREEN_NAMES) screenEl(n).classList.toggle('hidden', n !== name);
}

function hideScreens() {
  for (const n of SCREEN_NAMES) screenEl(n).classList.add('hidden');
  // Si el foco se queda en un botón oculto, Espacio (caída) lo activaría.
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
}

function activeScreen() {
  return SCREEN_NAMES.find(n => !screenEl(n).classList.contains('hidden')) ?? null;
}

function setInputLocked(locked) {
  extraInputLock = !!locked;
}

function isInputLocked() {
  return extraInputLock || activeScreen() !== null;
}

// ---- Nivel inicial ----------------------------------------------------------

function getStartLevel() {
  const n = Number(loadString(STORAGE_KEYS.startLevel));
  return Number.isInteger(n) && n >= 1 && n <= MAX_START_LEVEL ? n : 1;
}

function setStartLevel(value) {
  const level = Math.min(MAX_START_LEVEL, Math.max(1, Math.floor(Number(value)) || 1));
  saveString(STORAGE_KEYS.startLevel, String(level));
  fireHook('startLevelChange', level);
  return level;
}

// ---- Panel de opciones compartido ------------------------------------------
// Selectores de "Nivel inicial" y "Skin". Lo montan tanto el menú de pausa como la
// pantalla de inicio; se mantienen sincronizados entre sí mediante los hooks.

function buildOptionsPanel(mount) {
  const panel = document.createElement('div');
  panel.className = 'options-panel';

  function addRow(labelText, select) {
    const row = document.createElement('label');
    row.className = 'option-row';
    const text = document.createElement('span');
    text.className = 'option-label';
    text.textContent = labelText;
    select.classList.add('option-select');
    row.append(text, select);
    panel.append(row);
  }

  const levelSelect = document.createElement('select');
  for (let level = 1; level <= MAX_START_LEVEL; level++) levelSelect.add(new Option(String(level), String(level)));
  levelSelect.addEventListener('change', () => setStartLevel(levelSelect.value));
  addRow('Nivel inicial', levelSelect);

  const skinSelect = document.createElement('select');
  for (const skin of Skin.list()) skinSelect.add(new Option(skin.name, skin.id));
  skinSelect.addEventListener('change', () => Skin.set(skinSelect.value));
  addRow('Skin', skinSelect);

  function sync() {
    levelSelect.value = String(getStartLevel());
    skinSelect.value = Skin.current();
  }
  onHook('startLevelChange', sync);
  onHook('skinChange', sync);
  sync();

  mount.append(panel);
  return { element: panel, sync };
}
