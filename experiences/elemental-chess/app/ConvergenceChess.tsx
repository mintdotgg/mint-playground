"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Chess,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";
import ConvergenceChessStage from "./ConvergenceChessStage";
import {
  CONVERGENCE_AUDIO,
  CONVERGENCE_FACTIONS,
  type FactionId,
  type WorldTransform,
} from "./convergenceChessMintAssets";

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20_000,
};

const ROLE_NAME: Record<PieceSymbol, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const LEGACY_WORLD_IDS: Record<FactionId, string> = {
  water: "northern-moon-citadel",
  earth: "jade-ring-court",
  fire: "ember-crown-caldera",
  air: "grand-air-temple-chess-court",
};

const FACTION_IDS = Object.keys(CONVERGENCE_FACTIONS) as FactionId[];

const worldStorageKey = (faction: FactionId) =>
  `convergence-world-${faction}-${CONVERGENCE_FACTIONS[faction].world.id}`;

const loadTransform = (faction: FactionId): WorldTransform => {
  const fallback = CONVERGENCE_FACTIONS[faction].world.transform;
  if (typeof window === "undefined") return fallback;

  try {
    const currentWorldId = CONVERGENCE_FACTIONS[faction].world.id;
    const saved =
      window.localStorage.getItem(worldStorageKey(faction)) ??
      (currentWorldId === LEGACY_WORLD_IDS[faction]
        ? window.localStorage.getItem(`convergence-world-${faction}`)
        : null);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<WorldTransform>;
    const values = [parsed.x, parsed.y, parsed.z, parsed.yaw, parsed.scale];
    if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return fallback;
    }
    return parsed as WorldTransform;
  } catch {
    return fallback;
  }
};

function PlacementControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="cc-placement-control">
      <span>
        {label} <output>{value.toFixed(step < 0.1 ? 2 : 1)}</output>
      </span>
      <input
        max={max}
        min={min}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

const chooseBotMove = (game: Chess): Move | null => {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  const center = new Set(["d4", "e4", "d5", "e5"]);
  let best = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = move.captured ? PIECE_VALUE[move.captured] * 10 - PIECE_VALUE[move.piece] : 0;
    if (move.promotion) score += PIECE_VALUE[move.promotion] + 700;
    if (center.has(move.to)) score += 32;
    const probe = new Chess(game.fen());
    probe.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (probe.isCheckmate()) score += 100_000;
    else if (probe.isCheck()) score += 180;
    score += (move.to.charCodeAt(0) * 17 + Number(move.to[1]) * 29) % 13;
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
};

