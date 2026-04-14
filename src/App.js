import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import WaitingRoomScreen from "./components/WaitingRoomScreen";
import BattleScreen from "./components/BattleScreen";

const BOARD_SIZE = 10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2];

function keyOf(x, y) {
  return `${x},${y}`;
}

function makeShip(x, y, length, orientation) {
  const cells = [];
  for (let i = 0; i < length; i += 1) {
    const cell =
      orientation === "horizontal"
        ? { x: x + i, y }
        : { x, y: y + i };

    if (
      cell.x < 0 ||
      cell.x >= BOARD_SIZE ||
      cell.y < 0 ||
      cell.y >= BOARD_SIZE
    ) {
      return null;
    }

    cells.push(cell);
  }
  return cells;
}

function canPlaceShip(existingShips, candidateShip) {
  if (!candidateShip) return false;
  const used = new Set(existingShips.flat().map((cell) => keyOf(cell.x, cell.y)));
  return candidateShip.every((cell) => !used.has(keyOf(cell.x, cell.y)));
}

function HomeButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#2563eb",
        color: "#ffffff",
        border: "none",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        width: "100%",
      }}
    >
      {children}
    </button>
  );
}

function cardStyle() {
  return {
    background: "#ffffff",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  };
}

function createAudioEngine() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }

  const ctx = new AudioCtx();

  function ensureRunning() {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function beep({
    frequency,
    duration = 0.12,
    type = "square",
    gain = 0.12,
    frequencyEnd = null,
  }) {
    ensureRunning();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    if (frequencyEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(
        frequencyEnd,
        ctx.currentTime + duration
      );
    }

    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  function unlock() {
    ensureRunning();

    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start(0);
  }

  return {
    unlock,
    shot() {
      beep({ frequency: 420, duration: 0.05, type: "square", gain: 0.08 });
    },
    hit() {
      beep({ frequency: 820, duration: 0.08, type: "square", gain: 0.11 });
      setTimeout(() => beep({ frequency: 1120, duration: 0.09, type: "square", gain: 0.1 }), 65);
    },
    miss() {
      beep({ frequency: 190, duration: 0.16, type: "triangle", gain: 0.1, frequencyEnd: 140 });
    },
    sunk() {
      beep({ frequency: 620, duration: 0.08, type: "square", gain: 0.11 });
      setTimeout(() => beep({ frequency: 880, duration: 0.1, type: "square", gain: 0.11 }), 80);
      setTimeout(() => beep({ frequency: 1240, duration: 0.14, type: "square", gain: 0.1 }), 170);
    },
    eliminated() {
      beep({ frequency: 260, duration: 0.16, type: "sawtooth", gain: 0.12, frequencyEnd: 180 });
      setTimeout(() => beep({ frequency: 210, duration: 0.18, type: "sawtooth", gain: 0.11, frequencyEnd: 150 }), 130);
    },
    winner() {
      beep({ frequency: 784, duration: 0.12, type: "square", gain: 0.12 });
      setTimeout(() => beep({ frequency: 988, duration: 0.12, type: "square", gain: 0.12 }), 140);
      setTimeout(() => beep({ frequency: 1318, duration: 0.2, type: "square", gain: 0.12 }), 290);
    },
  };
}

export default function App() {
  const [playerName, setPlayerName] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [activeRoomCode, setActiveRoomCode] = useState("");
  const [roomView, setRoomView] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [orientation, setOrientation] = useState("horizontal");
  const [placedShips, setPlacedShips] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [flashCells, setFlashCells] = useState({
    attack: {},
    defense: {},
  });
  const [pendingShot, setPendingShot] = useState(null);

  const prevRoomViewRef = useRef(null);
  const audioRef = useRef(null);

  const getCurrentRoomCode = useCallback(() => {
    return (
      roomView?.roomCode ||
      activeRoomCode ||
      roomCodeInput?.trim()?.toUpperCase() ||
      ""
    );
  }, [roomView, activeRoomCode, roomCodeInput]);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = createAudioEngine();
    }

    if (audioRef.current?.unlock) {
      audioRef.current.unlock();
    }
  }, []);

  const playEffect = useCallback((type) => {
    ensureAudio();
    if (audioRef.current && typeof audioRef.current[type] === "function") {
      audioRef.current[type]();
    }
  }, [ensureAudio]);

  const vibrate = useCallback((pattern) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  const addNotification = useCallback((text) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [...prev, { id, text }]);
  }, []);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const flashAttackCell = useCallback((x, y, type) => {
    const cellKey = keyOf(x, y);
    setFlashCells((prev) => ({
      ...prev,
      attack: {
        ...prev.attack,
        [cellKey]: type,
      },
    }));
    setTimeout(() => {
      setFlashCells((prev) => {
        const next = { ...prev.attack };
        delete next[cellKey];
        return { ...prev, attack: next };
      });
    }, 320);
  }, []);

  const flashDefenseCells = useCallback((cells, type = "hit") => {
    if (!cells?.length) return;
    setFlashCells((prev) => {
      const nextDefense = { ...prev.defense };
      for (const cell of cells) {
        nextDefense[keyOf(cell.x, cell.y)] = type;
      }
      return { ...prev, defense: nextDefense };
    });

    setTimeout(() => {
      setFlashCells((prev) => {
        const nextDefense = { ...prev.defense };
        for (const cell of cells) {
          delete nextDefense[keyOf(cell.x, cell.y)];
        }
        return { ...prev, defense: nextDefense };
      });
    }, 350);
  }, []);

  useEffect(() => {
    const unlockFromGesture = () => {
      ensureAudio();
    };

    window.addEventListener("touchstart", unlockFromGesture, { passive: true });
    window.addEventListener("pointerdown", unlockFromGesture, { passive: true });
    window.addEventListener("click", unlockFromGesture, { passive: true });

    return () => {
      window.removeEventListener("touchstart", unlockFromGesture);
      window.removeEventListener("pointerdown", unlockFromGesture);
      window.removeEventListener("click", unlockFromGesture);
    };
  }, [ensureAudio]);

  useEffect(() => {
    const onRoomState = (payload) => {
      const previous = prevRoomViewRef.current;

      if (previous?.you?.hitsTakenKeys && payload?.you?.hitsTakenKeys) {
        const prevHits = new Set(previous.you.hitsTakenKeys);
        const newHitCells = payload.you.hitsTakenKeys
          .filter((cellKey) => !prevHits.has(cellKey))
          .map((cellKey) => {
            const [x, y] = cellKey.split(",").map(Number);
            return { x, y };
          });

        if (newHitCells.length) {
          flashDefenseCells(newHitCells, "hit");
        }
      }

      setRoomView(payload);
      setActiveRoomCode(payload?.roomCode || "");
      setRoomCodeInput(payload?.roomCode || "");
      setError("");
      setInfo("");
      setPendingShot(null);

      if (!payload?.you?.ready) {
        setPlacedShips([]);
      }

      prevRoomViewRef.current = payload;
    };

    const onBattlePopup = (payload) => {
      const items = payload?.items || [];
      items.forEach((item) => {
        if (item?.text) {
          addNotification(item.text);
        }
      });

      if (payload?.type === "sunk") {
        playEffect("sunk");
        vibrate([80, 40, 100]);
      } else if (payload?.type === "eliminated") {
        playEffect("eliminated");
        vibrate([120, 60, 120]);
      } else if (payload?.type === "winner") {
        playEffect("winner");
        vibrate([160, 80, 160, 80, 220]);
      }
    };

    socket.on("room_state", onRoomState);
    socket.on("battle_popup", onBattlePopup);

    return () => {
      socket.off("room_state", onRoomState);
      socket.off("battle_popup", onBattlePopup);
    };
  }, [addNotification, flashDefenseCells, playEffect, vibrate]);

  const currentShipLength = SHIP_LENGTHS[placedShips.length] || null;

  const placedCellSet = useMemo(() => {
    return new Set(placedShips.flat().map((cell) => keyOf(cell.x, cell.y)));
  }, [placedShips]);

  const handleCreateRoom = () => {
    ensureAudio();
    setError("");
    setInfo("");

    socket.emit(
      "create_room",
      {
        playerName: playerName.trim() || "Player 1",
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.error || "Could not create room.");
          return;
        }

        const code = response.roomCode || "";
        setActiveRoomCode(code);
        setRoomCodeInput(code);
        setPlacedShips([]);
      }
    );
  };

  const handleJoinRoom = () => {
    ensureAudio();
    setError("");
    setInfo("");

    const cleanRoomCode = roomCodeInput.trim().toUpperCase();
    if (!cleanRoomCode) {
      setError("Enter a room code.");
      return;
    }

    socket.emit(
      "join_room",
      {
        roomCode: cleanRoomCode,
        playerName: playerName.trim() || "Player",
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.error || "Could not join room.");
          return;
        }

        setActiveRoomCode(cleanRoomCode);
        setRoomCodeInput(cleanRoomCode);
        setPlacedShips([]);
      }
    );
  };

  const handlePlaceShip = (x, y) => {
    ensureAudio();
    if (!currentShipLength) return;
    const candidate = makeShip(x, y, currentShipLength, orientation);
    if (!canPlaceShip(placedShips, candidate)) return;
    setPlacedShips((prev) => [...prev, candidate]);
  };

  const handleUndoShip = () => {
    ensureAudio();
    setPlacedShips((prev) => prev.slice(0, -1));
  };

  const handleResetPlacement = () => {
    ensureAudio();
    setPlacedShips([]);
  };

  const handleSubmitShips = () => {
    ensureAudio();
    setError("");
    setInfo("");

    const roomCode = getCurrentRoomCode();
    if (!roomCode) {
      setError("Room not found.");
      return;
    }

    if (placedShips.length !== SHIP_LENGTHS.length) {
      setError("Place all ships first.");
      return;
    }

    socket.emit(
      "submit_ships",
      {
        roomCode,
        ships: placedShips,
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.error || "Could not submit ships.");
          return;
        }

        setActiveRoomCode(roomCode);
        setRoomCodeInput(roomCode);
        setInfo("Ready");
      }
    );
  };

  const handleFire = (x, y) => {
    ensureAudio();
    setError("");
    setInfo("");

    const roomCode = getCurrentRoomCode();
    if (!roomCode) {
      setError("Room not found.");
      return;
    }

    if (pendingShot) return;

    setPendingShot({ x, y });
    playEffect("shot");

    setTimeout(() => {
      socket.emit(
        "fire_shot",
        {
          roomCode,
          x,
          y,
        },
        (response) => {
          setPendingShot(null);

          if (!response?.ok) {
            setError(response?.error || "Could not fire shot.");
            return;
          }

          if (response.hit) {
            setInfo(`Hit on ${response.hitPlayers.map((p) => p.name).join(", ")}`);
            playEffect("hit");
            vibrate(60);
            flashAttackCell(x, y, response.sunkShips?.length ? "sunk" : "hit");
          } else {
            setInfo("Miss");
            playEffect("miss");
            vibrate(25);
            flashAttackCell(x, y, "miss");
          }
        }
      );
    }, 150);
  };

  const resetLocalState = useCallback(() => {
    setActiveRoomCode("");
    setRoomCodeInput("");
    setRoomView(null);
    setPlacedShips([]);
    setOrientation("horizontal");
    setError("");
    setInfo("");
    setNotifications([]);
    setFlashCells({ attack: {}, defense: {} });
    setPendingShot(null);
    prevRoomViewRef.current = null;
  }, []);

  const handleBack = useCallback(() => {
    ensureAudio();
    const roomCode = getCurrentRoomCode();
    if (!roomCode) {
      resetLocalState();
      return;
    }

    socket.emit(
      "leave_room",
      { roomCode },
      () => {
        resetLocalState();
      }
    );
  }, [getCurrentRoomCode, resetLocalState, ensureAudio]);

  const renderHome = () => (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "grid",
        placeItems: "center",
        padding: 14,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(84vw, 360px)",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            background: "#000000",
            borderRadius: 18,
            padding: "28px 16px",
            minHeight: 330,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            border: "1px solid #2563eb",
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "#60a5fa",
            }}
          >
            Battleship Multiplayer
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1px solid #2563eb",
                background: "#050505",
                color: "#dbeafe",
                fontSize: 16,
                boxSizing: "border-box",
                outline: "none",
              }}
            />

            <input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="Room code"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1px solid #2563eb",
                background: "#050505",
                color: "#dbeafe",
                fontSize: 16,
                boxSizing: "border-box",
                letterSpacing: 2,
                textTransform: "uppercase",
                outline: "none",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
              }}
            >
              <HomeButton onClick={handleCreateRoom}>Create Room</HomeButton>
              <HomeButton onClick={handleJoinRoom}>Join Room</HomeButton>
            </div>
          </div>
        </div>

        {(error || info) && (
          <div
            style={{
              background: "#000000",
              borderRadius: 18,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
              border: `1px solid ${error ? "#7f1d1d" : "#2563eb"}`,
              color: error ? "#fca5a5" : "#93c5fd",
              fontWeight: 700,
            }}
          >
            {error || info}
          </div>
        )}
      </div>
    </div>
  );

  const renderPlacement = () => {
    const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
    const placementCellSize = isMobile ? 30 : 34;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          padding: isMobile ? 12 : 20,
          boxSizing: "border-box",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              ...cardStyle(),
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: "#111827" }}>
                Placement
              </div>
              <div style={{ marginTop: 10, color: "#6b7280", textAlign: isMobile ? "center" : "left" }}>
                Room code
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: "clamp(38px, 13vw, 74px)",
                  fontWeight: 900,
                  letterSpacing: "clamp(3px, 1vw, 8px)",
                  color: "#2563eb",
                  lineHeight: 1,
                  textAlign: isMobile ? "center" : "left",
                  wordBreak: "break-word",
                }}
              >
                {getCurrentRoomCode()}
              </div>
            </div>

            <button
              onClick={handleBack}
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

          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))",
              alignItems: "start",
            }}
          >
            <div style={cardStyle()}>
              <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 900, color: "#111827" }}>
                Controls
              </div>

              <div style={{ marginTop: 14, color: "#6b7280", lineHeight: 1.7, fontSize: isMobile ? 14 : 16 }}>
                {currentShipLength
                  ? `Place ship of length ${currentShipLength}.`
                  : "All ships placed. Press Ready."}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    setOrientation((prev) =>
                      prev === "horizontal" ? "vertical" : "horizontal"
                    )
                  }
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Rotate
                </button>

                <button
                  onClick={handleUndoShip}
                  style={{
                    background: "#6b7280",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Undo
                </button>

                <button
                  onClick={handleResetPlacement}
                  style={{
                    background: "#111827",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>

                <button
                  onClick={handleSubmitShips}
                  style={{
                    background:
                      placedShips.length === SHIP_LENGTHS.length ? "#16a34a" : "#9ca3af",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor:
                      placedShips.length === SHIP_LENGTHS.length ? "pointer" : "default",
                  }}
                >
                  Ready
                </button>
              </div>

              {(error || info) && (
                <div
                  style={{
                    marginTop: 18,
                    borderRadius: 12,
                    padding: 14,
                    border: `2px solid ${error ? "#fecaca" : "#bfdbfe"}`,
                    color: error ? "#991b1b" : "#1d4ed8",
                    fontWeight: 700,
                  }}
                >
                  {error || info}
                </div>
              )}
            </div>

            <div style={cardStyle()}>
              <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 900, color: "#111827" }}>
                Board
              </div>
              <div style={{ marginTop: 8, color: "#6b7280", fontSize: isMobile ? 12 : 14 }}>
                Ships cannot overlap.
              </div>

              <div style={{ marginTop: 16, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, ${placementCellSize}px)`,
                    gap: 2,
                    width: "max-content",
                    margin: "0 auto",
                  }}
                >
                  {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => {
                    const x = index % BOARD_SIZE;
                    const y = Math.floor(index / BOARD_SIZE);
                    const occupied = placedCellSet.has(keyOf(x, y));

                    return (
                      <button
                        key={`${x}-${y}`}
                        onClick={() => handlePlaceShip(x, y)}
                        style={{
                          width: placementCellSize,
                          height: placementCellSize,
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          background: occupied ? "#93c5fd" : "#ffffff",
                          cursor: currentShipLength ? "pointer" : "default",
                          padding: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!activeRoomCode && !roomView) {
    return renderHome();
  }

  if (!roomView) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#eef3fb",
          display: "grid",
          placeItems: "center",
          fontFamily: "Arial, sans-serif",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div style={cardStyle()}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>
            Entering room...
          </div>
        </div>
      </div>
    );
  }

  if (roomView.status === "battle" || roomView.status === "finished") {
    return (
      <BattleScreen
        roomView={roomView}
        onFire={handleFire}
        onBack={handleBack}
        notifications={notifications}
        clearNotification={clearNotification}
        flashCells={flashCells}
        pendingShot={pendingShot}
      />
    );
  }

  if (roomView?.you?.ready) {
    return <WaitingRoomScreen roomView={roomView} onBack={handleBack} />;
  }

  return renderPlacement();
}