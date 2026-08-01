'use strict';

/**
 * ui.js — DOM rendering, click handling, AI integration, piece animation
 */

const UI = (() => {

  /* ── UI state ─────────────────────────────────────────────── */

  let _selectedSquare   = null;
  let _legalMoves       = [];
  let _flipped          = false;
  let _pendingPromotion = null;
  let _animating        = false;  // blocks input during move animation

  // AI state
  let _aiEnabled    = false;
  let _aiDifficulty = 'medium';
  let _aiColor      = 'black';
  let _aiThinking   = false;

  /* ── Coordinate helpers ───────────────────────────────────── */

  function fromDisplay(dr, dc) {
    return _flipped
      ? { row: 7 - dr, col: 7 - dc }
      : { row: dr,     col: dc     };
  }

  function toDisplayCoords(row, col) {
    return _flipped
      ? { dr: 7 - row, dc: 7 - col }
      : { dr: row,     dc: col     };
  }

  // Get the square size from CSS variable (px)
  function getSquareSize() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 76;
  }

  /* ── Piece movement animation ─────────────────────────────── */

  /**
   * Animates a piece flying from its source square to the destination,
   * then calls callback() once the transition finishes.
   *
   * Approach:
   *   1. Render the board WITHOUT the moving piece (pass exclusion coords)
   *   2. Create an absolutely-positioned clone at the source square center
   *   3. CSS transition it to the destination square center
   *   4. On transitionend: remove clone, call callback (full re-render)
   */
  function animatePieceMove(move, piece, onComplete) {
    const boardEl = document.getElementById('chess-board');
    const sq      = getSquareSize();

    const fromD = toDisplayCoords(move.from.row, move.from.col);
    const toD   = toDisplayCoords(move.to.row,   move.to.col);

    // Pixel center of source square (relative to board top-left)
    const fromX = fromD.dc * sq + sq * 0.5;
    const fromY = fromD.dr * sq + sq * 0.5;

    // Delta to destination
    const dx = (toD.dc - fromD.dc) * sq;
    const dy = (toD.dr - fromD.dr) * sq;

    // Build the flying piece element
    const flyEl = document.createElement('span');
    flyEl.className    = `piece piece-${piece.color} piece-flying`;
    flyEl.textContent  = Pieces.getSymbol(piece);
    flyEl.style.left   = `${fromX}px`;
    flyEl.style.top    = `${fromY}px`;
    flyEl.style.fontSize = `calc(var(--sq) * 0.8)`;

    boardEl.appendChild(flyEl);

    // Force a reflow so the starting position is painted before we transition
    flyEl.getBoundingClientRect();

    // Trigger the transition
    flyEl.style.transform = `translate(${dx}px, ${dy}px)`;

    flyEl.addEventListener('transitionend', () => {
      flyEl.remove();
      onComplete();
    }, { once: true });
  }

  /* ── Board rendering ──────────────────────────────────────── */

  /**
   * @param {Object|null} hideSquare - { row, col } of a piece to skip rendering
   *   (used during animation so the flying clone doesn't duplicate it)
   * @param {Object|null} lastMove   - { from, to } for move-history highlight
   */
  function renderBoard(hideSquare = null, lastMove = null) {
    const el    = document.getElementById('chess-board');
    const state = Game.getState();

    // Preserve any flying piece elements that are mid-animation
    const flyingEls = [...el.querySelectorAll('.piece-flying')];

    el.innerHTML = '';

    // Re-attach any in-flight animation elements
    flyingEls.forEach(f => el.appendChild(f));

    for (let dr = 0; dr < 8; dr++) {
      for (let dc = 0; dc < 8; dc++) {
        const { row, col } = fromDisplay(dr, dc);
        const sq = document.createElement('div');
        sq.className = 'square';
        sq.dataset.row = row;
        sq.dataset.col = col;

        sq.classList.add((row + col) % 2 === 0 ? 'sq-light' : 'sq-dark');

        // Last-move highlight (both from and to squares)
        if (lastMove) {
          const isFrom = lastMove.from.row === row && lastMove.from.col === col;
          const isTo   = lastMove.to.row   === row && lastMove.to.col   === col;
          if (isFrom || isTo) sq.classList.add('sq-move-history');
        }

        // Selected square
        if (_selectedSquare && _selectedSquare.row === row && _selectedSquare.col === col) {
          sq.classList.add('sq-selected');
        }

        // Legal-move overlays
        const isTarget = _legalMoves.some(m => m.to.row === row && m.to.col === col);
        if (isTarget) {
          sq.classList.add(state.board[row][col] ? 'sq-capture' : 'sq-move');
        }

        // Check glow on king
        const piece = state.board[row][col];
        if (piece && piece.type === 'king' && piece.color === state.turn &&
            (state.status === 'check' || state.status === 'checkmate')) {
          sq.classList.add('sq-check');
        }

        // Render piece — skip the one that's currently flying
        const isHidden = hideSquare && hideSquare.row === row && hideSquare.col === col;
        if (piece && !isHidden) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece piece-${piece.color}`;
          pieceEl.textContent = Pieces.getSymbol(piece);
          pieceEl.setAttribute('aria-label', `${piece.color} ${piece.type}`);
          sq.appendChild(pieceEl);
        }

        sq.addEventListener('click', () => onSquareClick(row, col));
        el.appendChild(sq);
      }
    }
  }

  /* ── Coordinates ──────────────────────────────────────────── */

  function renderCoordinates() {
    const FILES = _flipped ? 'hgfedcba' : 'abcdefgh';
    const RANKS = _flipped ? '12345678' : '87654321';

    const rankEl = document.getElementById('rank-labels');
    rankEl.innerHTML = '';
    for (const r of RANKS) {
      const d = document.createElement('div');
      d.className = 'rank-label';
      d.textContent = r;
      rankEl.appendChild(d);
    }

    const fileEl = document.getElementById('file-labels');
    fileEl.innerHTML = '';
    for (const f of FILES) {
      const d = document.createElement('div');
      d.className = 'file-label';
      d.textContent = f;
      fileEl.appendChild(d);
    }
  }

  /* ── Status ───────────────────────────────────────────────── */

  function renderStatus() {
    const el    = document.getElementById('game-status');
    const state = Game.getState();

    if (_aiThinking) {
      el.textContent = 'AI IS THINKING...';
      el.className   = 'game-status';
      return;
    }

    const turn   = state.turn.toUpperCase();
    const winner = state.turn === 'white' ? 'BLACK' : 'WHITE';

    const msgs = {
      checkmate: `CHECKMATE — ${winner} WINS`,
      stalemate: 'STALEMATE — DRAW',
      check:     `${turn} IS IN CHECK`,
      playing:   `${turn} TO MOVE`,
    };

    el.textContent = msgs[state.status] ?? msgs.playing;
    el.className   = 'game-status';

    if (state.status === 'checkmate')      el.classList.add('status-checkmate');
    else if (state.status === 'check')     el.classList.add('status-check');
    else if (state.status === 'stalemate') el.classList.add('status-stalemate');
  }

  /* ── Move history ─────────────────────────────────────────── */

  function renderHistory() {
    const list  = document.getElementById('history-list');
    const moves = Game.getState().moveHistory;
    list.innerHTML = '';

    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'history-row';

      const numEl = document.createElement('span');
      numEl.className = 'move-num';
      numEl.textContent = (Math.floor(i / 2) + 1) + '.';
      row.appendChild(numEl);

      const wEl = document.createElement('span');
      wEl.className = 'move-white';
      wEl.textContent = annotated(moves[i]);
      row.appendChild(wEl);

      if (moves[i + 1]) {
        const bEl = document.createElement('span');
        bEl.className = 'move-black';
        bEl.textContent = annotated(moves[i + 1]);
        row.appendChild(bEl);
      }

      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  function annotated(r) {
    return r.notation + (r.checkmate ? '#' : r.check ? '+' : '');
  }

  /* ── Captured pieces ──────────────────────────────────────── */

  function renderCaptured() {
    const state = Game.getState();
    const wCap  = document.getElementById('white-captured');
    const bCap  = document.getElementById('black-captured');
    if (wCap) wCap.innerHTML = state.capturedPieces.white.map(t => `<span class="cap-piece">${Pieces.SYMBOLS.black[t]}</span>`).join('');
    if (bCap) bCap.innerHTML = state.capturedPieces.black.map(t => `<span class="cap-piece">${Pieces.SYMBOLS.white[t]}</span>`).join('');
  }

  /* ── Full render ──────────────────────────────────────────── */

  function render(lastMove = null) {
    renderBoard(null, lastMove);
    renderCoordinates();
    renderStatus();
    renderHistory();
    renderCaptured();
  }

  /* ── Click handler ────────────────────────────────────────── */

  function onSquareClick(row, col) {
    const state = Game.getState();

    if (state.status === 'checkmate' || state.status === 'stalemate') return;
    if (_animating || _aiThinking || _pendingPromotion) return;
    if (_aiEnabled && state.turn === _aiColor) return;

    if (_selectedSquare) {
      const move = _legalMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        if (move.isPromotion) {
          _pendingPromotion = move;
          showPromoModal(state.turn);
        } else {
          commitMove(move);
        }
        return;
      }
    }

    const piece = state.board[row][col];
    if (piece && piece.color === state.turn) {
      if (_selectedSquare && _selectedSquare.row === row && _selectedSquare.col === col) {
        _selectedSquare = null;
        _legalMoves     = [];
      } else {
        _selectedSquare = { row, col };
        _legalMoves     = Game.getLegalMovesFromSquare(row, col);
      }
    } else {
      _selectedSquare = null;
      _legalMoves     = [];
    }

    renderBoard();
  }

  /* ── Move commit (with animation) ────────────────────────── */

  function commitMove(move) {
    const state    = Game.getState();
    const piece    = state.board[move.from.row][move.from.col];

    _selectedSquare = null;
    _legalMoves     = [];
    _animating      = true;

    // Show the board with the source square hidden (piece will fly there)
    renderBoard(move.from, null);

    animatePieceMove(move, piece, () => {
      _animating = false;

      // Now apply the move to the game state
      const finalMove = move.isPromotion ? { ...move, promoteTo: move.promoteTo ?? 'queen' } : move;
      Game.executeMove(finalMove);

      const newState = Game.getState();

      // Add a landing animation to the piece that just arrived
      render(move);

      // Small pulse on the destination piece
      requestAnimationFrame(() => {
        const boardEl = document.getElementById('chess-board');
        const { dr, dc } = toDisplayCoords(move.to.row, move.to.col);
        const idx = dr * 8 + dc;
        const destSq = boardEl.children[idx];
        if (destSq) {
          const pieceEl = destSq.querySelector('.piece');
          if (pieceEl) {
            pieceEl.classList.add('piece-landing');
            pieceEl.addEventListener('animationend', () => pieceEl.classList.remove('piece-landing'), { once: true });
          }
        }
      });

      // Trigger AI if needed
      if (_aiEnabled && newState.turn === _aiColor &&
          newState.status !== 'checkmate' && newState.status !== 'stalemate') {
        scheduleAIMove();
      }
    });
  }

  /* ── AI move scheduling ───────────────────────────────────── */

  function scheduleAIMove() {
    _aiThinking = true;
    renderStatus();
    setThinkingBar(true);

    setTimeout(() => {
      const state    = Game.getState();
      const bestMove = AI.getBestMove(state.board, state, _aiColor, _aiDifficulty);

      _aiThinking = false;
      setThinkingBar(false);

      if (bestMove) {
        const finalMove = bestMove.isPromotion ? { ...bestMove, promoteTo: 'queen' } : bestMove;
        commitMove(finalMove);
      } else {
        render();
      }
    }, 60);
  }

  function setThinkingBar(visible) {
    document.getElementById('thinking-bar')?.classList.toggle('hidden', !visible);
  }

  /* ── Promotion modal ──────────────────────────────────────── */

  function showPromoModal(color) {
    const modal   = document.getElementById('promotion-modal');
    const options = document.getElementById('promotion-options');
    options.innerHTML = '';

    for (const type of Pieces.PROMOTION_TYPES) {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.title = Pieces.getName(type);

      const sym = document.createElement('span');
      sym.className = `piece-${color}`;
      sym.textContent = Pieces.SYMBOLS[color][type];
      btn.appendChild(sym);

      btn.addEventListener('click', () => {
        const finalMove = { ..._pendingPromotion, promoteTo: type };
        _pendingPromotion = null;
        modal.classList.add('hidden');
        commitMove(finalMove);
      });

      options.appendChild(btn);
    }

    modal.classList.remove('hidden');
  }

  /* ── AI panel controls ────────────────────────────────────── */

  function initAIControls() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn-active'));
        btn.classList.add('mode-btn-active');
        _aiEnabled = btn.dataset.mode === 'ai';
        document.getElementById('ai-options').classList.toggle('hidden', !_aiEnabled);

        const state = Game.getState();
        if (_aiEnabled && state.turn === _aiColor &&
            state.status !== 'checkmate' && state.status !== 'stalemate') {
          scheduleAIMove();
        }
      });
    });

    document.querySelectorAll('.diff-btn[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn[data-diff]').forEach(b => b.classList.remove('diff-btn-active'));
        btn.classList.add('diff-btn-active');
        _aiDifficulty = btn.dataset.diff;
      });
    });

    document.querySelectorAll('.diff-btn[data-side]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn[data-side]').forEach(b => b.classList.remove('diff-btn-active'));
        btn.classList.add('diff-btn-active');
        _aiColor = btn.dataset.side === 'white' ? 'black' : 'white';
      });
    });
  }

  /* ── Init ─────────────────────────────────────────────────── */

  function init() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      Game.reset();
      _selectedSquare   = null;
      _legalMoves       = [];
      _pendingPromotion = null;
      _animating        = false;
      _aiThinking       = false;
      setThinkingBar(false);
      document.getElementById('promotion-modal').classList.add('hidden');
      render();

      const state = Game.getState();
      if (_aiEnabled && state.turn === _aiColor) scheduleAIMove();
    });

    document.getElementById('btn-flip-board').addEventListener('click', () => {
      _flipped = !_flipped;
      render();
    });

    initAIControls();
    render();
  }

  return { init, render };

})();
