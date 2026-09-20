'use strict';

// Records locales. Guarda en localStorage (STORAGE_KEYS.scores) un objeto:
//   { entries: [{ name, score, lines, combo, date }], bestCombo, maxLines }
// `entries` está ordenado de mayor a menor y limitado a MAX_ENTRIES.
// bestCombo / maxLines son los máximos históricos y se actualizan siempre, entren o
// no las puntuaciones en el top.
//
// Contrato (no cambiar las firmas: otros archivos dependen de ellas):
//   Scores.top()                       -> copia del top ordenado
//   Scores.qualifies(score)            -> ¿esta puntuación entraría en el top?
//   Scores.add({ name, score, lines, combo })
//                                      -> inserta si entra; devuelve su posición (0 = primero) o -1
//   Scores.recordStats({ lines, combo })
//                                      -> actualiza los máximos históricos; devuelve
//                                         { newBestCombo, newMaxLines } (booleanos)
//   Scores.stats()                     -> { bestCombo, maxLines }
//   Scores.reset()                     -> borra top y máximos (no el último nombre)
//   Scores.lastName() / Scores.setLastName(name)
//   Scores.renderTable(mount, highlightIndex = -1)
//                                      -> vacía `mount` y pinta el top y los máximos. Usar
//                                         SIEMPRE textContent: el nombre lo escribe el jugador.
//
// Lo leído de localStorage nunca se da por bueno: read() lo sanea (tipos, NaN, orden,
// más de MAX_ENTRIES, nombres) y ninguna función pública lanza por datos corruptos.
// Los estilos de la tabla viven en css/scores.css.

