'use strict';

/**
 * ai.js — Chess AI engine
 *
 * Algorithm : Minimax with alpha-beta pruning
 * Evaluation: Material + Piece-Square Tables (PST)
 * Move order : Captures first (MVV-LVA), then quiet moves
 *
 * Difficulty → search depth:
 *   easy   → 2  (responds immediately, makes occasional blunders)
 *   medium → 3  (solid play, catches basic tactics)
 *   hard   → 5  (looks ahead ~5 half-moves, punishes mistakes)
 */

const AI = (() => {

  /* ── Config ───────────────────────────────────────────────── */

  const DEPTH = { easy: 2, medium: 3, hard: 5 };

  /* ── Material values (centipawns) ─────────────────────────── */
  // King value is large to avoid trading it — used for checkmate scoring
  const MATERIAL = {
    pawn:   100,
    knight: 320,
    bishop: 330,
    rook:   500,
    queen:  900,
    king:   20000,
  };

  /* ── Piece-Square Tables ──────────────────────────────────── */
  //
  // Rows are board rows 0–7 (row 0 = rank 8).
  // Tables are written from WHITE's perspective:
  //   row 7 = rank 1 (white's back rank)
  //   row 0 = rank 8 (black's back rank)
  // For black pieces: mirror vertically (use 7 - row).
  //
  // Source: adapted from standard chess programming PSTs (chessprogramming.org)

  const PST = {
    pawn: [
      [  0,   0,   0,   0,   0,   0,   0,   0 ],
      [ 50,  50,  50,  50,  50,  50,  50,  50 ],
      [ 10,  10,  20,  30,  30,  20,  10,  10 ],
      [  5,   5,  10,  25,  25,  10,   5,   5 ],
      [  0,   0,   0,  20,  20,   0,   0,   0 ],
      [  5,  -5, -10,   0,   0, -10,  -5,   5 ],
      [  5,  10,  10, -20, -20,  10,  10,   5 ],
      [  0,   0,   0,   0,   0,   0,   0,   0 ],
    ],
    knight: [
      [-50, -40, -30, -30, -30, -30, -40, -50 ],
      [-40, -20,   0,   0,   0,   0, -20, -40 ],
      [-30,   0,  10,  15,  15,  10,   0, -30 ],
      [-30,   5,  15,  20,  20,  15,   5, -30 ],
      [-30,   0,  15,  20,  20,  15,   0, -30 ],
      [-30,   5,  10,  15,  15,  10,   5, -30 ],
      [-40, -20,   0,   5,   5,   0, -20, -40 ],
      [-50, -40, -30, -30, -30, -30, -40, -50 ],
    ],
    bishop: [
      [-20, -10, -10, -10, -10, -10, -10, -20 ],
      [-10,   0,   0,   0,   0,   0,   0, -10 ],
      [-10,   0,   5,  10,  10,   5,   0, -10 ],
      [-10,   5,   5,  10,  10,   5,   5, -10 ],
      [-10,   0,  10,  10,  10,  10,   0, -10 ],
      [-10,  10,  10,  10,  10,  10,  10, -10 ],
      [-10,   5,   0,   0,   0,   0,   5, -10 ],
      [-20, -10, -10, -10, -10, -10, -10, -20 ],
    ],
    rook: [
      [  0,   0,   0,   0,   0,   0,   0,   0 ],
      [  5,  10,  10,  10,  10,  10,  10,   5 ],
      [ -5,   0,   0,   0,   0,   0,   0,  -5 ],
      [ -5,   0,   0,   0,   0,   0,   0,  -5 ],
      [ -5,   0,   0,   0,   0,   0,   0,  -5 ],
      [ -5,   0,   0,   0,   0,   0,   0,  -5 ],
      [ -5,   0,   0,   0,   0,   0,   0,  -5 ],
      [  0,   0,   0,   5,   5,   0,   0,   0 ],
    ],
    queen: [
      [-20, -10, -10,  -5,  -5, -10, -10, -20 ],
      [-10,   0,   0,   0,   0,   0,   0, -10 ],
      [-10,   0,   5,   5,   5,   5,   0, -10 ],
      [ -5,   0,   5,   5,   5,   5,   0,  -5 ],
      [  0,   0,   5,   5,   5,   5,   0,  -5 ],
      [-10,   5,   5,   5,   5,   5,   0, -10 ],
      [-10,   0,   5,   0,   0,   0,   0, -10 ],
      [-20, -10, -10,  -5,  -5, -10, -10, -20 ],
    ],
    // King middlegame: hide behind pawns, avoid center
    king: [
      [-30, -40, -40, -50, -50, -40, -40, -30 ],
      [-30, -40, -40, -50, -50, -40, -40, -30 ],
      [-30, -40, -40, -50, -50, -40, -40, -30 ],
      [-30, -40, -40, -50, -50, -40, -40, -30 ],
      [-20, -30, -30, -40, -40, -30, -30, -20 ],
      [-10, -20, -20, -20, -20, -20, -20, -10 ],
      [ 20,  20,   0,   0,   0,   0,  20,  20 ],
      [ 20,  30,  10,   0,   0,  10,  30,  20 ],
    ],
  };

  /* ── Evaluation ───────────────────────────────────────────── */

  function pstBonus(type, color, row, col) {
    const table = PST[type];
    if (!table) return 0;
    // White: table is already oriented (row 7 = rank 1)
    // Black: mirror row so black's home rank maps to the same table row
    const r = color === 'white' ? row : 7 - row;
    return table[r][col];
  }

  /**
   * Static evaluation from white's perspective.
   * Positive  = white advantage.
   * Negative  = black advantage.
   */
  function evaluate(board) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const value = (MATERIAL[p.type] || 0) + pstBonus(p.type, p.color, r, c);
        score += p.color === 'white' ? value : -value;
      }
    }
    return score;
  }

  /* ── Move ordering ────────────────────────────────────────── */

  // Sort: captures first ordered by victim material value (most valuable victim first),
  // then quiet moves.  Good ordering drastically improves alpha-beta cutoffs.
  function orderMoves(board, moves) {
    return moves.sort((a, b) => {
      const va = board[a.to.row]?.[a.to.col] ? (MATERIAL[board[a.to.row][a.to.col].type] || 0) : 0;
      const vb = board[b.to.row]?.[b.to.col] ? (MATERIAL[board[b.to.row][b.to.col].type] || 0) : 0;
      return vb - va;
    });
  }

  /* ── Minimax with alpha-beta pruning ──────────────────────── */

  /**
   * @param  {Array}   board       — 8×8 board array
   * @param  {Object}  state       — { castling, enPassant }
   * @param  {number}  depth       — remaining search depth (half-moves)
   * @param  {number}  alpha       — best score white can guarantee (lower bound)
   * @param  {number}  beta        — best score black can guarantee (upper bound)
   * @param  {boolean} maximizing  — true = white's turn (wants high score)
   * @returns {{ score: number, move: Object|null }}
   */
  function minimax(board, state, depth, alpha, beta, maximizing) {
    const color = maximizing ? 'white' : 'black';

    // Base case: leaf node — return static evaluation
    if (depth === 0) {
      return { score: evaluate(board), move: null };
    }

    const moves = Rules.getAllLegalMoves(board, color, state);

    // Terminal node: checkmate or stalemate
    if (moves.length === 0) {
      if (Rules.isInCheck(board, color)) {
        // Checkmate — add depth bonus so faster mates score higher
        return { score: maximizing ? -100000 + depth : 100000 - depth, move: null };
      }
      return { score: 0, move: null }; // stalemate = draw
    }

    orderMoves(board, moves);

    let bestMove  = moves[0];
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      // Promotions always promote to queen for search purposes
      const testMove   = move.isPromotion ? { ...move, promoteTo: 'queen' } : move;
      const piece      = board[move.from.row][move.from.col];
      const newBoard   = Rules.applyMove(board, testMove);
      const newCastle  = Rules.updateCastling(state.castling, piece, move);
      const newEP      = Rules.getEnPassantTarget(piece, move);
      const newState   = { castling: newCastle, enPassant: newEP };

      const { score } = minimax(newBoard, newState, depth - 1, alpha, beta, !maximizing);

      if (maximizing) {
        if (score > bestScore) { bestScore = score; bestMove = move; }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (score < bestScore) { bestScore = score; bestMove = move; }
        beta = Math.min(beta, bestScore);
      }

      if (beta <= alpha) break; // prune — this branch can't improve the result
    }

    return { score: bestScore, move: bestMove };
  }

  /* ── Public API ───────────────────────────────────────────── */

  /**
   * Returns the best move for 'color' at the given difficulty.
   * @param  {Array}  board
   * @param  {Object} state      — { castling, enPassant }
   * @param  {string} color      — 'white' | 'black'
   * @param  {string} difficulty — 'easy' | 'medium' | 'hard'
   * @returns {Object|null} move object, or null if no moves available
   */
  function getBestMove(board, state, color, difficulty) {
    const depth      = DEPTH[difficulty] ?? DEPTH.medium;
    const maximizing = color === 'white';

    const { move } = minimax(board, state, depth, -Infinity, Infinity, maximizing);
    return move ?? null;
  }

  return { getBestMove };

})();
