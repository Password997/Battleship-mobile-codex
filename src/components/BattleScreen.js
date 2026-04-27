import React, { useEffect, useMemo, useState } from "react";

const FLEET_SPRITE_URL = "/assets/fleet3.png";
const FLEET_SPRITE_SOURCE_WIDTH = 1024;
const FLEET_SPRITE_SOURCE_HEIGHT = 1536;
const FLEET_ART_SPECS = [
  { length: 5, x: 40, y: 35, width: 900, height: 255 },
  { length: 4, x: 120, y: 405, width: 700, height: 180 },
  { length: 3, x: 48, y: 665, width: 515, height: 145 },
  { length: 3, x: 48, y: 665, width: 515, height: 145 },
  { length: 2, x: 666, y: 668, width: 292, height: 116 },
];
const EMOGY_SPRITE_URL = "/assets/emogy.png";
const EMOGY_SPRITE_SOURCE_WIDTH = 1402;
const EMOGY_SPRITE_SOURCE_HEIGHT = 1122;
const EFFECT_ART_SPECS = {
  hit: { x: 1088, y: 24, width: 256, height: 250 },
  miss: { x: 1066, y: 358, width: 272, height: 206 },
  sunk: { x: 1080, y: 642, width: 250, height: 210 },
};

const PLAYER_COLORS = [
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  { bg: "#ffe4e6", border: "#e11d48", text: "#9f1239" },
  { bg: "#ccfbf1", border: "#0d9488", text: "#115e59" },
  { bg: "#f3e8ff", border: "#9333ea", text: "#6b21a8" },
  { bg: "#e0f2fe", border: "#0284c7", text: "#075985" },
  { bg: "#f1f5f9", border: "#64748b", text: "#334155" },
  { bg: "#dcfce7", border: "#65a30d", text: "#3f6212" },
  { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
];

function playerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function keyOf(x, y) {
  return `${x},${y}`;
}
function columnLabel(index) {
  return String.fromCharCode(65 + index);
}

function splitPlayerName(name = "") {
  const match = String(name).trim().match(/^(P\d+)\s*(.*)$/);
  if (!match) {
    return { number: "P?", label: String(name || "Crew").trim() || "Crew" };
  }

  return {
    number: match[1],
    label: match[2]?.trim() || match[1],
  };
}

function buildShotMap(shotHistory) {
  const map = new Map();
  for (const shot of shotHistory || []) {
    map.set(keyOf(shot.x, shot.y), shot);
  }
  return map;
}

function buildTakenShotMap(shotsTaken) {
  const map = new Map();
  for (const shot of shotsTaken || []) {
    map.set(keyOf(shot.x, shot.y), shot);
  }
  return map;
}

function buildShipCellSet(ships) {
  const set = new Set();
  for (const ship of ships || []) {
    for (const cell of ship) {
      set.add(keyOf(cell.x, cell.y));
    }
  }
  return set;
}

function buildSunkCellSet(ships, sunkShipIndexes) {
  const set = new Set();
  const indexes = new Set(sunkShipIndexes || []);
  (ships || []).forEach((ship, index) => {
    if (!indexes.has(index)) return;
    ship.forEach((cell) => set.add(keyOf(cell.x, cell.y)));
  });
  return set;
}

function getShipBounds(ship, cellSize, gap) {
  const xs = ship.map((cell) => cell.x);
  const ys = ship.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const horizontal = maxX > minX;
  const left = 18 + gap + minX * (cellSize + gap);
  const top = 18 + gap + minY * (cellSize + gap);
  const width = (maxX - minX + 1) * cellSize + (maxX - minX) * gap;
  const height = (maxY - minY + 1) * cellSize + (maxY - minY) * gap;

  return { left, top, width, height, horizontal };
}

function FleetSprite({ spec, width, height, rotate = false, dimmed = false, sunk = false }) {
  if (!spec) return null;

  const scale = Math.min(width / spec.width, height / spec.height);

  return (
    <div
      aria-hidden="true"
      style={{
        width: spec.width * scale,
        height: spec.height * scale,
        backgroundImage: `url(${FLEET_SPRITE_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FLEET_SPRITE_SOURCE_WIDTH * scale}px ${FLEET_SPRITE_SOURCE_HEIGHT * scale}px`,
        backgroundPosition: `${-spec.x * scale}px ${-spec.y * scale}px`,
        transform: rotate ? "rotate(90deg)" : "none",
        transformOrigin: "center center",
        filter: [
          dimmed ? "saturate(0.46) brightness(0.64)" : "drop-shadow(0 8px 18px rgba(0,0,0,0.28))",
          sunk ? "sepia(0.36) saturate(1.08) brightness(0.82) drop-shadow(0 0 10px rgba(249,115,22,0.34))" : "",
        ]
          .filter(Boolean)
          .join(" "),
        opacity: dimmed ? 0.54 : 1,
        pointerEvents: "none",
      }}
    />
  );
}

function EffectSprite({ kind, cellSize, scale = 1, dimmed = false }) {
  const spec = EFFECT_ART_SPECS[kind];
  if (!spec) return null;

  const frameSize = Math.max(cellSize * scale, 18);
  const drawScale = Math.min(frameSize / spec.width, frameSize / spec.height);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: spec.width * drawScale,
        height: spec.height * drawScale,
        backgroundImage: `url(${EMOGY_SPRITE_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${EMOGY_SPRITE_SOURCE_WIDTH * drawScale}px ${EMOGY_SPRITE_SOURCE_HEIGHT * drawScale}px`,
        backgroundPosition: `${-spec.x * drawScale}px ${-spec.y * drawScale}px`,
        transform: "translate(-50%, -50%)",
        filter: dimmed ? "brightness(0.86)" : "none",
        pointerEvents: "none",
      }}
    />
  );
}

