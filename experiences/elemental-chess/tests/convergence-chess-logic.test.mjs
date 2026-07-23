import assert from "node:assert/strict";
import test from "node:test";

import { Chess } from "chess.js";

test("initial position exposes the standard 20 legal moves", () => {
  assert.equal(new Chess().moves().length, 20);
});

test("en passant removes the passed pawn", () => {
  const game = new Chess();
  for (const move of ["e4", "a6", "e5", "d5", "exd6"]) game.move(move);

  assert.equal(game.get("d5"), undefined);
  assert.deepEqual(game.get("d6"), { type: "p", color: "w" });
});

test("king-side castling moves both king and rook", () => {
  const game = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  game.move({ from: "e1", to: "g1" });

  assert.deepEqual(game.get("g1"), { type: "k", color: "w" });
  assert.deepEqual(game.get("f1"), { type: "r", color: "w" });
});

test("promotion creates the requested piece", () => {
  const game = new Chess("8/P7/8/8/8/8/7p/4K2k w - - 0 1");
  game.move({ from: "a7", to: "a8", promotion: "q" });

  assert.deepEqual(game.get("a8"), { type: "q", color: "w" });
});

test("checkmate is recognized", () => {
  const game = new Chess();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) game.move(move);

  assert.equal(game.isCheckmate(), true);
  assert.equal(game.isGameOver(), true);
});
