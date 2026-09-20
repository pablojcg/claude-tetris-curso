'use strict';

// Menú de pausa (#screen-pause > #pause-menu). game.js muestra/oculta la pantalla
// y dispara los hooks 'pause' / 'resume'; aquí solo vive el contenido del menú.
// Para reanudar usa togglePause() y para reiniciar init() (ambas de game.js).
// P y Escape los gestiona game.js globalmente: aquí no se reimplementan.

// [teclas, acción, separador entre teclas]
const CONTROLS_HELP = [
  [['←', '→'], 'mover', ''],
  [['↑', 'X'], 'rotar', 'o'],
  [['↓'], 'bajar', ''],
  [['Espacio'], 'caída', ''],
  [['P', 'Esc'], 'pausa', '/'],
];

const pauseMenu = document.getElementById('pause-menu');

function pmButton(text, extraClass, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn pm-btn ${extraClass}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

// Lista de teclas: un <kbd> por tecla, con separador ("o", "/") si hay varias.
function pmControlsList() {
  const list = document.createElement('ul');
  list.className = 'pm-controls';
  for (const [keys, action, sep] of CONTROLS_HELP) {
    const item = document.createElement('li');
    keys.forEach((key, i) => {
      if (i > 0 && sep) item.append(document.createTextNode(` ${sep} `));
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      item.append(kbd);
    });
    item.append(document.createTextNode(` ${action}`));
    list.append(item);
  }
  return list;
}

// Vista principal: Reanudar, Reiniciar, Ver controles y las opciones compartidas.
const mainView = document.createElement('div');
mainView.className = 'pm-view pm-main';

const resumeBtn = pmButton('Reanudar', 'pm-resume', () => togglePause());
const restartBtn = pmButton('Reiniciar', 'pm-restart', () => init());
const controlsBtn = pmButton('Ver controles', 'pm-secondary pm-controls-btn', () => showView('controls'));

const optionsMount = document.createElement('div');
optionsMount.className = 'pm-options';
const options = buildOptionsPanel(optionsMount); // una sola vez: se sincroniza por hooks
const optionsNote = document.createElement('p');
optionsNote.className = 'pm-note';
optionsNote.textContent = 'El nivel inicial se aplica a la próxima partida';
optionsMount.append(optionsNote);

mainView.append(resumeBtn, restartBtn, controlsBtn, optionsMount);

// Subvista: lista de teclas y botón Volver.
const controlsView = document.createElement('div');
controlsView.className = 'pm-view pm-controls-view hidden';

const controlsTitle = document.createElement('p');
controlsTitle.className = 'pm-subtitle';
controlsTitle.textContent = 'Controles';
const backBtn = pmButton('Volver', 'pm-secondary pm-back', () => showView('main'));
controlsView.append(controlsTitle, pmControlsList(), backBtn);

// Reconstruye el contenido: sustituye los botones provisionales de la base.
pauseMenu.replaceChildren(mainView, controlsView);

// Muestra una vista. Con focus=true mueve el foco a un botón de la vista visible
// (nunca queda en un elemento oculto).
function showView(name, focus = true) {
  const isControls = name === 'controls';
  mainView.classList.toggle('hidden', isControls);
  controlsView.classList.toggle('hidden', !isControls);
  if (!focus) return;
  (isControls ? backBtn : controlsBtn).focus();
}

// Tab no debe escapar del menú hacia los controles que quedan debajo del overlay
// (p. ej. el interruptor de tema): el foco cicla entre los elementos visibles del menú.
document.addEventListener('keydown', e => {
  if (e.code !== 'Tab' || activeScreen() !== 'pause') return;
  const view = mainView.classList.contains('hidden') ? controlsView : mainView;
  const items = [...view.querySelectorAll('button, select')];
  const first = items[0], last = items[items.length - 1];
  if (!view.contains(document.activeElement)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

onHook('pause', () => {
  setInputLocked(true);
  showView('main', false);
  options.sync();
  resumeBtn.focus();
});

onHook('resume', () => {
  setInputLocked(false);
  showView('main', false);
});

onHook('newGame', () => {
  setInputLocked(false);
  showView('main', false);
});
