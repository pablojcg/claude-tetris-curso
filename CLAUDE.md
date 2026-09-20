# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no package.json — plain `<script>` files sharing one global scope.

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

`game.js` owns the game state and loop; the rest of the UI is split into small scripts loaded in this order by `index.html`: `core.js` → `skins.js` → `scores.js` → `menus.js` → `gameover.js` → `start.js` → `game.js`. Each feature file owns its own `.js` and `css/<name>.css` and (re)builds its UI from JS inside its mount point, so features rarely touch each other's files.

- **`core.js`** (shared contracts): `STORAGE_KEYS` + `loadString/saveString/loadJSON/saveJSON` (never throw), the **hook bus** (`onHook`/`fireHook`; events: `ready`, `newGame`, `gameOver`, `pause`, `resume`, `lineClear`, `skinChange`, `startLevelChange`), the **screens** (`showScreen/hideScreens/activeScreen`, `#screen-start|pause|gameover`; `isInputLocked()` is true while any screen is visible or after `setInputLocked(true)`), `getStartLevel/setStartLevel`, and `buildOptionsPanel(mount)` (level + skin selects shared by start and pause screens).
- **`skins.js`**: the `Skin` object (`list/current/set/drawBlock/gridColor/beforeDraw/afterDraw`). `game.js` draws only through it. `set()` sets `body[data-skin]`, persists and fires `skinChange`.
- **`scores.js`**: the `Scores` object (top 5 + best combo / max lines in localStorage). Player names are user input: render with `textContent`, never `innerHTML`. Everything read from localStorage is sanitized in `read()` (types, NaN, order, max 5 entries, names trimmed to 12 chars, empty → "Anónimo"), so public functions never throw on corrupt data; ties keep the older entry ahead. Table styles live in `css/scores.css`.
- `menus.js` (pause menu), `gameover.js` (game-over screen), `start.js` (start screen). Space is hard drop, so never auto-focus a button on the game-over screen.
- `.hidden` is a global utility class in `style.css`; overlays are `.screen` / `.screen-box`, buttons are `.btn`.

Key concepts in `game.js` to understand before making changes:

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece color index (1–8).
- **Pieces**: `PIECES` defines each tetromino as a square matrix of color indices. Rotation (`rotateCW`) is a transpose + row-reverse, not a lookup table — there's no separate rotation-state per piece. Type 8 is a non-standard 3×3 hollow square piece (`[[8,8,8],[8,0,8],[8,8,8]]`) spawned via `HOLLOW_CHANCE` (1/15) in `randomPiece()` instead of the uniform 1-in-7 roll. Its center `0` is intentional: once locked, that cell can never be filled by another piece, permanently blocking that row — this is the intended challenge, not a bug.
- **Collision** (`collide`): the single source of truth for whether a shape can occupy a position; used by movement, rotation, ghost-piece projection, and locking.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and takes the first that doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time in `dropAccum` and advances the piece one row once `dropAccum >= dropInterval`.
- **Locking/line-clear** (`lockPiece` → `merge` + `clearLines` + `spawn`): `clearLines` scans bottom-up, splices out full rows, and unshifts empty rows at the top.
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; level increments every 10 lines; `dropInterval = intervalFor(level) = max(100, 1000 - (level-1)*90)`. The starting level comes from `init(startLevel)` (defaults to `getStartLevel()`); `levelOffset = startLevel - 1` is added to the lines-based level. **Combo** = consecutive pieces that cleared lines (`combo`, `maxCombo`, `maxLinesAtOnce` are reset in `init()` and reported in the `gameOver` hook payload).
- **Ghost piece**: `ghostY()` projects the current piece straight down via repeated `collide` checks; drawn with `globalAlpha = 0.2` (`Skin.drawBlock` must honor the `alpha` argument).
- **Theme**: light/dark is a `light` class on `<body>` + CSS vars (`applyTheme`). `gridLineColor` is cached from `Skin.gridColor()`; `refreshLook()` re-reads it and repaints on theme/skin change.
- All module-level game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) is declared as loose top-level `let` bindings and mutated directly by functions — there are no classes or a state container.
- `init(startLevel)` (re)initializes all state and starts the loop; the Play, Restart and pause-menu Restart buttons call it. Page load only shows the start screen (`started` stays false until the first `init()`).
- Input is a single `keydown` listener with a `switch` on `e.code`; `KeyP`/`Escape` toggle pause (`togglePause`, ignoring key repeat) before the `isInputLocked() || !started || paused || gameOver` guard that gates the rest.

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
