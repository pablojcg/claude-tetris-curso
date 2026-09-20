'use strict';

// Motor de skins. game.js dibuja SIEMPRE a través de este objeto.
//
// Contrato (no cambiar las firmas: otros archivos dependen de ellas):
//   Skin.list()                 -> [{ id, name }]
//   Skin.current()              -> id de la skin activa
//   Skin.set(id)                -> aplica, persiste (STORAGE_KEYS.skin), pone body[data-skin]
//                                  y dispara el hook 'skinChange'. Devuelve el id aplicado.
//   Skin.drawBlock(context, x, y, colorIndex, size, alpha)
//                               -> dibuja UNA celda (x, y en unidades de celda). Debe respetar
//                                  `alpha` (la pieza fantasma usa 0.2) y dejar el contexto como
//                                  lo encontró (globalAlpha, shadowBlur...): usar save/restore.
//   Skin.gridColor()            -> color CSS de las líneas de la rejilla. game.js lo cachea y lo
//                                  vuelve a pedir al cambiar de tema o de skin.
//   Skin.beforeDraw(context) / Skin.afterDraw(context)
//                               -> envuelven cada repintado del tablero y de la vista previa.
//
// `COLORS` (game.js) es la paleta plana de la skin Retro; se lee en tiempo de dibujo.

const Skin = (() => {
  const DEFAULT_ID = 'retro';

  const skins = {
    retro: {
      name: 'Retro',
      drawBlock(context, x, y, colorIndex, size, alpha) {
        context.globalAlpha = alpha ?? 1;
        context.fillStyle = COLORS[colorIndex];
        context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
        // brillo superior
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
        context.globalAlpha = 1;
      },
    },
  };

  let currentId = DEFAULT_ID;

  function list() {
    return Object.entries(skins).map(([id, skin]) => ({ id, name: skin.name }));
  }

  function current() {
    return currentId;
  }

  function set(id) {
    currentId = skins[id] ? id : DEFAULT_ID;
    document.body.dataset.skin = currentId;
    saveString(STORAGE_KEYS.skin, currentId);
    fireHook('skinChange', currentId);
    return currentId;
  }

  function drawBlock(context, x, y, colorIndex, size, alpha) {
    if (!colorIndex) return;
    const skin = skins[currentId];
    skin.drawBlock(context, x, y, colorIndex, size, alpha);
  }

  function gridColor() {
    return getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  }

  function beforeDraw() {}
  function afterDraw() {}

  set(loadString(STORAGE_KEYS.skin, DEFAULT_ID));

  return { list, current, set, drawBlock, gridColor, beforeDraw, afterDraw };
})();
