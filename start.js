'use strict';

// Pantalla de inicio (#screen-start). game.js la muestra al cargar la página;
// el juego no arranca hasta que se llama a init() con el botón Jugar.
// Estructura de #start-records (se construye una sola vez):
//   .st-records-title  "Récords"
//   .st-table          punto de montaje de Scores.renderTable (se repinta)
//   .st-reset          botón "Resetear records" + confirmación inline en dos pasos

(() => {
  const CONFIRM_TIMEOUT_MS = 4000;

  const recordsMount = document.getElementById('start-records');
  const optionsMount = document.getElementById('start-options');
  const playBtn = document.getElementById('play-btn');

  // ---- Récords ---------------------------------------------------------------

  const title = document.createElement('p');
  title.className = 'st-records-title';
  title.textContent = 'Récords';

  const tableMount = document.createElement('div');
  tableMount.className = 'st-table';

  // Paso 1: botón "Resetear records". Paso 2: "¿Seguro?" + Sí / Cancelar.
  const resetBox = document.createElement('div');
  resetBox.className = 'st-reset';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'st-btn st-reset-btn';
  resetBtn.textContent = 'Resetear records';

  const confirmBox = document.createElement('div');
  confirmBox.className = 'st-confirm hidden';
  confirmBox.setAttribute('role', 'group');
  confirmBox.setAttribute('aria-label', 'Confirmar borrado de records');

  const confirmText = document.createElement('span');
  confirmText.className = 'st-confirm-text';
  confirmText.textContent = '¿Seguro?';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'st-btn st-btn-danger';
  yesBtn.textContent = 'Sí, borrar';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'st-btn';
  cancelBtn.textContent = 'Cancelar';

  confirmBox.append(confirmText, yesBtn, cancelBtn);
  resetBox.append(resetBtn, confirmBox);
  recordsMount.append(title, tableMount, resetBox);

  let confirmTimer = null;

  function hasData() {
    const { bestCombo, maxLines } = Scores.stats();
    return Scores.top().length > 0 || bestCombo > 0 || maxLines > 0;
  }

  // Vuelve al primer paso (botón normal) y detiene el temporizador.
  function cancelConfirm() {
    clearTimeout(confirmTimer);
    confirmTimer = null;
    confirmBox.classList.add('hidden');
    resetBtn.classList.remove('hidden');
  }

  function askConfirm() {
    resetBtn.classList.add('hidden');
    confirmBox.classList.remove('hidden');
    cancelBtn.focus(); // opción segura por defecto
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      const hadFocus = confirmBox.contains(document.activeElement);
      cancelConfirm();
      if (hadFocus && activeScreen() === 'start') resetBtn.focus();
    }, CONFIRM_TIMEOUT_MS);
  }

  function renderRecords() {
    Scores.renderTable(tableMount, -1);
    if (hasData()) {
      resetBox.classList.remove('hidden');
    } else {
      cancelConfirm();
      resetBox.classList.add('hidden');
    }
  }

  resetBtn.addEventListener('click', askConfirm);

  cancelBtn.addEventListener('click', () => {
    cancelConfirm();
    resetBtn.focus();
  });

  // Escape también cancela la confirmación (con el foco dentro de ella).
  confirmBox.addEventListener('keydown', e => {
    if (e.code !== 'Escape') return;
    cancelConfirm();
    resetBtn.focus();
  });

  yesBtn.addEventListener('click', () => {
    cancelConfirm();
    Scores.reset();
    renderRecords();
    playBtn.focus(); // el botón de reset se oculta: devolvemos el foco a Jugar
  });

  // ---- Opciones y Jugar --------------------------------------------------------

  buildOptionsPanel(optionsMount); // una sola vez

  playBtn.classList.add('st-play');
  playBtn.addEventListener('click', () => init(getStartLevel()));

  // ---- Hooks -------------------------------------------------------------------

  // Al disparar `ready` la pantalla aún está oculta (game.js hace showScreen justo
  // después): esperamos un tick para que el foco en Jugar sea efectivo.
  onHook('ready', () => {
    setTimeout(() => {
      if (activeScreen() === 'start') playBtn.focus();
    }, 0);
  });

  // Por si la pantalla se reutiliza más adelante, repintamos al cambiar de partida.
  onHook('newGame', () => {
    cancelConfirm();
    renderRecords();
  });
  onHook('gameOver', () => {
    cancelConfirm();
    renderRecords();
  });

  renderRecords();
})();
