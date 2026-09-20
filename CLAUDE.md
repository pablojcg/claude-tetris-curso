# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no package.json — just three files (`index.html`, `style.css`, `game.js`).

## Running the game

There is no build/lint/test tooling. To run:

```bash
start index.html        # Windows: open directly in the browser
# or serve locally (needed if testing anything that requires http:// origin)
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000`. Changes to `game.js`/`style.css`/`index.html` are picked up on browser refresh — no compilation step.

There are no automated tests. Verify changes by playing the game in a browser (see the Controls table in README.md).

## Architecture

Everything lives in `game.js` (~300 lines), which owns the entire game state and loop. Key concepts to understand before making changes:

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece color index (1–8).
- **Pieces**: `PIECES` defines each tetromino as a square matrix of color indices. Rotation (`rotateCW`) is a transpose + row-reverse, not a lookup table — there's no separate rotation-state per piece. Type 8 is a non-standard 3×3 hollow square piece (`[[8,8,8],[8,0,8],[8,8,8]]`) spawned via `HOLLOW_CHANCE` (1/15) in `randomPiece()` instead of the uniform 1-in-7 roll. Its center `0` is intentional: once locked, that cell can never be filled by another piece, permanently blocking that row — this is the intended challenge, not a bug.
- **Collision** (`collide`): the single source of truth for whether a shape can occupy a position; used by movement, rotation, ghost-piece projection, and locking.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and takes the first that doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time in `dropAccum` and advances the piece one row once `dropAccum >= dropInterval`.
- **Locking/line-clear** (`lockPiece` → `merge` + `clearLines` + `spawn`): `clearLines` scans bottom-up, splices out full rows, and unshifts empty rows at the top.
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; level = `baseLevel + floor(lines/10)` where `baseLevel` is the start level chosen in the pause menu (captured in `init()`; `startLevel` is the selector value for the *next* game, persisted in `localStorage`); `dropInterval = intervalForLevel(level) = max(100, 1000 - (level-1)*90)`.
- **Ghost piece**: `ghostY()` projects the current piece straight down via repeated `collide` checks; drawn with `globalAlpha = 0.2`.
- **Skins**: `SKINS` maps a skin name (`retro`, `neon`, `pastel`, `pixel`) to `{ colors, drawBlock, forceDark }`. The top-level `drawBlock(context, x, y, colorIndex, size, alpha)` is a dispatcher: it looks up the active skin and calls its own draw function, so `draw()`, `drawNext()` and the ghost piece are skin-agnostic. To add a skin, add a palette (indexed like `PIECES`), a draw function, a `SKINS` entry, and an `<option>` in `#skin-select`. Skin is independent of the light/dark theme (`theme`); `applyAppearance()` combines them, sets `body.dataset.skin`, and redraws immediately. A skin with `forceDark` (Neon) removes `body.light` and disables the theme toggle; its palette lives in `body[data-skin="neon"]` in `style.css`. Both preferences persist via `loadPref`/`savePref` (`tetris-skin`, `tetris-theme`), which tolerate `localStorage` failures. The keydown handler ignores events targeting `#skin-select` so arrow keys don't move the piece while the selector is focused.
- All module-level game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) is declared as loose top-level `let` bindings and mutated directly by functions — there are no classes or a state container.
- `init()` (re)initializes all state and starts the loop; the restart button and initial page load both call it.
- Input is a single `keydown` listener with a `switch` on `e.code`; `KeyP`/`Escape` toggle pause (Escape inside the controls view goes back to the pause menu) before the `gameOver`/`paused` guard that gates the rest, so game keys are ignored while the menu is open.
- **Overlay views**: `#overlay` holds three mutually exclusive views (`gameover`, `pause`, `controls`) switched by `showOverlayView(name)`; `pauseGame`/`resumeGame` own pause state.

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
