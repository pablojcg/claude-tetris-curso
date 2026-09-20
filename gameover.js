'use strict';

// Pantalla de Game Over (#screen-gameover). game.js la muestra tras disparar el
// hook 'gameOver' con { score, lines, level, maxCombo, maxLinesAtOnce }.
// OJO: Espacio es la caída rápida; no des foco automático a ningún botón aquí o un
// jugador machacando Espacio reiniciaría la partida sin querer.

const gameoverScoreEl = document.getElementById('gameover-score');

onHook('gameOver', ({ score }) => {
  gameoverScoreEl.textContent = `Puntuación: ${score.toLocaleString()}`;
});

document.getElementById('restart-btn').addEventListener('click', () => init());
