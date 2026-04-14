import React, { useEffect, useMemo, useState } from "react";

function keyOf(x, y) {
  return `${x},${y}`;
}

function buildShotMap(shotHistory) {
  const map = new Map();
  for (const shot of shotHistory || []) {
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
        background: "#111827",
        color: "#ffffff",
        borderRadius: 14,
        padding: "12px 16px",
        minWidth: 240,
        boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
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

  const players = roomView?.players || [];
  const you = roomView?.you || {
    ships: [],
    hitsTakenKeys: [],
    sunkShipIndexes: [],
    shotHistory: [],
    revealedSunkShipCells: [],
    defeated: false,
  };

  const [winnerOpen, setWinnerOpen] = useState(true);
  const [eliminatedOpen, setEliminatedOpen] = useState(true);

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
    if (!notifications?.length) return;
    const timers = notifications.map((n) =>
      setTimeout(() => clearNotification(n.id), 3200)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [notifications, clearNotification]);

  const shotMap = useMemo(() => buildShotMap(you.shotHistory || []), [you.shotHistory]);
  const myShipCells = useMemo(() => buildShipCellSet(you.ships || []), [you.ships]);
  const myHitCells = useMemo(() => new Set(you.hitsTakenKeys || []), [you.hitsTakenKeys]);
  const mySunkCells = useMemo(
    () => buildSunkCellSet(you.ships || [], you.sunkShipIndexes || []),
    [you.ships, you.sunkShipIndexes]
  );
  const revealedSunkEnemyCells = useMemo(
    () => buildRevealedSunkEnemyCells(you.revealedSunkShipCells || []),
    [you.revealedSunkShipCells]
  );

  const aliveCount = players.filter((p) => !p.defeated).length;
  const defeatedCount = players.filter((p) => p.defeated).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6fb",
        padding: isMobile ? 10 : 18,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        position: "relative",
      }}
    >
      {roomView?.status === "finished" && winnerOpen && roomView?.winnerName && (
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
        `}
      </style>

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
          }}
        >
          <div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: "#111827" }}>
              Battle
            </div>
            <div style={{ marginTop: 6, color: "#6b7280", fontSize: isMobile ? 13 : 16 }}>
              {roomView?.status === "finished"
                ? `Winner: ${roomView?.winnerName || "-"}`
                : roomView?.isYourTurn
                ? "Your turn"
                : `Turn: ${roomView?.currentTurnName || "-"}`}
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
                borderRadius: 12,
                background: "#eef2ff",
                color: "#3730a3",
                fontWeight: 800,
                fontSize: isMobile ? 12 : 14,
              }}
            >
              Alive {aliveCount} / Defeated {defeatedCount}
            </div>

            <button
              onClick={onBack}
              style={{
                background: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "10px 16px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: 12,
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {players.map((player) => {
            const isActive =
              roomView?.status === "battle" &&
              roomView?.currentTurnPlayerId === player.id;

            return (
              <div
                key={player.id}
                style={{
                  border: isActive ? "2px solid #2563eb" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "8px 12px",
                  background: isActive ? "#eff6ff" : "#ffffff",
                  animation: isActive ? "turnPulse 1.2s ease-out infinite" : "none",
                }}
              >
                <div style={{ fontWeight: 800, color: "#111827", fontSize: isMobile ? 13 : 16 }}>
                  {player.name} {isActive ? "🎯" : ""}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: player.defeated ? "#991b1b" : "#166534",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {player.defeated ? "DEFEATED" : "ALIVE"}
                </div>
              </div>
            );
          })}
        </div>

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
              background: "#ffffff",
              borderRadius: 18,
              padding: isMobile ? 12 : 18,
              boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: "#111827" }}>
              Attack
            </div>
            <div style={{ marginTop: 8, color: "#6b7280", fontSize: isMobile ? 12 : 14 }}>
              Yellow outline = sunk ship
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
                  gridTemplateColumns: `repeat(${boardSize}, ${cellSize}px)`,
                  gap: isMobile ? 2 : 4,
                  width: "max-content",
                  margin: "0 auto",
                }}
              >
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

                  let background = "#ffffff";
                  let label = "";

                  if (isSunkCell) {
                    background = "#fde68a";
                    label = "💥";
                  } else if (shot?.hit) {
                    background = "#fecaca";
                    label = "🔥";
                  } else if (shot && !shot.hit) {
                    background = "#dbeafe";
                    label = "💧";
                  } else if (isPending) {
                    background = "#fde68a";
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
                    <button
                      key={`${x}-${y}`}
                      onClick={() => {
                        if (canShoot) onFire(x, y);
                      }}
                      disabled={!canShoot}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        border: "1px solid #cbd5e1",
                        borderRadius: isMobile ? 6 : 8,
                        background,
                        fontWeight: 900,
                        fontSize: isMobile ? 16 : 20,
                        cursor: canShoot ? "pointer" : "default",
                        boxShadow: isSunkCell ? "inset 0 0 0 3px #facc15" : "none",
                        animation,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: 18,
              padding: isMobile ? 12 : 18,
              boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: "#111827" }}>
              My Ships
            </div>
            <div style={{ marginTop: 8, color: "#6b7280", fontSize: isMobile ? 12 : 14 }}>
              Blue = ship · Red = hit taken
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
                  gridTemplateColumns: `repeat(${boardSize}, ${cellSize}px)`,
                  gap: 2,
                  width: "max-content",
                  margin: "0 auto",
                }}
              >
                {Array.from({ length: boardSize * boardSize }).map((_, index) => {
                  const x = index % boardSize;
                  const y = Math.floor(index / boardSize);
                  const cellKey = keyOf(x, y);
                  const isShip = myShipCells.has(cellKey);
                  const isHit = myHitCells.has(cellKey);
                  const isSunk = mySunkCells.has(cellKey);
                  const flashType = flashCells?.defense?.[cellKey] || null;

                  let background = "#ffffff";
                  let color = "#111827";
                  let label = "";

                  if (isShip) {
                    background = "#bfdbfe";
                  }

                  if (isHit) {
                    background = "#ef4444";
                    color = "#ffffff";
                    label = "X";
                  }

                  let animation = "none";
                  if (isSunk) {
                    animation = "sinkGlow 0.8s ease-out";
                  } else if (flashType === "hit") {
                    animation = "hitFlash 0.25s ease-out";
                  }

                  return (
                    <div
                      key={`${x}-${y}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        background,
                        color,
                        fontWeight: 900,
                        fontSize: isMobile ? 13 : 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxSizing: "border-box",
                        boxShadow: isSunk ? "inset 0 0 0 3px #facc15" : "none",
                        animation,
                      }}
                    >
                      {label}
                    </div>
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