function ShipSilhouettes({
  ships,
  sunkShipIndexes = [],
  cellSize,
  gap,
  allSunk = false,
  flashingSunkShipIndexes = new Set(),
}) {
  const sunk = new Set(sunkShipIndexes || []);

  return (
    <>
      {(ships || []).map((ship, index) => {
        const cells = Array.isArray(ship) ? ship : ship?.cells || [];
        if (!cells.length) return null;

        const bounds = getShipBounds(cells, cellSize, gap);
        const isSunk = allSunk || sunk.has(index);
        const isFlashingSunk = flashingSunkShipIndexes.has(index);
        const spec = FLEET_ART_SPECS[index] || FLEET_ART_SPECS.find((item) => item.length === cells.length);
        const artHeight = bounds.horizontal
          ? Math.max(cellSize * 1.3, bounds.height + 10)
          : Math.max(cellSize * 1.08, bounds.width + 10);
        const artWidth = bounds.horizontal
          ? Math.max(bounds.width + cellSize * 0.34, cellSize * 1.5)
          : Math.max(bounds.height + cellSize * 0.34, cellSize * 1.5);

        return (
          <div
            key={`ship-shape-${index}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: bounds.left + (bounds.width - artWidth) / 2,
              top: bounds.top + (bounds.height - artHeight) / 2,
              width: artWidth,
              height: artHeight,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <FleetSprite
              spec={spec}
              width={artWidth}
              height={artHeight}
              rotate={!bounds.horizontal}
              dimmed={isSunk}
              sunk={isSunk}
            />
            {isFlashingSunk && (
              <EffectSprite
                kind="sunk"
                cellSize={Math.max(artHeight, artWidth)}
                scale={0.68}
                dimmed
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function buildFlashingShipIndexes(ships, flashMap, flashType = "sunk") {
  const flashing = new Set();
  (ships || []).forEach((ship, index) => {
    const cells = Array.isArray(ship) ? ship : ship?.cells || [];
    if (
      cells.some((cell) => flashMap?.[keyOf(cell.x, cell.y)] === flashType)
    ) {
      flashing.add(index);
    }
  });
  return flashing;
}

function buildRevealedSunkEnemyCells(revealedSunkShipCells) {
  const set = new Set();
  for (const ship of revealedSunkShipCells || []) {
    for (const cell of ship.cells || []) {
      set.add(keyOf(cell.x, cell.y));
    }
  }
  return set;
}

function Toast({ item }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(8,31,51,0.96), rgba(4,18,31,0.96))",
        color: "#f3fbff",
        borderRadius: 16,
        padding: "12px 16px",
        minWidth: 240,
        border: "1px solid rgba(99,225,255,0.22)",
        boxShadow: "0 14px 34px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(99,225,255,0.08)",
        fontWeight: 700,
      }}
    >
      {item.text}
    </div>
  );
}

export default function BattleScreen({
  roomView,
  onFire,
  onBack,
  notifications,
  clearNotification,
  flashCells,
  pendingShot,
}) {
  const boardSize = roomView?.boardSize || 10;
  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  const cellSize = isMobile ? 30 : 42;
  const attackGap = isMobile ? 2 : 4;
  const defenseGap = 2;

  const players = roomView?.players || [];
  const you = roomView?.you || {
    ships: [],
    hitsTakenKeys: [],
    missesTakenKeys: [],
    shotsTaken: [],
    sunkShipIndexes: [],
    shotHistory: [],
    revealedSunkShipCells: [],
    defeated: false,
  };

  const [winnerOpen, setWinnerOpen] = useState(true);
  const [eliminatedOpen, setEliminatedOpen] = useState(true);
  const [activeMobileBoard, setActiveMobileBoard] = useState("attack");

  useEffect(() => {
    if (roomView?.status === "finished" && roomView?.winnerName) {
      setWinnerOpen(true);
    }
  }, [roomView?.status, roomView?.winnerName]);

  useEffect(() => {
    if (you?.defeated) {
      setEliminatedOpen(true);
    }
  }, [you?.defeated]);

  useEffect(() => {
    if (isMobile && roomView?.status === "battle" && roomView?.isYourTurn) {
      setActiveMobileBoard("attack");
    }
  }, [isMobile, roomView?.isYourTurn, roomView?.status]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [roomView?.status]);

  useEffect(() => {
    if (!notifications?.length) return;
    const timers = notifications.map((n) =>
      setTimeout(() => clearNotification(n.id), n.durationMs ?? 3200)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [notifications, clearNotification]);

  const shotMap = useMemo(() => buildShotMap(you.shotHistory || []), [you.shotHistory]);
  const takenShotMap = useMemo(
    () => buildTakenShotMap(you.shotsTaken || []),
    [you.shotsTaken]
  );
  const myShipCells = useMemo(() => buildShipCellSet(you.ships || []), [you.ships]);
  const myHitCells = useMemo(() => new Set(you.hitsTakenKeys || []), [you.hitsTakenKeys]);
  const myMissCells = useMemo(
    () => new Set(you.missesTakenKeys || []),
    [you.missesTakenKeys]
  );
  const mySunkCells = useMemo(
    () => buildSunkCellSet(you.ships || [], you.sunkShipIndexes || []),
    [you.ships, you.sunkShipIndexes]
  );
  const revealedSunkEnemyCells = useMemo(
    () => buildRevealedSunkEnemyCells(you.revealedSunkShipCells || []),
    [you.revealedSunkShipCells]
  );
  const flashingEnemySunkShips = useMemo(
    () => buildFlashingShipIndexes(you.revealedSunkShipCells || [], flashCells?.attack || {}, "sunk"),
    [you.revealedSunkShipCells, flashCells?.attack]
  );
  const flashingDefenseSunkShips = useMemo(
    () => buildFlashingShipIndexes(you.ships || [], flashCells?.defense || {}, "sunk"),
    [you.ships, flashCells?.defense]
  );

  const aliveCount = players.filter((p) => !p.defeated).length;
  const defeatedCount = players.filter((p) => p.defeated).length;
  const finalRanking = useMemo(() => {
    return [...players].sort((a, b) => {
      const aWon = a.name === roomView?.winnerName ? 1 : 0;
      const bWon = b.name === roomView?.winnerName ? 1 : 0;
      if (aWon !== bWon) return bWon - aWon;

      const aShips = typeof a.shipsLeft === "number" ? a.shipsLeft : 0;
      const bShips = typeof b.shipsLeft === "number" ? b.shipsLeft : 0;
      if (aShips !== bShips) return bShips - aShips;

      return String(a.name).localeCompare(String(b.name));
    });
  }, [players, roomView?.winnerName]);
  const currentTurnIdentity = splitPlayerName(roomView?.currentTurnName || "");
  const currentTurnIndex = players.findIndex(
    (player) => player.id === roomView?.currentTurnPlayerId
  );
  const currentTurnColor = playerColor(Math.max(0, currentTurnIndex));

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 70%, rgba(67,197,255,0.16), transparent 18%), linear-gradient(180deg, #03101d 0%, #06192a 38%, #07243b 68%, #020b15 100%)",
        padding: isMobile ? 10 : 18,
        boxSizing: "border-box",
        color: "#e9f8ff",
        fontFamily: "'Segoe UI', 'Trebuchet MS', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: -280,
          width: 860,
          height: 860,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          boxShadow: "0 0 0 80px rgba(95,224,255,0.02), 0 0 0 180px rgba(95,224,255,0.012)",
          border: "1px solid rgba(95,224,255,0.08)",
          pointerEvents: "none",
        }}
      />
      {false && roomView?.status === "finished" && winnerOpen && roomView?.winnerName && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.64)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 28,
              width: "min(92vw, 420px)",
              textAlign: "center",
              boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
              animation: "winnerPulse 0.55s ease-out",
            }}
          >
            <div style={{ fontSize: 46 }}>🏆</div>
            <div
              style={{
                marginTop: 12,
                fontSize: 28,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {roomView.winnerName} wins!
            </div>

            <button
              onClick={() => {
                setWinnerOpen(false);
                onBack();
              }}
              style={{
                marginTop: 18,
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 18px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {roomView?.status === "finished" && winnerOpen && roomView?.winnerName && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.68)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, rgba(7,31,51,0.99), rgba(4,18,31,0.98))",
              borderRadius: 24,
              padding: isMobile ? 18 : 24,
              width: "min(94vw, 520px)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.34)",
              animation: "winnerPulse 0.55s ease-out",
              border: "1px solid rgba(95,224,255,0.18)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.28em", color: "#6fe2ff", textTransform: "uppercase" }}>
                Victory signal
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: isMobile ? 25 : 30,
                  fontWeight: 900,
                  color: "#f4fbff",
                }}
              >
                {roomView.winnerName} wins!
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#87b8cf",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                Final fleet report
              </div>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              {finalRanking.map((player, index) => {
                const identity = splitPlayerName(player.name);
                const accent = playerColor(index);
                const winner = player.name === roomView.winnerName;
                const shipsLeft =
                  typeof player.shipsLeft === "number" ? player.shipsLeft : 0;
                const totalShips = player.totalShips || 5;

                return (
                  <div
                    key={player.id}
                    style={{
                      border: winner ? `2px solid rgba(110,226,255,0.55)` : "1px solid rgba(95,224,255,0.14)",
                      borderRadius: 16,
                      padding: "12px 14px",
                      background: winner ? "linear-gradient(180deg, rgba(11,73,96,0.95), rgba(5,29,46,0.95))" : "rgba(5, 18, 31, 0.76)",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      boxShadow: winner ? "0 14px 28px rgba(0,0,0,0.24)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: winner ? "rgba(255,255,255,0.14)" : "rgba(95,224,255,0.08)",
                        color: "#eefbff",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      #{index + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, color: "#f4fbff", fontSize: 16 }}>
                        {identity.number} {identity.label}
                      </div>
                      <div style={{ marginTop: 3, color: "#84b6cb", fontWeight: 800, fontSize: 12 }}>
                        {winner ? "Winner" : player.defeated ? "Defeated" : "Survived"}
                      </div>
                    </div>
                    <div
                      style={{
                        color: shipsLeft > 0 ? "#86f0ba" : "#ffc0c0",
                        fontWeight: 900,
                        fontSize: 12,
                        textAlign: "right",
                      }}
                    >
                      {shipsLeft}/{totalShips}
                      <br />
                      ships
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 10,
              }}
            >
              <button
                onClick={() => setWinnerOpen(false)}
                style={{
                  background: "linear-gradient(180deg, rgba(15,94,125,1), rgba(6,35,57,1))",
                  color: "#eefbff",
                  border: "1px solid rgba(110,226,255,0.24)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                View Board
              </button>
              <button
                onClick={() => {
                  setWinnerOpen(false);
                  onBack();
                }}
                style={{
                  background: "rgba(7,31,51,0.96)",
                  color: "#eefbff",
                  border: "1px solid rgba(95,224,255,0.16)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                New Room
              </button>
            </div>
          </div>
        </div>
      )}

      {you?.defeated && roomView?.status === "battle" && eliminatedOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.64)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 41,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 28,
              width: "min(92vw, 420px)",
              textAlign: "center",
              boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
              animation: "winnerPulse 0.4s ease-out",
            }}
          >
            <div style={{ fontSize: 44 }}>💥</div>
            <div
              style={{
                marginTop: 12,
                fontSize: 26,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              You have been eliminated
            </div>

            <button
              onClick={() => {
                setEliminatedOpen(false);
              }}
              style={{
                marginTop: 18,
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 18px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Watch Battle
            </button>

            <button
              onClick={() => {
                setEliminatedOpen(false);
                onBack();
              }}
              style={{
                marginTop: 10,
                background: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 18px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Leave Game
            </button>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes winnerPulse {
            0% { transform: scale(0.92); opacity: 0.75; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes sinkGlow {
            0% { box-shadow: inset 0 0 0 3px #facc15, 0 0 0 0 rgba(250, 204, 21, 0.85); }
            70% { box-shadow: inset 0 0 0 3px #facc15, 0 0 0 10px rgba(250, 204, 21, 0); }
            100% { box-shadow: inset 0 0 0 3px #facc15, 0 0 0 0 rgba(250, 204, 21, 0); }
          }

          @keyframes hitFlash {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
          }

          @keyframes missFlash {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.96); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes turnPulse {
            0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.22); }
            70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
          }

          @keyframes shotPending {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.78; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes yourTurnGlow {
            0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.28); }
            70% { box-shadow: 0 0 0 9px rgba(37, 99, 235, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
          }

          @keyframes radarSweep {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes radarPulse {
            0% { opacity: 0.48; transform: scale(0.98); }
            50% { opacity: 0.78; transform: scale(1.03); }
            100% { opacity: 0.48; transform: scale(0.98); }
          }

        `}
      </style>

      <div
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 45,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,185,129,0.28)",
          background: "linear-gradient(180deg, rgba(255,135,61,0.94), rgba(142,61,17,0.94))",
          color: "#fff7f1",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          boxShadow: "0 14px 28px rgba(0,0,0,0.24)",
        }}
      >
        Local Preview
      </div>

      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 50,
          display: "grid",
          gap: 10,
        }}
      >
        {(notifications || []).map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </div>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: isMobile ? 12 : 18,
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            position: "relative",
          }}
        >
          <div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: "#111827" }}>
              Battle
            </div>
            <div
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 8,
                padding: "8px 12px",
                background:
                  roomView?.status === "finished"
                    ? "#dcfce7"
                    : roomView?.isYourTurn
                    ? "#2563eb"
                    : "#f3f4f6",
                color:
                  roomView?.status === "finished"
                    ? "#166534"
                    : roomView?.isYourTurn
                    ? "#ffffff"
                    : "#6b7280",
                fontSize: isMobile ? 14 : 16,
                fontWeight: 900,
                animation:
                  roomView?.status === "battle" && roomView?.isYourTurn
                    ? "yourTurnGlow 1.35s ease-out infinite"
                    : "none",
              }}
            >
              {roomView?.status === "finished" ? (
                `Winner: ${roomView?.winnerName || "-"}`
              ) : roomView?.isYourTurn ? (
                "FIRE YOUR TURN"
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span>Turn:</span>
                  <span
                    style={{
                      background: "#ffffff",
                      color: currentTurnColor.text,
                      border: `1px solid ${currentTurnColor.border}`,
                      borderRadius: 6,
                      padding: "3px 6px",
                      fontWeight: 900,
                    }}
                  >
                    {currentTurnIdentity.number}
                  </span>
                  <span>{currentTurnIdentity.label}</span>
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                background: "rgba(8,38,62,0.82)",
                color: "#86e8ff",
                border: "1px solid rgba(106,231,255,0.16)",
                fontWeight: 800,
                fontSize: isMobile ? 12 : 14,
              }}
            >
              Alive {aliveCount} / Defeated {defeatedCount}
            </div>
          </div>

          <button
            onClick={onBack}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "linear-gradient(180deg, rgba(8,37,60,0.94), rgba(4,17,29,0.94))",
              color: "#eefbff",
              border: "1px solid rgba(96,227,255,0.18)",
              borderRadius: 10,
              padding: isMobile ? "7px 10px" : "8px 12px",
              fontWeight: 800,
              fontSize: isMobile ? 12 : 13,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            Back
          </button>
        </div>

        <div
          style={{
            background: "linear-gradient(180deg, rgba(8,31,51,0.96), rgba(4,18,31,0.94))",
            borderRadius: 20,
            padding: 14,
            border: "1px solid rgba(95,224,255,0.16)",
            boxShadow: "0 16px 32px rgba(0,0,0,0.28)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
            gap: 10,
          }}
        >
          {players.map((player, index) => {
            const isActive =
              roomView?.status === "battle" &&
              roomView?.currentTurnPlayerId === player.id;
            const identity = splitPlayerName(player.name);
            const totalShips = player.totalShips || 5;
            const shipsLeft =
              typeof player.shipsLeft === "number" ? player.shipsLeft : totalShips;
            const accent = playerColor(index);

            return (
              <div
                key={player.id}
                style={{
                  border: isActive
                    ? `2px solid ${accent.border}`
                    : "1px solid rgba(118,209,240,0.16)",
                  borderRadius: 16,
                  padding: "12px 12px 10px",
                  background: isActive ? accent.bg : "rgba(5, 25, 41, 0.82)",
                  animation: isActive ? "turnPulse 1.2s ease-out infinite" : "none",
                  minWidth: 0,
                  boxShadow: `inset 4px 0 0 ${accent.border}, 0 12px 22px rgba(0,0,0,0.16)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: accent.text,
                        fontSize: 12,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      {identity.number}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontWeight: 900,
                        color: isActive ? "#111827" : "#edfaff",
                        fontSize: isMobile ? 13 : 16,
                        lineHeight: 1.1,
                      }}
                    >
                      {identity.label}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      style={{
                        borderRadius: 6,
                        background: accent.border,
                        color: "#ffffff",
                        padding: "4px 6px",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      TURN
                    </div>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: player.defeated ? "#ff8e8e" : "#7be7a0",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {player.defeated ? "OUT" : `${shipsLeft}/${totalShips} SHIPS ALIVE`}
                </div>
              </div>
            );
          })}
        </div>

        {isMobile && (
          <div
            style={{
              background: "linear-gradient(180deg, rgba(8,31,51,0.96), rgba(4,18,31,0.94))",
              borderRadius: 14,
              padding: 6,
              border: "1px solid rgba(95,224,255,0.16)",
              boxShadow: "0 16px 32px rgba(0,0,0,0.28)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              position: "sticky",
              top: 8,
              zIndex: 20,
            }}
          >
            {[
              ["attack", "Attack"],
              ["ships", "My Ships"],
            ].map(([value, label]) => {
              const active = activeMobileBoard === value;
              return (
                <button
                  key={value}
                  onClick={() => setActiveMobileBoard(value)}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 10px",
                    background: active
                      ? "linear-gradient(180deg, rgba(16,87,120,1), rgba(5,33,56,1))"
                      : "rgba(8,37,60,0.76)",
                    color: active ? "#f2fcff" : "#7ecce3",
                    fontWeight: 900,
                    fontSize: 14,
                    boxShadow: active ? "0 10px 22px rgba(44,178,255,0.18)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(420px, 1fr))",
            alignItems: "start",
          }}
        >
          <div
            style={{
              background:
                roomView?.status === "battle"
                  ? roomView?.isYourTurn
                    ? "linear-gradient(180deg, rgba(7,37,60,0.98), rgba(4,19,32,0.98))"
                    : "linear-gradient(180deg, rgba(6,24,40,0.96), rgba(4,17,29,0.96))"
                  : "linear-gradient(180deg, rgba(6,24,40,0.96), rgba(4,17,29,0.96))",
              border:
                roomView?.status === "battle" && roomView?.isYourTurn
                  ? "2px solid rgba(90,230,255,0.45)"
                  : "1px solid rgba(90,230,255,0.16)",
              borderRadius: 18,
              padding: isMobile ? 12 : 18,
              boxShadow:
                roomView?.status === "battle" && roomView?.isYourTurn
                  ? "0 0 0 1px rgba(90,230,255,0.22), 0 18px 36px rgba(0,0,0,0.32)"
                  : "0 16px 30px rgba(0,0,0,0.24)",
              opacity:
                roomView?.status === "battle" && !roomView?.isYourTurn
                  ? 0.82
                  : 1,
              display: isMobile && activeMobileBoard !== "attack" ? "none" : "block",
            }}
          >
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: "#f3fbff" }}>
              Enemy Board
            </div>
            <div style={{ marginTop: 8, color: "#86b4ca", fontSize: isMobile ? 12 : 14 }}>
              Cyan scans mark active targeting. Ember glow confirms heavy damage.
            </div>

            <div
              style={{
                marginTop: 14,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `18px repeat(${boardSize}, ${cellSize}px)`,
                    gap: attackGap,
                    width: "max-content",
                    margin: "0 auto",
                    position: "relative",
                  }}
              >
                {roomView?.status === "battle" && roomView?.isYourTurn && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 18,
                      top: 18,
                      right: 0,
                      bottom: 0,
                      borderRadius: 8,
                      overflow: "visible",
                      pointerEvents: "none",
                      zIndex: 0,
                      background:
                        "radial-gradient(circle at center, rgba(34,211,238,0.42) 0 2px, transparent 3px 17%, rgba(14,165,233,0.62) 17.5% 18.5%, transparent 19% 34%, rgba(14,165,233,0.54) 34.5% 35.5%, transparent 36% 52%, rgba(14,165,233,0.46) 52.5% 53.5%, transparent 54% 74%, rgba(14,165,233,0.88) 74.5% 76%, transparent 76.5%)",
                      animation: "radarPulse 2.1s ease-in-out infinite",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: "122%",
                        height: "122%",
                        borderRadius: "50%",
                        border: "4px solid rgba(14,165,233,0.86)",
                        boxShadow: "0 0 30px rgba(14,165,233,0.42), inset 0 0 30px rgba(34,211,238,0.18)",
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: "-22%",
                        background:
                          "conic-gradient(from 0deg, rgba(34,211,238,0.86), rgba(34,211,238,0.32) 18%, transparent 27%, transparent 100%)",
                        animation: "radarSweep 3.2s linear infinite",
                        transformOrigin: "50% 50%",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "rgba(14,165,233,0.45)",
                        transform: "translate(-50%, -50%)",
                        boxShadow: "0 0 18px rgba(14,165,233,0.7)",
                      }}
                    />
                  </div>
                )}
                <ShipSilhouettes
                  ships={you.revealedSunkShipCells || []}
                  cellSize={cellSize}
                  gap={attackGap}
                  allSunk
                  flashingSunkShipIndexes={flashingEnemySunkShips}
                />
                <div />
                {Array.from({ length: boardSize }).map((_, x) => (
                  <div
                    key={`attack-col-${x}`}
                    style={{
                      height: 18,
                      color: "#77cce6",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "grid",
                      placeItems: "center",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {columnLabel(x)}
                  </div>
                ))}
                {Array.from({ length: boardSize * boardSize }).map((_, index) => {
                  const x = index % boardSize;
                  const y = Math.floor(index / boardSize);
                  const shot = shotMap.get(keyOf(x, y));
                  const used = Boolean(shot);
                  const canShoot =
                    roomView?.status === "battle" &&
                    roomView?.isYourTurn &&
                    !used &&
                    !you.defeated &&
                    !pendingShot;

                  const cellKey = keyOf(x, y);
                  const isSunkCell = revealedSunkEnemyCells.has(cellKey);
                  const flashType = flashCells?.attack?.[cellKey] || null;
                  const isPending =
                    pendingShot &&
                    pendingShot.x === x &&
                    pendingShot.y === y;

                  let background = "rgba(6, 28, 47, 0.88)";
                  let label = "";
                  let content = null;

                  if (isSunkCell) {
                    background = "linear-gradient(180deg, #7a2f00, #29120a)";
                    label = "💥";
                  } else if (shot?.hit) {
                    background = "radial-gradient(circle, rgba(255,122,43,0.9) 0%, rgba(89,27,11,0.9) 70%)";
                    label = "🔥";
                  } else if (shot && !shot.hit) {
                    background = "rgba(9, 43, 66, 0.92)";
                    label = "💧";
                  } else if (isPending) {
                    background = "rgba(16, 87, 120, 0.92)";
                  }

                  if (canShoot) {
                    background = "rgba(10, 45, 71, 0.95)";
                  } else if (!used && roomView?.status === "battle" && !roomView?.isYourTurn) {
                    background = "rgba(6, 24, 38, 0.78)";
                  }

                  if (flashType === "sunk") {
                    content = <EffectSprite kind="sunk" cellSize={cellSize} scale={1.05} />;
                  } else if (shot?.hit && !isSunkCell) {
                    content = <EffectSprite kind="hit" cellSize={cellSize} scale={0.76} />;
                  } else if (shot && !shot.hit) {
                    content = <EffectSprite kind="miss" cellSize={cellSize} scale={0.72} />;
                  }

                  let animation = "none";
                  if (isPending) {
                    animation = "shotPending 0.45s ease-in-out infinite";
                  } else if (isSunkCell) {
                    animation = "sinkGlow 0.8s ease-out";
                  } else if (flashType === "hit" || flashType === "sunk") {
                    animation = "hitFlash 0.25s ease-out";
                  } else if (flashType === "miss") {
                    animation = "missFlash 0.25s ease-out";
                  }

                  return (
                    <React.Fragment key={`${x}-${y}`}>
                      {x === 0 && (
                        <div
                          style={{
                            width: 18,
                            height: cellSize,
                            color: "#77cce6",
                            fontSize: 11,
                            fontWeight: 900,
                            display: "grid",
                            placeItems: "center",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {y + 1}
                        </div>
                      )}
                    <button
                      onClick={() => {
                        if (canShoot) onFire(x, y);
                      }}
                      disabled={!canShoot}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        border: isSunkCell
                          ? "1px solid rgba(255, 181, 91, 0.95)"
                          : canShoot
                            ? "1px solid rgba(94, 224, 255, 0.72)"
                            : roomView?.status === "battle" && !roomView?.isYourTurn
                              ? "1px solid rgba(72, 125, 151, 0.42)"
                              : "1px solid rgba(76, 166, 206, 0.5)",
                        borderRadius: isMobile ? 6 : 8,
                        background,
                        fontWeight: 900,
                        fontSize: isMobile ? 16 : 20,
                        cursor: canShoot ? "crosshair" : "default",
                        boxShadow: isSunkCell
                          ? "inset 0 0 0 2px rgba(255, 177, 80, 0.65), 0 0 18px rgba(255, 133, 56, 0.14)"
                          : canShoot
                            ? "0 0 0 1px rgba(94,224,255,0.12), inset 0 0 12px rgba(94,224,255,0.06)"
                            : "none",
                        animation,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        padding: 0,
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      {content || label}
                    </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(180deg, rgba(6,24,40,0.96), rgba(4,17,29,0.96))",
              borderRadius: 18,
              padding: isMobile ? 12 : 18,
              border: "1px solid rgba(90,230,255,0.16)",
              boxShadow: "0 16px 30px rgba(0,0,0,0.24)",
              display: isMobile && activeMobileBoard !== "ships" ? "none" : "block",
            }}
          >
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: "#f3fbff" }}>
              Your Board
            </div>
            <div style={{ marginTop: 8, color: "#86b4ca", fontSize: isMobile ? 12 : 14 }}>
              Fleet silhouettes hold position while hits, misses and sunk states stay readable.
            </div>

            <div
              style={{
                marginTop: 14,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
                <div
                  style={{
                    display: "grid",
                  gridTemplateColumns: `18px repeat(${boardSize}, ${cellSize}px)`,
                  gap: defenseGap,
                  width: "max-content",
                  margin: "0 auto",
                  position: "relative",
                }}
              >
                <ShipSilhouettes
                  ships={you.ships || []}
                  sunkShipIndexes={you.sunkShipIndexes || []}
                  cellSize={cellSize}
                  gap={defenseGap}
                  flashingSunkShipIndexes={flashingDefenseSunkShips}
                />
                <div />
                {Array.from({ length: boardSize }).map((_, x) => (
                  <div
                    key={`defense-col-${x}`}
                    style={{
                      height: 18,
                      color: "#77cce6",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "grid",
                      placeItems: "center",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {columnLabel(x)}
                  </div>
                ))}
                {Array.from({ length: boardSize * boardSize }).map((_, index) => {
                  const x = index % boardSize;
                  const y = Math.floor(index / boardSize);
                  const cellKey = keyOf(x, y);
                  const takenShot = takenShotMap.get(cellKey);
                  const isShip = myShipCells.has(cellKey);
                  const isGlobalHit = takenShot?.result === "global-hit";
                  const isHit = takenShot?.result === "hit" || isGlobalHit || myHitCells.has(cellKey);
                  const isMiss = takenShot?.result === "miss" || myMissCells.has(cellKey);
                  const isSunk = takenShot?.result === "sunk" || mySunkCells.has(cellKey);
                  const flashType = flashCells?.defense?.[cellKey] || null;

                  let background = "rgba(6, 28, 47, 0.88)";
                  let color = "#effbff";
                  let label = "";
                  let content = null;

                  if (isShip) {
                    background = "transparent";
                  }

                  if (isMiss && !isShip) {
                    background = "rgba(9, 43, 66, 0.92)";
                    label = "💧";
                  }

                  if (isHit) {
                    background = isGlobalHit
                      ? "radial-gradient(circle, rgba(255,168,122,0.9) 0%, rgba(117,34,17,0.92) 70%)"
                      : "radial-gradient(circle, rgba(255,122,43,0.9) 0%, rgba(89,27,11,0.94) 70%)";
                    color = "#ffffff";
                    label = "🔥";
                  }

                  if (isSunk) {
                    background = "linear-gradient(180deg, #7a2f00, #29120a)";
                    color = "#fff0d7";
                    label = "💥";
                  }

                  let animation = "none";
                  if (isSunk) {
                    animation = "sinkGlow 0.8s ease-out";
                  } else if (flashType === "hit") {
                    animation = "hitFlash 0.25s ease-out";
                  }

                  return (
                    <React.Fragment key={`${x}-${y}`}>
                      {x === 0 && (
                        <div
                          style={{
                            width: 18,
                            height: cellSize,
                            color: "#77cce6",
                            fontSize: 11,
                            fontWeight: 900,
                            display: "grid",
                            placeItems: "center",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {y + 1}
                        </div>
                      )}
                    <div
                      style={{
                        width: cellSize,
                        height: cellSize,
                        border: "1px solid rgba(76, 166, 206, 0.5)",
                        borderRadius: 6,
                        background,
                        color,
                        fontWeight: 900,
                        fontSize: isMobile ? 13 : 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        boxSizing: "border-box",
                        position: "relative",
                        zIndex: 1,
                        boxShadow: isSunk
                          ? "inset 0 0 0 2px rgba(255, 177, 80, 0.65), 0 0 18px rgba(255, 133, 56, 0.14)"
                          : "none",
                        animation,
                      }}
                    >
                      {content || label}
                    </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
