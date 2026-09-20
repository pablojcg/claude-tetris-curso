'use strict';

// Pantalla de Game Over (#screen-gameover). game.js la muestra tras disparar el
// hook 'gameOver' con { score, lines, level, maxCombo, maxLinesAtOnce }.
// OJO: Espacio es la caída rápida; no des foco automático a ningún botón aquí o un
// jugador machacando Espacio reiniciaría la partida sin querer.

const GAMEOVER_FOCUS_DELAY = 600; // ms antes de enfocar el input de nombre
const NAME_MAX_LENGTH = 12;

const gameoverScoreEl = document.getElementById('gameover-score');
const gameoverBox = document.getElementById('gameover-records');
let gameoverFocusTimer = null;

// Los datos del jugador (nombre) y los números se pintan siempre con textContent.
function goEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Resumen de la partida: lista de pares etiqueta / valor.
function buildSummary({ lines, level, maxCombo, maxLinesAtOnce }) {
  const list = goEl('dl', 'go-summary');
  const rows = [
    ['Líneas', lines],
    ['Nivel', level],
    ['Combo máximo', maxCombo],
    ['Mayor limpieza', maxLinesAtOnce === 1 ? '1 línea' : `${maxLinesAtOnce} líneas`],
  ];
  for (const [label, value] of rows) {
    const row = goEl('div', 'go-summary-row');
    row.append(goEl('dt', 'go-summary-label', label), goEl('dd', 'go-summary-value', String(value)));
    list.append(row);
  }
  return list;
}

// Avisos de récord histórico (combo / líneas).
function buildNotices({ newBestCombo, newMaxLines }) {
  const notices = [];
  if (newBestCombo) notices.push('¡Nuevo récord de combo!');
  if (newMaxLines) notices.push('¡Nuevo récord de líneas!');
  if (!notices.length) return null;
  const box = goEl('div', 'go-notices');
  notices.forEach(text => box.append(goEl('p', 'go-notice', text)));
  return box;
}

// Formulario de nombre (solo si la puntuación entra en el top). Al guardar lo
// sustituye por la tabla con la fila nueva resaltada.
function buildNameForm(data) {
  const form = goEl('form', 'go-form');
  form.autocomplete = 'off';

  const label = goEl('label', 'go-form-label', '¡Nuevo récord! Escribe tu nombre');
  label.htmlFor = 'go-name';

  const input = goEl('input', 'go-name-input');
  input.type = 'text';
  input.id = 'go-name';
  input.maxLength = NAME_MAX_LENGTH;
  input.value = Scores.lastName();
  input.spellcheck = false;

  const save = goEl('button', 'btn go-save-btn', 'Guardar');
  save.type = 'submit';

  const row = goEl('div', 'go-form-row');
  row.append(input, save);
  form.append(label, row);

  let saved = false;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (saved) return;
    saved = true;
    // Recorta los espacios sueltos que haya podido colar el jugador con Espacio.
    const name = input.value.trim().slice(0, NAME_MAX_LENGTH);
    if (name) Scores.setLastName(name); // un nombre vacío no borra el recordado
    const index = Scores.add({ name, score: data.score, lines: data.lines, combo: data.maxCombo });
    form.remove();
    Scores.renderTable(gameoverBox, index);
    // El foco estaba en el formulario que acaba de desaparecer: lo dejamos en la tabla
    // (no es un botón, así que Espacio no activa nada).
    gameoverBox.tabIndex = -1;
    gameoverBox.focus({ preventScroll: true });
  });

  return { form, input };
}

function clearGameoverFocusTimer() {
  clearTimeout(gameoverFocusTimer);
  gameoverFocusTimer = null;
}

onHook('gameOver', data => {
  clearGameoverFocusTimer();

  const { newBestCombo, newMaxLines } = Scores.recordStats({ lines: data.lines, combo: data.maxCombo });

  gameoverScoreEl.textContent = `Puntuación: ${data.score.toLocaleString()}`;

  // Reconstruimos todo el contenido dinámico: partidas sucesivas no acumulan nada.
  for (const stale of document.querySelectorAll('#screen-gameover .go-notices, #screen-gameover .go-summary')) {
    stale.remove();
  }
  gameoverScoreEl.after(...[buildNotices({ newBestCombo, newMaxLines }), buildSummary(data)].filter(Boolean));

  gameoverBox.replaceChildren();
  if (Scores.qualifies(data.score)) {
    const { form, input } = buildNameForm(data);
    gameoverBox.append(form);
    // Foco con retardo: el jugador suele estar machacando Espacio al morir.
    gameoverFocusTimer = setTimeout(() => {
      gameoverFocusTimer = null;
      if (activeScreen() !== 'gameover' || !form.isConnected) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }, GAMEOVER_FOCUS_DELAY);
  } else {
    Scores.renderTable(gameoverBox, -1);
  }
});

// Al empezar otra partida se cancela el foco pendiente y se vacía el contenido.
onHook('newGame', () => {
  clearGameoverFocusTimer();
  gameoverBox.replaceChildren();
});

document.getElementById('restart-btn').addEventListener('click', () => init());
