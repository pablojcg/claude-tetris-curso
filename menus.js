'use strict';

// Menú de pausa (#screen-pause > #pause-menu). game.js muestra/oculta la pantalla
// y dispara los hooks 'pause' / 'resume'; aquí solo vive el contenido del menú.
// Para reanudar usa togglePause() y para reiniciar init() (ambas de game.js).

document.getElementById('resume-btn').addEventListener('click', () => togglePause());
document.getElementById('pause-restart-btn').addEventListener('click', () => init());
