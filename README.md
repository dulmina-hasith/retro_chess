# RETRO_♟_CHESS

A **fully functional, browser-based chess game** — no frameworks, no backend, no dependencies. Built for **clean gameplay, responsive design, and professional UI/UX**.

[![Play Chess](https://img.shields.io/badge/Play_Chess-LIVE_DEMO-81b64c?style=for-the-badge&logo=lichess&logoColor=white)](https://dulmina-hasith.github.io/retro_chess/)

---

## Quick Start

Open `index.html` in any modern browser. No server required.

---

## Features

### Core Rules
- Legal move validation for all piece types
- Check & checkmate detection
- Stalemate detection
- Castling — kingside and queenside
- En passant
- Pawn promotion (choose queen, rook, bishop, or knight)
- Turn-based play (white vs black)

### AI Opponent
- Play against the computer or pass-and-play with a friend — toggle between **2 Player** and **AI** modes
- Three difficulty levels, implemented as search depth:
  - **Easy** — depth 2 (fast, occasionally blunders)
  - **Medium** — depth 3 (solid, catches basic tactics)
  - **Hard** — depth 5 (looks ~5 half-moves ahead, punishes mistakes)
- Choose to **play as White or Black**
- Engine uses **minimax search with alpha-beta pruning**, move ordering by MVV-LVA (captures searched before quiet moves for faster cutoffs), and a **material + piece-square table** evaluation function
- **"AI Thinking"** indicator while the engine calculates its move

### User Interface
- Click to select a piece, click to move
- Visual move highlighting:
  - Dots for empty squares (legal moves)
  - Rings for capture targets
  - Highlighted selected square
- Check indicator (pulsing red on the king)
- Move history panel with algebraic notation (including `+` and `#`)
- Captured pieces display, per player
- Board flip option (play from black's perspective)
- New Game button
- Pawn promotion modal

---

## Theme / UI

Inspired by **Chess.com Dark Mode**:

| Element          | Color / Value                          |
|------------------|-----------------------------------------|
| Page background  | `#312e2b`                               |
| Panel background | `#262421`                               |
| Dark squares     | `#739552`                               |
| Light squares    | `#ebecd0`                               |
| White pieces     | `#ffffff`                               |
| Black pieces     | `#000000`                               |
| Move / selected  | yellow, 50% α                           |
| Legal move / capture ring | translucent black                |
| Check indicator  | red, 80% α                              |
| Buttons          | accent `#81b64c`, secondary `#363431`   |

Additional details:
- Fully responsive board — squares and pieces scale for tablets and mobile
- Pieces use **text-stroke and drop shadows** for contrast and depth
- Headings set in **Cinzel**, UI/mono elements in **Share Tech Mono**
- Promotion modal, move history, AI panel, and controls all match the dark mode aesthetic

---

## File Structure

```text
retro_chess/
├── index.html           # Entry point
├── README.md
├── css/
│   └── styles.css       # Dark theme, responsive layout
└── js/
    ├── pieces.js        # Piece symbols, values, metadata
    ├── rules.js         # Move generation, check detection, all special rules
    ├── board.js         # Board creation and initial layout
    ├── game.js          # Game state, move execution, history
    ├── ai.js            # Chess engine — minimax + alpha-beta, PST evaluation
    ├── ui.js             # DOM rendering, event handling, AI mode controls
    └── main.js           # Bootstrap (DOMContentLoaded)
```

---

## Architecture

```
pieces.js ──► rules.js (pure logic, no DOM)
                  │
board.js ─────────┤
                  ▼
              game.js (state machine)
                  │
                  ▼
              ai.js (search engine, reads board + state, returns a move)
                  │
                  ▼
              ui.js (all DOM rendering, wires AI into game loop)
                  │
                  ▼
              main.js (entry point)
```

- `rules.js` is **stateless and functional** — inputs: board + state; outputs: results only.
- `game.js` manages the **canonical game state** and exposes an immutable-update API.
- `ai.js` is **stateless and functional**, like `rules.js` — given a board, state, color, and difficulty, it returns the best move via minimax with alpha-beta pruning. It calls into `Rules.getAllLegalMoves` / `Rules.applyMove` and never touches the DOM.
- `ui.js` updates the DOM based on `game.js` state, and — in AI mode — triggers `ai.js` after the human's move and applies the returned move through the same execution path as a human move.
- `main.js` initializes the game on page load.

---

## Extending the Game

- **Timers** — Add `clock.js` to count down per-player time, integrated with `Game.executeMove()`.
- **Persistence** — Save game state to `localStorage` after each move.
- **Undo/Redo** — Maintain a **state history array** and implement `undo()` / `redo()`.
- **Move Notation Export** — Export `state.moveHistory` in **PGN format**.
- **Stronger AI** — Add iterative deepening, transposition tables, or quiescence search on top of the existing minimax/alpha-beta engine.

---

## License

— free to use, modify, and share.

---

## Screenshot

![GAME](retro_chess.png)

**Note:** The UI theme is **inspired by Chess.com Dark Mode**
