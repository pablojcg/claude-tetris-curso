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

  // Paletas de 8 colores por skin (índices 1-8; el 8 es la pieza hueca). Retro usa COLORS.
  const NEON_COLORS = [null, '#00f0ff', '#fff200', '#c13cff', '#39ff14', '#ff2a4d', '#2f7bff', '#ff9a1a', '#ff36c8'];
  const PASTEL_COLORS = [null, '#a8e6ef', '#fff0a6', '#d6b9f0', '#b6e6b6', '#ffb7b7', '#b2c8ff', '#ffd4a6', '#ffb6da'];
  const PIXEL_COLORS = [null, '#00c8e8', '#f8d800', '#b040e0', '#30c030', '#e02828', '#2868f0', '#f88010', '#f83898'];

  // Rectángulo redondeado con arcTo (no depende de context.roundRect).
  function roundRectPath(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  // Las skins con capas superpuestas (brillos, bisel, textura) o con shadowBlur se pintan UNA vez
  // por (skin, color, tamaño) en un sprite fuera de pantalla y luego solo se copian con drawImage:
  //  - rendimiento: ~200 celdas por frame sin recalcular sombras ni decenas de rects;
  //  - alpha: el bloque completo se compone de una vez, así la pieza fantasma (alpha 0.2) no
  //    acumula opacidad donde se solapan las capas.
  // Cada skin de sprite define `colors`, `pad(size)` (margen para el resplandor) y `paint(g, ox, oy, size, color)`,
  // que pinta el bloque con esquina superior izquierda en (ox, oy) y siempre con alpha 1.
  const spriteCache = new Map();

  function spriteFor(id, skin, colorIndex, size) {
    const key = `${id}:${colorIndex}:${size}`;
    let sprite = spriteCache.get(key);
    if (sprite) return sprite;
    const pad = skin.pad(size);
    const canvasEl = document.createElement('canvas');
    canvasEl.width = canvasEl.height = size + pad * 2;
    skin.paint(canvasEl.getContext('2d'), pad, pad, size, skin.colors[colorIndex]);
    sprite = { canvas: canvasEl, pad };
    spriteCache.set(key, sprite);
    return sprite;
  }

  function drawSprite(id, context, x, y, colorIndex, size, alpha) {
    const skin = skins[id];
    if (!skin.colors[colorIndex]) return;
    const { canvas: sprite, pad } = spriteFor(id, skin, colorIndex, size);
    context.globalAlpha = alpha ?? 1;
    context.drawImage(sprite, x * size - pad, y * size - pad);
  }

  // Patrón de textura 4x4 de la skin Pixel: 1 = píxel claro, 2 = píxel oscuro.
  const PIXEL_PATTERN = ['1020', '0201', '1020', '0201'];

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

    // Neon: contorno luminoso con shadowBlur sobre relleno tenue.
    neon: {
      name: 'Neon',
      colors: NEON_COLORS,
      pad: size => Math.round(size * 0.35) + 2,
      paint(g, ox, oy, size, color) {
        const blur = Math.round(size * 0.35);
        g.globalAlpha = 0.3;
        g.fillStyle = color;
        g.fillRect(ox + 3, oy + 3, size - 6, size - 6);
        g.globalAlpha = 1;
        g.shadowColor = color;
        g.shadowBlur = blur;
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.strokeRect(ox + 2, oy + 2, size - 4, size - 4);
        // filo interior claro (efecto tubo de neón), sin sombra
        g.shadowBlur = 0;
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 1;
        g.strokeRect(ox + 2, oy + 2, size - 4, size - 4);
      },
    },

    // Pastel: colores suaves y esquinas redondeadas.
    pastel: {
      name: 'Pastel',
      colors: PASTEL_COLORS,
      pad: () => 0,
      paint(g, ox, oy, size, color) {
        const px = ox + 1;
        const py = oy + 1;
        const s = size - 2;
        const r = Math.max(2, Math.round(size * 0.27));
        roundRectPath(g, px, py, s, s, r);
        g.fillStyle = color;
        g.fill();
        // brillo suave en la parte superior
        const hh = Math.round(s * 0.3);
        roundRectPath(g, px + 3, py + 3, s - 6, hh, Math.min(r * 0.6, hh / 2));
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fill();
        // contorno sutil para que se distinga sobre fondo claro
        roundRectPath(g, px + 0.5, py + 0.5, s - 1, s - 1, r);
        g.strokeStyle = 'rgba(90,60,120,0.28)';
        g.lineWidth = 1;
        g.stroke();
      },
    },

    // Pixel art: borde duro, bisel y textura 4x4 con colores saturados.
    pixel: {
      name: 'Pixel art',
      colors: PIXEL_COLORS,
      pad: () => 0,
      paint(g, ox, oy, size, color) {
        const px = ox + 1;
        const py = oy + 1;
        const s = size - 2;
        const bevel = Math.max(1, Math.round(size / 10));
        // borde duro
        g.fillStyle = '#0a0a14';
        g.fillRect(px, py, s, s);
        const ix = px + 1;
        const iy = py + 1;
        const is = s - 2;
        g.fillStyle = color;
        g.fillRect(ix, iy, is, is);
        // bisel: luz arriba/izquierda, sombra abajo/derecha
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(ix, iy, is, bevel);
        g.fillRect(ix, iy + bevel, bevel, is - bevel);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(ix + bevel, iy + is - bevel, is - bevel, bevel);
        g.fillRect(ix + is - bevel, iy + bevel, bevel, is - bevel * 2);
        // textura 4x4 dentro del bisel
        const inner = is - bevel * 2;
        const cell = Math.floor(inner / 4);
        const tx = ix + bevel + Math.floor((inner - cell * 4) / 2);
        const ty = iy + bevel + Math.floor((inner - cell * 4) / 2);
        for (let j = 0; j < 4; j++) {
          for (let i = 0; i < 4; i++) {
            const t = PIXEL_PATTERN[j][i];
            if (t === '0') continue;
            g.fillStyle = t === '1' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)';
            g.fillRect(tx + i * cell, ty + j * cell, cell, cell);
          }
        }
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
    currentId = Object.hasOwn(skins, id) ? id : DEFAULT_ID;
    document.body.dataset.skin = currentId;
    saveString(STORAGE_KEYS.skin, currentId);
    fireHook('skinChange', currentId);
    return currentId;
  }

  function drawBlock(context, x, y, colorIndex, size, alpha) {
    if (!colorIndex) return;
    // save/restore: ninguna skin filtra globalAlpha, shadowBlur, etc. al contexto del juego.
    context.save();
    const skin = skins[currentId];
    if (skin.paint) drawSprite(currentId, context, x, y, colorIndex, size, alpha);
    else skin.drawBlock(context, x, y, colorIndex, size, alpha);
    context.restore();
  }

  function gridColor() {
    return getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  }

  // Estado limpio antes y después de cada repintado (por si algo lo dejó sucio).
  function resetContext(context) {
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.shadowColor = 'rgba(0,0,0,0)';
  }

  function beforeDraw(context) {
    resetContext(context);
  }

  function afterDraw(context) {
    resetContext(context);
  }

  set(loadString(STORAGE_KEYS.skin, DEFAULT_ID));

  return { list, current, set, drawBlock, gridColor, beforeDraw, afterDraw };
})();