const Scores = (() => {
  const MAX_ENTRIES = 5;
  const MAX_NAME = 12;
  const DEFAULT_NAME = 'Anónimo';

  // Entero >= 0 a partir de un número o cadena numérica; cualquier otra cosa -> 0.
  function toCount(value) {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.floor(n), Number.MAX_SAFE_INTEGER);
  }

  // Recorta, colapsa espacios, quita caracteres de control / direccionales y limita a
  // MAX_NAME caracteres (por code point, para no partir emojis). Se conservan ZWJ/ZWNJ
  // (U+200C/D) porque hacen falta en emojis compuestos y en varios alfabetos. Vacío -> fallback.
  function cleanName(name, fallback = '') {
    const text = typeof name === 'string' ? name : typeof name === 'number' ? String(name) : '';
    const clean = text
      .replace(/\s+/g, ' ')
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
      .trim();
    return Array.from(clean).slice(0, MAX_NAME).join('').trim() || fallback;
  }

  // Devuelve una entrada limpia o null si no vale (sin puntuación positiva).
  function cleanEntry(raw) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const score = toCount(raw.score);
    if (score <= 0) return null;
    return {
      name: cleanName(raw.name, DEFAULT_NAME),
      score,
      lines: toCount(raw.lines),
      combo: toCount(raw.combo),
      date: typeof raw.date === 'string' ? raw.date.slice(0, 40) : '',
    };
  }

  function read() {
    const data = loadJSON(STORAGE_KEYS.scores, null);
    const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
    const entries = [];
    if (isObject && Array.isArray(data.entries)) {
      for (const raw of data.entries) {
        const entry = cleanEntry(raw);
        if (entry) entries.push(entry);
      }
    }
    // sort es estable: a igual puntuación se conserva el orden guardado (más antiguo primero).
    entries.sort((a, b) => b.score - a.score);
    entries.length = Math.min(entries.length, MAX_ENTRIES);
    return {
      entries,
      bestCombo: isObject ? toCount(data.bestCombo) : 0,
      maxLines: isObject ? toCount(data.maxLines) : 0,
    };
  }

  function write(data) {
    return saveJSON(STORAGE_KEYS.scores, data);
  }

  function top() {
    return read().entries;
  }

  // ¿Entraría `score` en `entries` (ya saneadas y ordenadas)?
  function fits(entries, score) {
    return score > 0 && (entries.length < MAX_ENTRIES || score > entries[MAX_ENTRIES - 1].score);
  }

  function qualifies(score) {
    return fits(read().entries, toCount(score));
  }

  function add(record) {
    const { name, score, lines, combo } = record ?? {};
    const entry = cleanEntry({ name, score, lines, combo, date: new Date().toISOString() });
    if (!entry) return -1;
    const data = read();
    if (!fits(data.entries, entry.score)) return -1;
    // Inserta después de las puntuaciones iguales: la más antigua conserva su puesto.
    let index = data.entries.findIndex(e => e.score < entry.score);
    if (index === -1) index = data.entries.length;
    data.entries.splice(index, 0, entry);
    data.entries.length = Math.min(data.entries.length, MAX_ENTRIES);
    // Si no se pudo guardar (modo privado, cuota) no prometemos una posición que no existe.
    return write(data) ? index : -1;
  }

  function recordStats(record) {
    const { lines, combo } = record ?? {};
    const data = read();
    const newCombo = toCount(combo);
    const newLines = toCount(lines);
    const newBestCombo = newCombo > data.bestCombo;
    const newMaxLines = newLines > data.maxLines;
    if (newBestCombo) data.bestCombo = newCombo;
    if (newMaxLines) data.maxLines = newLines;
    if ((newBestCombo || newMaxLines) && !write(data)) return { newBestCombo: false, newMaxLines: false };
    return { newBestCombo, newMaxLines };
  }

  function stats() {
    const { bestCombo, maxLines } = read();
    return { bestCombo, maxLines };
  }

  function reset() {
    write({ entries: [], bestCombo: 0, maxLines: 0 });
  }

  function lastName() {
    return cleanName(loadString(STORAGE_KEYS.lastName, ''));
  }

  function setLastName(name) {
    saveString(STORAGE_KEYS.lastName, cleanName(name));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Marcado con clases estables (.records, .records-list, .record-row, .is-new,
  // .record-rank/-name/-score, .records-stats) para poder darle estilo. Solo se usa
  // textContent: el nombre lo escribe el jugador.
  function renderTable(mount, highlightIndex = -1) {
    if (!mount) return;
    const { entries, bestCombo, maxLines } = read();

    const box = el('div', 'records');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Récords');

    if (entries.length === 0) {
      box.append(el('p', 'records-empty', 'Aún no hay récords'));
    } else {
      const table = el('table', 'records-list');
      table.append(el('caption', 'records-caption', 'Top 5'));

      const headRow = el('tr');
      for (const [className, label] of [['record-rank', 'Puesto'], ['record-name', 'Nombre'], ['record-score', 'Puntuación']]) {
        const th = el('th', className, label);
        th.scope = 'col';
        headRow.append(th);
      }
      const thead = el('thead');
      thead.append(headRow);

      const tbody = el('tbody');
      entries.forEach((entry, i) => {
        const isNew = i === highlightIndex;
        const row = el('tr', 'record-row' + (isNew ? ' is-new' : ''));
        if (isNew) row.setAttribute('aria-current', 'true');
        const rank = el('th', 'record-rank', String(i + 1));
        rank.scope = 'row';
        const name = el('td', 'record-name', entry.name);
        name.title = entry.name;
        row.append(rank, name, el('td', 'record-score', entry.score.toLocaleString()));
        tbody.append(row);
      });
      table.append(thead, tbody);
      box.append(table);
    }

    const statsBox = el('dl', 'records-stats');
    for (const [label, value] of [['Mejor combo', bestCombo], ['Líneas máx.', maxLines]]) {
      const item = el('div', 'records-stat');
      item.append(el('dt', 'records-stat-label', label), el('dd', 'records-stat-value', value.toLocaleString()));
      statsBox.append(item);
    }
    box.append(statsBox);

    mount.replaceChildren(box);
  }

  return { top, qualifies, add, recordStats, stats, reset, lastName, setLastName, renderTable };
})();
