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
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; level increments every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Combo**: `lockPiece` tracks `combo` (consecutive locks that each clear ≥1 line; reset by a lock that clears nothing) and `maxCombo` for the current game. `clearLines` returns the number of lines cleared.
- **Records** (`localStorage` key `tetris-records`, `{ top: [{name, score}], bestCombo, maxLines }`): `loadRecords` validates whatever is stored and falls back to empty records; the top is capped at `MAX_RECORDS` (5) and ties go below existing entries. `bestCombo`/`maxLines` are global bests updated in `endGame()` regardless of the top 5. If the score qualifies, `endGame()` sets `pendingScore` and shows the name form; `savePendingScore()` inserts it, and the restart button calls it too (blank name → `ANÓNIMO`) so a record is never lost. Names are rendered with `textContent`.
- **Overlay states**: `showOverlay()` is the single entry point for the start screen (`Jugar`, records shown), game over (records + name form) and pause (no records). Nothing runs on page load until `Jugar` is clicked: `gameOver` starts `true` so the keydown handler stays inert.
- **Ghost piece**: `ghostY()` projects the current piece straight down via repeated `collide` checks; drawn with `globalAlpha = 0.2`.
- All module-level game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) is declared as loose top-level `let` bindings and mutated directly by functions — there are no classes or a state container.
- `init()` (re)initializes all state and starts the loop; the overlay button (`Jugar` / `Reiniciar`) calls it. Page load only calls `showStartScreen()`.
- Input is a single `keydown` listener with a `switch` on `e.code`; `KeyP` toggles pause independent of `gameOver`/`paused` guards that gate the rest.

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