function NationButton({
  faction,
  index,
  ring,
  selected,
  disabled,
  onClick,
}: {
  faction: FactionId;
  index: number;
  ring: "home" | "rival";
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const item = CONVERGENCE_FACTIONS[faction];
  return (
    <button
      aria-pressed={selected}
      className={`cc-nation-token cc-nation-token--${ring} ${selected ? "is-selected" : ""}`}
      data-faction={faction}
      disabled={disabled}
      onClick={onClick}
      style={{
        "--nation-accent": item.accent,
        "--nation-angle": `${index * 90}deg`,
        "--nation-counter-angle": `${index * -90}deg`,
      } as React.CSSProperties}
      type="button"
    >
      <span className="cc-token-glyph" aria-hidden="true">{item.glyph}</span>
      <strong>{item.shortName}</strong>
      <small>{ring === "home" ? item.motto : "Rival nation"}</small>
    </button>
  );
}

export default function ConvergenceChess() {
  const gameRef = useRef(new Chess());
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerRootRef = useRef<HTMLDivElement>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<Record<string, HTMLAudioElement>>({});
  const [home, setHome] = useState<FactionId>("water");
  const [opponent, setOpponent] = useState<FactionId>("fire");
  const [started, setStarted] = useState(false);
  const [fen, setFen] = useState(() => new Chess().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [history, setHistory] = useState<Move[]>([]);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [worldEnabled, setWorldEnabled] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [worldTransform, setWorldTransform] = useState<WorldTransform>(
    () => loadTransform("water"),
  );
  const [worldStatus, setWorldStatus] = useState("Opening Mint world");
  const [copyLabel, setCopyLabel] = useState("Copy values");

  const gameSnapshot = useMemo(() => new Chess(fen), [fen]);
  const turn = gameSnapshot.turn();
  const gameOver = gameSnapshot.isGameOver();
  const legalMoves = useMemo(
    () =>
      selected
        ? gameSnapshot.moves({ square: selected, verbose: true }).map((move) => move.to)
        : [],
    [gameSnapshot, selected],
  );

  const status = useMemo(() => {
    if (gameSnapshot.isCheckmate()) {
      const winner = turn === "w" ? CONVERGENCE_FACTIONS[opponent] : CONVERGENCE_FACTIONS[home];
      return `${winner.shortName} wins by checkmate`;
    }
    if (gameSnapshot.isDraw()) return "Balance holds — draw";
    if (gameSnapshot.isCheck()) return `${turn === "w" ? CONVERGENCE_FACTIONS[home].shortName : CONVERGENCE_FACTIONS[opponent].shortName} is in check`;
    if (botThinking) return `${CONVERGENCE_FACTIONS[opponent].shortName} is considering the board…`;
    return `${turn === "w" ? CONVERGENCE_FACTIONS[home].shortName : CONVERGENCE_FACTIONS[opponent].shortName} to move`;
  }, [botThinking, gameSnapshot, home, opponent, turn]);

  useEffect(() => {
    ambienceRef.current = new Audio(CONVERGENCE_AUDIO.ambience);
    ambienceRef.current.loop = true;
    ambienceRef.current.volume = 0.24;
    sfxRef.current = {
      move: new Audio(CONVERGENCE_AUDIO.move),
      capture: new Audio(CONVERGENCE_AUDIO.capture),
      check: new Audio(CONVERGENCE_AUDIO.check),
      victory: new Audio(CONVERGENCE_AUDIO.victory),
    };
    Object.values(sfxRef.current).forEach((audio) => {
      audio.volume = 0.58;
    });
    return () => {
      ambienceRef.current?.pause();
      Object.values(sfxRef.current).forEach((audio) => audio.pause());
    };
  }, []);

  useEffect(() => {
    if (!ambienceRef.current) return;
    if (soundOn && started) void ambienceRef.current.play().catch(() => undefined);
    else ambienceRef.current.pause();
  }, [soundOn, started]);

  useEffect(
    () => () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    },
    [],
  );

  const playSfx = useCallback(
    (key: "move" | "capture" | "check" | "victory") => {
      if (!soundOn) return;
      const audio = sfxRef.current[key];
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    },
    [soundOn],
  );

  const applyMove = useCallback(
    (input: { from: Square; to: Square; promotion?: string } | Move) => {
      const move = gameRef.current.move(input);
      setFen(gameRef.current.fen());
      setLastMove(move);
      setHistory(gameRef.current.history({ verbose: true }));
      setSelected(null);
      setPromotion(null);
      setBotThinking(gameRef.current.turn() === "b" && !gameRef.current.isGameOver());
      if (gameRef.current.isCheckmate()) playSfx("victory");
      else if (gameRef.current.isCheck()) playSfx("check");
      else playSfx(move.captured ? "capture" : "move");
      return move;
    },
    [playSfx],
  );

  useEffect(() => {
    if (!started || turn !== "b" || gameOver) return;
    botTimerRef.current = setTimeout(() => {
      const move = chooseBotMove(gameRef.current);
      if (move) applyMove(move);
      setBotThinking(false);
    }, 620);
    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [applyMove, gameOver, started, turn]);

  const onSquare = (square: Square) => {
      const liveGame = gameRef.current;
      if (!started || promotion || liveGame.isGameOver() || liveGame.turn() === "b") return;
      const piece = liveGame.get(square);
      const liveTurn = liveGame.turn();
      if (!selected) {
        if (piece?.color === liveTurn) setSelected(square);
        return;
      }
      if (piece?.color === liveTurn) {
        setSelected(square);
        return;
      }
      const move = liveGame
        .moves({ square: selected, verbose: true })
        .find((candidate) => candidate.to === square);
      if (!move) {
        setSelected(null);
        return;
      }
      if (move.flags.includes("p")) setPromotion({ from: selected, to: square });
      else applyMove({ from: selected, to: square });
    };

  const startGame = () => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setHistory([]);
    setLastMove(null);
    setSelected(null);
    setStarted(true);
    setBotThinking(false);
    setWorldTransform(loadTransform(home));
    setWorldEnabled(true);
    if (soundOn) void ambienceRef.current?.play().catch(() => undefined);
  };

  const updateWorldTransform = (key: keyof WorldTransform, value: number) => {
    setWorldTransform((current) => ({ ...current, [key]: value }));
  };

  const saveWorldTransform = () => {
    window.localStorage.setItem(
      worldStorageKey(home),
      JSON.stringify(worldTransform),
    );
    setWorldStatus(`${CONVERGENCE_FACTIONS[home].shortName} placement saved`);
  };

  const resetWorldTransform = () => {
    setWorldTransform({ ...CONVERGENCE_FACTIONS[home].world.transform });
    setWorldStatus("Default placement previewed — save only if you want to replace yours");
  };

  const copyWorldTransform = async () => {
    const value = JSON.stringify(worldTransform);
    try {
      await navigator.clipboard.writeText(value);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel(value);
    }
    window.setTimeout(() => setCopyLabel("Copy values"), 1600);
  };

  const resetGame = () => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setHistory([]);
    setLastMove(null);
    setSelected(null);
    setPromotion(null);
    setBotThinking(false);
  };

  const undo = () => {
    if (botThinking || !history.length) return;
    gameRef.current.undo();
    if (gameRef.current.turn() === "b") gameRef.current.undo();
    const nextHistory = gameRef.current.history({ verbose: true });
    setFen(gameRef.current.fen());
    setHistory(nextHistory);
    setLastMove(nextHistory.at(-1) ?? null);
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") setFlipped((value) => !value);
      if (event.key.toLowerCase() === "e") setEditorOpen((value) => !value);
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main
      className="cc-app"
      data-faction={home}
      style={{ "--cc-accent": CONVERGENCE_FACTIONS[home].accent } as React.CSSProperties}
    >
      {!started ? (
        <section className="cc-lobby" aria-labelledby="cc-title">
          <div className="cc-world-carousel" aria-hidden="true">
            {FACTION_IDS.map((faction, index) => (
              <div
                className={`cc-world-carousel__scene cc-world-carousel__scene--${faction}`}
                key={faction}
                style={{
                  "--world-delay": `${index * 7 - 1.5}s`,
                  backgroundImage: `url(${CONVERGENCE_FACTIONS[faction].world.lobbyPreview})`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="cc-intro-curtain" aria-hidden="true">
            <div className="cc-intro-glyphs">
              {FACTION_IDS.map((faction) => (
                <span
                  key={faction}
                  style={{ "--intro-nation": CONVERGENCE_FACTIONS[faction].accent } as React.CSSProperties}
                >
                  {CONVERGENCE_FACTIONS[faction].glyph}
                </span>
              ))}
            </div>
            <p>Four nations</p>
            <strong>Elemental Chess</strong>
            <small>Master the board · Shape the world</small>
          </div>

          <div className="cc-lobby-copy">
            <p className="cc-kicker">A Four Nations strategy game · Crafted with Mint</p>
            <h1 id="cc-title">
              <span>Elemental</span>
              <span className="cc-title-chess">Chess</span>
            </h1>
            <div className="cc-title-mark" aria-label="Four nations, one board">
              <div className="cc-title-glyphs" aria-hidden="true">
                {FACTION_IDS.map((faction) => (
                  <span
                    key={faction}
                    style={{ "--title-nation": CONVERGENCE_FACTIONS[faction].accent } as React.CSSProperties}
                  >
                    {CONVERGENCE_FACTIONS[faction].glyph}
                  </span>
                ))}
              </div>
              <strong>Four nations</strong>
              <i />
              <small>One board</small>
            </div>
            <p>
              Choose the nation that shapes the battlefield. Then turn inward
              and call forth the rival who will meet you across the board.
            </p>
            <div className="cc-lobby-legend" aria-hidden="true">
              <span><i /> Outer circle · shape your realm</span>
              <span><i /> Inner circle · call your rival</span>
            </div>
          </div>

          <div className="cc-selector-wheel" aria-label="Choose your nation and rival">
            <div className="cc-wheel-aura" aria-hidden="true" />
            <div className="cc-orbit cc-orbit--home" aria-label="Choose your nation">
              {FACTION_IDS.map((faction, index) => (
                <NationButton
                  faction={faction}
                  index={index}
                  key={faction}
                  ring="home"
                  onClick={() => {
                    setHome(faction);
                    setWorldTransform(loadTransform(faction));
                    if (opponent === faction) {
                      setOpponent(
                        FACTION_IDS.find((candidate) => candidate !== faction) ?? "fire",
                      );
                    }
                  }}
                  selected={home === faction}
                />
              ))}
            </div>

            <div className="cc-orbit cc-orbit--rival" aria-label="Choose your rival">
              {FACTION_IDS.map((faction, index) => (
                <NationButton
                  disabled={faction === home}
                  faction={faction}
                  index={index}
                  key={faction}
                  ring="rival"
                  onClick={() => setOpponent(faction)}
                  selected={opponent === faction}
                />
              ))}
            </div>

            <div className="cc-match-seal">
              <p>Solo elemental duel</p>
              <div className="cc-seal-matchup" aria-live="polite">
                <span style={{ "--seal-accent": CONVERGENCE_FACTIONS[home].accent } as React.CSSProperties}>
                  {CONVERGENCE_FACTIONS[home].glyph}
                </span>
                <i>vs</i>
                <span style={{ "--seal-accent": CONVERGENCE_FACTIONS[opponent].accent } as React.CSSProperties}>
                  {CONVERGENCE_FACTIONS[opponent].glyph}
                </span>
              </div>
              <strong>{CONVERGENCE_FACTIONS[home].shortName}</strong>
              <small>faces {CONVERGENCE_FACTIONS[opponent].shortName}</small>
              <button className="cc-enter-button" onClick={startGame} type="button">
                Enter the board
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <ConvergenceChessStage
            fen={fen}
            flipped={flipped}
            home={home}
            lastMove={lastMove}
            legalSquares={legalMoves}
            markerRootRef={markerRootRef as RefObject<HTMLDivElement>}
            onSquare={onSquare}
            opponent={opponent}
            selected={selected}
            worldEnabled={worldEnabled}
            worldTransform={worldTransform}
            onWorldStatus={setWorldStatus}
          />

          <header className="cc-game-header">
            <div className="cc-game-brand">
              <strong>Elemental Chess</strong>
              <small>Brought to you by Mint</small>
            </div>
            <div className="cc-header-actions">
              <button onClick={() => setSoundOn((value) => !value)} type="button">
                {soundOn ? "Sound on" : "Sound off"}
              </button>
              <button onClick={() => setFlipped((value) => !value)} type="button">
                Flip board
              </button>
              <button onClick={() => setEditorOpen((value) => !value)} type="button">
                Place world
              </button>
            </div>
          </header>

          <aside className="cc-status-card" aria-live="polite">
            <p className="cc-kicker">Solo elemental duel</p>
            <h2>{status}</h2>
            <div className="cc-matchup">
              <span style={{ borderColor: CONVERGENCE_FACTIONS[home].accent }}>
                {CONVERGENCE_FACTIONS[home].glyph} {CONVERGENCE_FACTIONS[home].shortName}
              </span>
              <i>versus</i>
              <span style={{ borderColor: CONVERGENCE_FACTIONS[opponent].accent }}>
                {CONVERGENCE_FACTIONS[opponent].glyph} {CONVERGENCE_FACTIONS[opponent].shortName}
              </span>
            </div>
            <div className="cc-status-actions">
              <button disabled={!history.length || botThinking} onClick={undo} type="button">
                Undo
              </button>
              <button onClick={resetGame} type="button">Restart</button>
              <button onClick={() => setStarted(false)} type="button">New nations</button>
            </div>
            <p className="cc-help">Drag to orbit · Scroll to zoom · Click a piece, then a lit square · E places the world</p>
          </aside>

          {editorOpen ? (
            <aside className="cc-placement-panel" aria-label="World placement controls">
              <div className="cc-placement-heading">
                <div>
                  <p className="cc-kicker">Saved separately for {CONVERGENCE_FACTIONS[home].world.label}</p>
                  <h2>Place the splat</h2>
                </div>
                <button aria-label="Close world placement" onClick={() => setEditorOpen(false)} type="button">×</button>
              </div>
              <p className="cc-world-status">{worldStatus}</p>
              <label className="cc-world-toggle">
                <input
                  checked={worldEnabled}
                  onChange={(event) => setWorldEnabled(event.currentTarget.checked)}
                  type="checkbox"
                />
                Render this world while placing it
              </label>
              <PlacementControl label="X" max={100} min={-100} onChange={(value) => updateWorldTransform("x", value)} step={0.05} value={worldTransform.x} />
              <PlacementControl label="Y" max={50} min={-50} onChange={(value) => updateWorldTransform("y", value)} step={0.05} value={worldTransform.y} />
              <PlacementControl label="Z" max={100} min={-100} onChange={(value) => updateWorldTransform("z", value)} step={0.05} value={worldTransform.z} />
              <PlacementControl label="Yaw" max={180} min={-180} onChange={(value) => updateWorldTransform("yaw", value)} step={1} value={worldTransform.yaw} />
              <PlacementControl label="Scale" max={20} min={0.01} onChange={(value) => updateWorldTransform("scale", value)} step={0.01} value={worldTransform.scale} />
              <div className="cc-placement-actions">
                <button onClick={resetWorldTransform} type="button">Reset</button>
                <button onClick={saveWorldTransform} type="button">Save</button>
                <button onClick={copyWorldTransform} type="button">{copyLabel}</button>
              </div>
              <pre>{JSON.stringify(worldTransform)}</pre>
            </aside>
          ) : null}

          <div className="cc-markers" ref={markerRootRef}>
            {legalMoves.map((square) => (
              <span className="cc-move-marker" data-square={square} key={square} />
            ))}
            {selected ? <span className="cc-select-marker" data-square={selected} /> : null}
            {lastMove ? (
              <>
                <span className="cc-last-marker" data-square={lastMove.from} />
                <span className="cc-last-marker" data-square={lastMove.to} />
              </>
            ) : null}
          </div>

          {promotion ? (
            <div className="cc-promotion-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion">
              <div className="cc-promotion-card">
                <p className="cc-kicker">The pawn crosses the world</p>
                <h2>Choose a new role</h2>
                <div>
                  {(["q", "r", "b", "n"] as PieceSymbol[]).map((piece) => (
                    <button
                      key={piece}
                      onClick={() => applyMove({ ...promotion, promotion: piece })}
                      type="button"
                    >
                      {ROLE_NAME[piece]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
