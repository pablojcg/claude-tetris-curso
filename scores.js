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

const Scores = (() => {
  const MAX_ENTRIES = 5;

  function read() {
    const data = loadJSON(STORAGE_KEYS.scores, null);
    return {
      entries: Array.isArray(data?.entries) ? data.entries : [],
      bestCombo: Number(data?.bestCombo) || 0,
      maxLines: Number(data?.maxLines) || 0,
    };
  }

  function write(data) {
    saveJSON(STORAGE_KEYS.scores, data);
  }

  function top() {
    return read().entries.map(entry => ({ ...entry }));
  }

  function qualifies(score) {
    if (!(score > 0)) return false;
    const { entries } = read();
    return entries.length < MAX_ENTRIES || score > entries[MAX_ENTRIES - 1].score;
  }

  function add({ name, score, lines, combo }) {
    if (!qualifies(score)) return -1;
    const data = read();
    const entry = {
      name: String(name ?? '').trim().slice(0, 12) || 'Anónimo',
      score,
      lines,
      combo,
      date: new Date().toISOString(),
    };
    // Inserta después de las puntuaciones iguales: la más antigua conserva su puesto.
    let index = data.entries.findIndex(e => e.score < score);
    if (index === -1) index = data.entries.length;
    data.entries.splice(index, 0, entry);
    data.entries.length = Math.min(data.entries.length, MAX_ENTRIES);
    write(data);
    return index;
  }

  function recordStats({ lines, combo }) {
    const data = read();
    const newBestCombo = combo > data.bestCombo;
    const newMaxLines = lines > data.maxLines;
    if (newBestCombo) data.bestCombo = combo;
    if (newMaxLines) data.maxLines = lines;
    if (newBestCombo || newMaxLines) write(data);
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
    return loadString(STORAGE_KEYS.lastName, '');
  }

  function setLastName(name) {
    saveString(STORAGE_KEYS.lastName, String(name ?? '').trim().slice(0, 12));
  }

  // Marcado mínimo con clases estables (.records, .records-list, .record-row,
  // .is-new, .record-rank/-name/-score, .records-stats) para poder darle estilo.
  function renderTable(mount, highlightIndex = -1) {
    const list = document.createElement('ol');
    list.className = 'records-list';
    top().forEach((entry, i) => {
      const row = document.createElement('li');
      row.className = 'record-row' + (i === highlightIndex ? ' is-new' : '');
      const name = document.createElement('span');
      name.className = 'record-name';
      name.textContent = entry.name;
      const score = document.createElement('span');
      score.className = 'record-score';
      score.textContent = Number(entry.score).toLocaleString();
      row.append(name, score);
      list.append(row);
    });

    const { bestCombo, maxLines } = stats();
    const summary = document.createElement('p');
    summary.className = 'records-stats';
    summary.textContent = `Mejor combo: ${bestCombo} · Líneas máx.: ${maxLines}`;

    const box = document.createElement('div');
    box.className = 'records';
    box.append(list, summary);
    mount.replaceChildren(box);
  }

  return { top, qualifies, add, recordStats, stats, reset, lastName, setLastName, renderTable };
})();
