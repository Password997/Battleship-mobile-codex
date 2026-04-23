import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import WaitingRoomScreen from "./components/WaitingRoomScreen";
import BattleScreen from "./components/BattleScreen";

const BOARD_SIZE = 10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2];
const CLIENT_ID_STORAGE_KEY = "battleshipClientId";

function keyOf(x, y) {
  return `${x},${y}`;
}

function getClientId() {
  if (typeof window === "undefined") return "";

  const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;

  const next =
    window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
  return next;
}

function columnLabel(index) {
  return String.fromCharCode(65 + index);
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

function ShipSilhouettes({ ships, cellSize, gap }) {
  return (
    <>
      {(ships || []).map((ship, index) => {
        const bounds = getShipBounds(ship, cellSize, gap);
        const noseSize = Math.min(cellSize * 0.46, 16);

        return (
          <div
            key={`placed-ship-shape-${index}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
              borderRadius: bounds.horizontal ? "999px 12px 12px 999px" : "999px 999px 12px 12px",
              background: "linear-gradient(135deg, #edf9ff 0%, #7fdcff 12%, #2c5f82 42%, #0a1a2c 100%)",
              border: "1px solid rgba(145,236,255,0.36)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18), 0 6px 14px rgba(18,102,156,0.18)",
              pointerEvents: "none",
              zIndex: 0,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: bounds.horizontal ? 5 : "50%",
                top: bounds.horizontal ? "50%" : 5,
                width: bounds.horizontal ? noseSize : Math.max(8, bounds.width * 0.5),
                height: bounds.horizontal ? Math.max(8, bounds.height * 0.5) : noseSize,
                borderRadius: "999px",
                background: "rgba(239,251,255,0.62)",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        );
      })}
    </>
  );
}

function HomeButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "linear-gradient(180deg, rgba(10,54,81,1), rgba(6,25,42,1))",
        color: "#f2fcff",
        border: "1px solid rgba(99,226,255,0.22)",
        borderRadius: 16,
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        cursor: "pointer",
        width: "100%",
        boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
      }}
    >
      {children}
    </button>
  );
}

function cardStyle() {
  return {
    background: "linear-gradient(180deg, rgba(8,31,51,0.97), rgba(4,18,31,0.96))",
    borderRadius: 22,
    padding: 20,
    border: "1px solid rgba(95,224,255,0.16)",
    boxShadow: "0 18px 38px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(95,224,255,0.04)",
  };
}

function PlacementActionButton({
  icon,
  label,
  onClick,
  background = "#2563eb",
  animationKey = 0,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background,
        color: "#f3fbff",
        border: "1px solid rgba(102,229,255,0.14)",
        borderRadius: 16,
        padding: "11px 15px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        boxShadow: "0 12px 24px rgba(0,0,0,0.22)",
      }}
    >
      <span
        key={animationKey}
        className={animationKey ? "rotate-action-icon" : ""}
        style={{
          minWidth: 22,
          fontSize: 13,
          lineHeight: 1,
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 999,
          padding: "4px 6px",
          background: "rgba(255,255,255,0.08)",
          letterSpacing: "0.06em",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </span>
    </button>
  );
}

function FleetCounter({ shipLengths, placedCount, currentIndex }) {
  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      {shipLengths.map((length, index) => {
        const isPlaced = index < placedCount;
        const isCurrent = index === currentIndex;
        const color = isPlaced ? "#ff8a3d" : isCurrent ? "#59dfff" : "rgba(123, 183, 207, 0.26)";

        return (
          <div
            key={`${length}-${index}`}
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 5,
              color: isPlaced ? "#ffd0b0" : isCurrent ? "#a5f0ff" : "#6f97ab",
              fontWeight: isCurrent ? 900 : 700,
            }}
          >
            <span>{length}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {Array.from({ length }).map((_, blockIndex) => (
                <span
                  key={blockIndex}
                  style={{
                    width: 15,
                    height: 10,
                    borderRadius: 3,
                    background: color,
                    display: "inline-block",
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
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
    join() {
      beep({ frequency: 660, duration: 0.06, type: "triangle", gain: 0.07 });
      setTimeout(() => beep({ frequency: 880, duration: 0.07, type: "triangle", gain: 0.06 }), 70);
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
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [orientation, setOrientation] = useState("horizontal");
  const [rotateAnimationKey, setRotateAnimationKey] = useState(0);
  const [placedShips, setPlacedShips] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [flashCells, setFlashCells] = useState({
    attack: {},
    defense: {},
  });
  const [pendingShot, setPendingShot] = useState(null);
  const [placementHoverCell, setPlacementHoverCell] = useState(null);

  const prevRoomViewRef = useRef(null);
  const wasDisconnectedRef = useRef(!socket.connected);
  const waitingForRoomRestoreRef = useRef(false);
  const connectionNoticeTimerRef = useRef(null);
  const audioRef = useRef(null);
  const placementCompleteRef = useRef(false);
  const wakeLockRef = useRef(null);
  const initialsInputRefs = useRef([]);
  const clientIdRef = useRef(getClientId());

  const getCurrentRoomCode = useCallback(() => {
    return (
      roomView?.roomCode ||
      activeRoomCode ||
      roomCodeInput?.trim()?.toUpperCase() ||
      ""
    );
  }, [roomView, activeRoomCode, roomCodeInput]);

  const showConnectionNotice = useCallback((message, autoHide = false) => {
    if (connectionNoticeTimerRef.current) {
      clearTimeout(connectionNoticeTimerRef.current);
      connectionNoticeTimerRef.current = null;
    }

    setConnectionNotice(message);

    if (autoHide) {
      connectionNoticeTimerRef.current = setTimeout(() => {
        setConnectionNotice("");
        connectionNoticeTimerRef.current = null;
      }, 2600);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (connectionNoticeTimerRef.current) {
        clearTimeout(connectionNoticeTimerRef.current);
      }
    };
  }, []);

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

  const requestWakeLock = useCallback(() => {
    if (!navigator?.wakeLock?.request) return;

    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        wakeLockRef.current = lock;
        lock.addEventListener("release", () => {
          if (wakeLockRef.current === lock) {
            wakeLockRef.current = null;
          }
        });
      })
      .catch(() => {});
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
      requestWakeLock();
    };

    window.addEventListener("touchstart", unlockFromGesture, { passive: true });
    window.addEventListener("pointerdown", unlockFromGesture, { passive: true });
    window.addEventListener("click", unlockFromGesture, { passive: true });

    return () => {
      window.removeEventListener("touchstart", unlockFromGesture);
      window.removeEventListener("pointerdown", unlockFromGesture);
      window.removeEventListener("click", unlockFromGesture);
    };
  }, [ensureAudio, requestWakeLock]);

  useEffect(() => {
    if (!activeRoomCode && !roomView) return undefined;

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [activeRoomCode, roomView, requestWakeLock]);

  useEffect(() => {
    const handleConnect = () => {
      setSocketConnected(true);

      if (wasDisconnectedRef.current && (activeRoomCode || roomView)) {
        showConnectionNotice("Back online", true);
        waitingForRoomRestoreRef.current = true;
      }

      wasDisconnectedRef.current = false;
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      wasDisconnectedRef.current = true;

      if (activeRoomCode || roomView) {
        showConnectionNotice("Reconnecting...");
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

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

      if (
        previous &&
        previous.status === "lobby" &&
        payload?.status === "lobby" &&
        (payload?.players?.length || 0) > (previous?.players?.length || 0)
      ) {
        playEffect("join");
      }

      if (
        previous &&
        !previous.isYourTurn &&
        payload?.isYourTurn &&
        payload?.status === "battle"
      ) {
        vibrate([45, 25, 45]);
      }

      setRoomView(payload);
      setActiveRoomCode(payload?.roomCode || "");
      setRoomCodeInput(payload?.roomCode || "");
      setError("");
      setInfo("");
      setPendingShot(null);

      if (waitingForRoomRestoreRef.current) {
        showConnectionNotice("You are still in the room", true);
        waitingForRoomRestoreRef.current = false;
        wasDisconnectedRef.current = false;
      }

      if (payload?.status === "lobby") {
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
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room_state", onRoomState);
      socket.off("battle_popup", onBattlePopup);
    };
  }, [
    activeRoomCode,
    addNotification,
    flashDefenseCells,
    playEffect,
    roomView,
    showConnectionNotice,
    vibrate,
  ]);

  const currentShipLength = SHIP_LENGTHS[placedShips.length] || null;
  const placementComplete = placedShips.length === SHIP_LENGTHS.length;

  useEffect(() => {
    if (placementComplete && !placementCompleteRef.current) {
      vibrate([50, 30, 70]);
      placementCompleteRef.current = true;
      return;
    }

    if (!placementComplete) {
      placementCompleteRef.current = false;
    }
  }, [placementComplete, vibrate]);

  const placedCellSet = useMemo(() => {
    return new Set(placedShips.flat().map((cell) => keyOf(cell.x, cell.y)));
  }, [placedShips]);

  const placementPreview = useMemo(() => {
    if (!placementHoverCell || !currentShipLength) {
      return { cells: new Set(), valid: false };
    }

    const candidate = makeShip(
      placementHoverCell.x,
      placementHoverCell.y,
      currentShipLength,
      orientation
    );

    return {
      cells: new Set((candidate || []).map((cell) => keyOf(cell.x, cell.y))),
      valid: canPlaceShip(placedShips, candidate),
    };
  }, [currentShipLength, orientation, placedShips, placementHoverCell]);

  const handleCreateRoom = () => {
    ensureAudio();
    setError("");
    setInfo("");

    socket.emit(
      "create_room",
      {
        clientId: clientIdRef.current,
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
        clientId: clientIdRef.current,
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

  const handleStartPlacement = () => {
    ensureAudio();
    setError("");
    setInfo("");

    const roomCode = getCurrentRoomCode();
    if (!roomCode) {
      setError("Room not found.");
      return;
    }

    socket.emit(
      "start_placement",
      {
        clientId: clientIdRef.current,
        roomCode,
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.error || "Could not start placement.");
          return;
        }

        setActiveRoomCode(roomCode);
        setRoomCodeInput(roomCode);
        setPlacedShips([]);
        setInfo("");
      }
    );
  };

  const handlePlaceShip = (x, y) => {
    ensureAudio();
    if (!currentShipLength) return;
    const candidate = makeShip(x, y, currentShipLength, orientation);
    if (!canPlaceShip(placedShips, candidate)) return;
    setPlacedShips((prev) => [...prev, candidate]);
    setPlacementHoverCell(null);
  };

  const handlePlacementCellPress = (x, y, isMobile) => {
    ensureAudio();
    if (!currentShipLength) return;

    if (!isMobile) {
      handlePlaceShip(x, y);
      return;
    }

    const samePreview =
      placementHoverCell &&
      placementHoverCell.x === x &&
      placementHoverCell.y === y;

    if (!samePreview) {
      setPlacementHoverCell({ x, y });
      vibrate(20);
      return;
    }

    if (placementPreview.valid) {
      handlePlaceShip(x, y);
      vibrate([35, 20, 35]);
    }
  };

  const handleUndoShip = () => {
    ensureAudio();
    setPlacedShips((prev) => prev.slice(0, -1));
    setPlacementHoverCell(null);
  };

  const handleResetPlacement = () => {
    ensureAudio();
    setPlacedShips([]);
    setPlacementHoverCell(null);
  };

  const handleRotateShip = () => {
    ensureAudio();
    setRotateAnimationKey((prev) => prev + 1);
    setOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"));
    setPlacementHoverCell(null);
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
        clientId: clientIdRef.current,
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
          clientId: clientIdRef.current,
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
            flashAttackCell(x, y, response.sunkMissShips?.length ? "sunk" : "miss");
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
      { roomCode, clientId: clientIdRef.current },
      () => {
        resetLocalState();
      }
    );
  }, [getCurrentRoomCode, resetLocalState, ensureAudio]);

  const withConnectionNotice = (screen) => (
    <>
      <style>
        {`
          @keyframes connectionSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      {connectionNotice && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            maxWidth: "calc(100vw - 24px)",
            background: socketConnected ? "#ecfdf5" : "#fffbeb",
            color: socketConnected ? "#166534" : "#92400e",
            border: `1px solid ${socketConnected ? "#86efac" : "#fcd34d"}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 900,
            fontSize: 13,
            boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: socketConnected ? "#22c55e" : "transparent",
              border: socketConnected ? "none" : "2px solid #f59e0b",
              borderTopColor: socketConnected ? "#22c55e" : "transparent",
              display: "inline-block",
              animation: socketConnected ? "none" : "connectionSpin 0.8s linear infinite",
              boxSizing: "border-box",
              flex: "0 0 auto",
            }}
          />
          <span>{connectionNotice}</span>
        </div>
      )}
      {screen}
    </>
  );

  const renderHome = () => (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 86%, rgba(68,206,255,0.12), transparent 18%), linear-gradient(180deg, #03101a 0%, #071a2a 46%, #0a2740 78%, #081a2a 100%)",
        padding: 16,
        boxSizing: "border-box",
        fontFamily: "'Segoe UI', 'Trebuchet MS', Arial, sans-serif",
        color: "#eefaff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <style>
        {`
          @keyframes homeSpinner {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes sonarSweep {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }

          @keyframes beaconPulse {
            0%, 100% { opacity: 0.5; transform: scale(0.98); }
            50% { opacity: 1; transform: scale(1.04); }
          }
        `}
      </style>

      <div
        style={{
          width: "min(100%, 540px)",
          minHeight: "calc(100vh - 32px)",
          borderRadius: 0,
          overflow: "hidden",
          borderLeft: "1px solid rgba(94, 224, 255, 0.18)",
          borderRight: "1px solid rgba(94, 224, 255, 0.18)",
          background: "linear-gradient(180deg, rgba(4,18,31,0.98), rgba(3,14,24,0.98))",
          boxShadow: "0 26px 70px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            padding: "10px 18px 12px",
            borderBottom: "1px solid rgba(94,224,255,0.08)",
          }}
        >
            <div
              style={{
                minWidth: 78,
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  border: "1px solid rgba(185,236,255,0.2)",
                  background: "linear-gradient(180deg, rgba(20,37,51,1), rgba(7,19,30,1))",
                  display: "grid",
                  placeItems: "center",
                  color: "#dff8ff",
                fontSize: 26,
              }}
            >
              ⚓
            </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#f4fbff" }}>
                  Admiral_{playerName || "07"}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#62ddff", fontWeight: 800, letterSpacing: "0.02em" }}>
                  Command Deck
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div
                style={{
                  width: 70,
                  height: 62,
                  borderRadius: 18,
                  border: "1px solid rgba(94,224,255,0.14)",
                  background: "rgba(8,31,51,0.9)",
                  display: "grid",
                  placeItems: "center",
                  color: "#dff8ff",
                fontSize: 24,
              }}
            >
              ≡
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 16px 16px" }}>
          <div
            style={{
              position: "relative",
              minHeight: 560,
              borderRadius: 30,
              overflow: "hidden",
              border: "1px solid rgba(94,224,255,0.12)",
              background:
                "radial-gradient(circle at 50% 16%, rgba(83,224,255,0.09), transparent 26%), linear-gradient(180deg, rgba(6,22,37,0.48), rgba(5,18,31,0.1)), linear-gradient(180deg, #08192a 0%, #071524 45%, #06111d 100%)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(rgba(99,216,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(99,216,255,0.035) 1px, transparent 1px)",
                backgroundSize: "38px 38px",
                opacity: 0.42,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "13%",
                width: 430,
                height: 430,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "1px solid rgba(94,224,255,0.14)",
                boxShadow:
                  "0 0 0 52px rgba(94,224,255,0.022), 0 0 0 120px rgba(94,224,255,0.012)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "13%",
                width: 470,
                height: 470,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background:
                  "conic-gradient(from 0deg, rgba(97,230,255,0.22), rgba(97,230,255,0.02) 18%, transparent 32%, transparent 100%)",
                animation: "sonarSweep 9s linear infinite",
                opacity: 0.9,
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 86,
                left: 0,
                right: 0,
                textAlign: "center",
                padding: "0 14px",
              }}
            >
              <div
                style={{
                  fontSize: 92,
                  lineHeight: 0.9,
                  fontWeight: 900,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#edf7fd",
                  textShadow: "0 4px 20px rgba(0,0,0,0.35)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                Battleship
              </div>
              <div
                style={{
                  marginTop: 10,
                  color: "#63e1ff",
                  fontSize: 18,
                  letterSpacing: "0.28em",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  opacity: 0.72,
                }}
              >
                Tactical Naval Warfare
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 158,
                height: 232,
                background:
                  "radial-gradient(circle at 50% 0%, rgba(76,214,255,0.18), transparent 18%), linear-gradient(180deg, rgba(19,56,84,0.88), rgba(5,18,31,0.98))",
                borderTopLeftRadius: "50% 18%",
                borderTopRightRadius: "50% 18%",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 208,
                width: 154,
                height: 244,
                transform: "translateX(-50%)",
                filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.38))",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 28,
                  right: 28,
                  top: 0,
                  bottom: 60,
                  background: "linear-gradient(180deg, #0b2031, #091724)",
                  clipPath: "polygon(50% 0%, 94% 26%, 84% 92%, 16% 92%, 6% 26%)",
                  border: "1px solid rgba(135,231,255,0.16)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 66,
                  top: 16,
                  width: 20,
                  height: 104,
                  background: "linear-gradient(180deg, #16384f, #0a1d2d)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 44,
                  top: 30,
                  width: 66,
                  height: 8,
                  background: "rgba(188,239,255,0.7)",
                  borderRadius: 999,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  right: 18,
                  bottom: 0,
                  height: 80,
                  borderRadius: "50% 50% 16px 16px",
                  background: "linear-gradient(180deg, #10283c, #06111c)",
                  border: "1px solid rgba(135,231,255,0.12)",
                }}
              />
            </div>

            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 18,
                borderRadius: 22,
                border: "1px solid rgba(94,224,255,0.16)",
                background: "linear-gradient(180deg, rgba(7,31,50,0.98), rgba(5,20,32,0.98))",
                padding: 18,
                boxShadow: "0 18px 34px rgba(0,0,0,0.28)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: socketConnected ? "#86efac" : "#facc15",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: socketConnected ? "#22c55e" : "transparent",
                      border: socketConnected ? "none" : "2px solid #facc15",
                      borderTopColor: socketConnected ? "#22c55e" : "transparent",
                      display: "inline-block",
                      animation: socketConnected ? "none" : "homeSpinner 0.8s linear infinite",
                    }}
                  />
                  {socketConnected ? "Connected" : "Connecting"}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {[0, 1, 2].map((index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        initialsInputRefs.current[index] = element;
                      }}
                      value={playerName[index] || ""}
                      onChange={(e) => {
                        const nextChar = e.target.value
                          .replace(/[^a-z0-9]/gi, "")
                          .slice(-1)
                          .toUpperCase();
                        const chars = playerName.padEnd(3, " ").slice(0, 3).split("");
                        chars[index] = nextChar;
                        setPlayerName(chars.join("").replace(/\s/g, ""));
                        if (nextChar && index < 2) {
                          initialsInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !playerName[index] && index > 0) {
                          initialsInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      maxLength={1}
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 16,
                        border: playerName[index]
                          ? "1px solid rgba(113, 255, 167, 0.5)"
                          : "1px solid rgba(94,224,255,0.26)",
                        background: playerName[index]
                          ? "linear-gradient(180deg, rgba(20,70,39,1), rgba(8,41,24,1))"
                          : "rgba(4, 18, 31, 0.92)",
                        color: playerName[index] ? "#dfffe6" : "#dbeafe",
                        fontSize: 28,
                        fontWeight: 900,
                        textAlign: "center",
                        boxSizing: "border-box",
                        outline: "none",
                        textTransform: "uppercase",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  ["Mode", "Fleet skirmish"],
                  ["Boards", "10 x 10"],
                  ["Players", "2 to 6"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      borderRadius: 14,
                      padding: "10px 12px",
                      background: "rgba(5, 18, 31, 0.72)",
                      border: "1px solid rgba(94,224,255,0.12)",
                    }}
                  >
                    <div style={{ color: "#76dfff", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      {label}
                    </div>
                    <div style={{ marginTop: 6, color: "#f4fbff", fontSize: 13, fontWeight: 800 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, color: "#66defe", fontSize: 14, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Room Code
              </div>

              <input
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ROOM CODE"
                maxLength={4}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: "18px 20px",
                  borderRadius: 18,
                  border: "1px solid rgba(94,224,255,0.18)",
                  background: "rgba(3, 14, 24, 0.92)",
                  color: "#eefaff",
                  fontSize: 18,
                  boxSizing: "border-box",
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, position: "relative", zIndex: 2, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                onClick={handleCreateRoom}
                style={{
                  border: "1px solid rgba(94,224,255,0.14)",
                  borderRadius: 18,
                  padding: "18px 14px",
                  background: "linear-gradient(180deg, rgba(7,31,50,0.98), rgba(5,20,32,0.98))",
                  color: "#eefaff",
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Create Match
              </button>
              <button
                onClick={handleJoinRoom}
                style={{
                  border: "1px solid rgba(94,224,255,0.14)",
                  borderRadius: 18,
                  padding: "18px 14px",
                  background: "linear-gradient(180deg, rgba(7,31,50,0.98), rgba(5,20,32,0.98))",
                  color: "#eefaff",
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Join Match
              </button>
            </div>
          </div>
        </div>

        {(error || info) && (
          <div
            style={{
              margin: "0 16px 16px",
              borderRadius: 18,
              padding: 16,
              border: `1px solid ${error ? "rgba(255,149,149,0.34)" : "rgba(104,226,255,0.22)"}`,
              background: error ? "rgba(90,20,20,0.34)" : "rgba(7,36,56,0.65)",
              color: error ? "#ffc0c0" : "#9cefff",
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
    const placementGap = 2;

    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at 50% 70%, rgba(67,197,255,0.16), transparent 18%), linear-gradient(180deg, #03101d 0%, #06192a 38%, #07243b 68%, #020b15 100%)",
          padding: isMobile ? 12 : 20,
          boxSizing: "border-box",
          color: "#e9f8ff",
          fontFamily: "'Segoe UI', 'Trebuchet MS', Arial, sans-serif",
        }}
      >
        <style>
          {`
            .rotate-action-icon {
              animation: rotatePress 0.36s ease-out;
            }

            @keyframes rotatePress {
              0% { transform: rotate(0deg) scale(1); }
              60% { transform: rotate(-95deg) scale(1.18); }
              100% { transform: rotate(-90deg) scale(1); }
            }
          `}
        </style>
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
              <div style={{ color: "#5fe0ff", fontSize: 12, letterSpacing: "0.22em", fontWeight: 800, textTransform: "uppercase" }}>
                Fleet Deployment
              </div>
              <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: "#f4fbff", marginTop: 8 }}>
                Placement
              </div>
              <div style={{ marginTop: 6, color: "#83b0c8", textAlign: isMobile ? "center" : "left" }}>
                Room code
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: "clamp(28px, 9vw, 46px)",
                  fontWeight: 900,
                  letterSpacing: "clamp(2px, 0.8vw, 5px)",
                  color: "#67e3ff",
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
                background: "linear-gradient(180deg, rgba(8,37,60,0.94), rgba(4,17,29,0.94))",
                color: "#eefbff",
                border: "1px solid rgba(96,227,255,0.18)",
                borderRadius: 14,
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 900, color: "#f4fbff" }}>
                  Fleet
                </div>
                <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: "#68e2ff" }}>
                  {currentShipLength
                    ? `Ship ${placedShips.length + 1} of ${SHIP_LENGTHS.length} - length ${currentShipLength}`
                    : "Fleet complete"}
                </div>
              </div>

              <div style={{ marginTop: 8, color: "#83b0c8", lineHeight: 1.55, fontSize: isMobile ? 13 : 15 }}>
                {currentShipLength
                  ? `Place ship of length ${currentShipLength}.`
                  : "All ships placed. Ready to battle."}
              </div>

              <FleetCounter
                shipLengths={SHIP_LENGTHS}
                placedCount={placedShips.length}
                currentIndex={placedShips.length}
              />

              <div
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  ["Orientation", orientation === "horizontal" ? "Horizontal" : "Vertical"],
                  ["Placed", `${placedShips.length}/${SHIP_LENGTHS.length}`],
                  ["Status", placementComplete ? "Ready to deploy" : "Awaiting placement"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      borderRadius: 16,
                      padding: "12px 14px",
                      background: "rgba(5, 19, 31, 0.7)",
                      border: "1px solid rgba(95,224,255,0.12)",
                    }}
                  >
                    <div style={{ color: "#6edfff", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      {label}
                    </div>
                    <div style={{ marginTop: 6, color: "#f4fbff", fontSize: 14, fontWeight: 800 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PlacementActionButton
                  onClick={handleRotateShip}
                  icon="🔄"
                  label="Rotate"
                  background="linear-gradient(180deg, rgba(10,54,81,1), rgba(6,25,42,1))"
                  animationKey={rotateAnimationKey}
                />

                <PlacementActionButton
                  onClick={handleUndoShip}
                  icon="↩"
                  label="Undo"
                  background="linear-gradient(180deg, rgba(52,77,95,1), rgba(20,35,49,1))"
                />

                <PlacementActionButton
                  onClick={handleResetPlacement}
                  icon="🧹"
                  label="Reset"
                  background="linear-gradient(180deg, rgba(40,50,61,1), rgba(17,24,39,1))"
                />

                <button
                  onClick={handleSubmitShips}
                  disabled={!placementComplete}
                  style={{
                    background: placementComplete
                      ? "linear-gradient(180deg, rgba(255,135,61,1), rgba(142,61,17,1))"
                      : "linear-gradient(180deg, rgba(83,95,107,1), rgba(46,55,64,1))",
                    color: "#ffffff",
                    border: "1px solid rgba(255,198,158,0.18)",
                    borderRadius: 16,
                    padding: "12px 16px",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    cursor: placementComplete ? "pointer" : "default",
                    boxShadow: placementComplete
                      ? "0 0 0 1px rgba(255,164,104,0.24), 0 16px 26px rgba(0,0,0,0.28)"
                      : "none",
                    transform: placementComplete ? "translateY(-1px)" : "none",
                  }}
                >
                  READY
                </button>
              </div>

              {(error || info) && (
                <div
                  style={{
                    marginTop: 18,
                    borderRadius: 16,
                    padding: 14,
                    border: `1px solid ${error ? "rgba(255,149,149,0.34)" : "rgba(104,226,255,0.22)"}`,
                    background: error ? "rgba(90,20,20,0.34)" : "rgba(7,36,56,0.65)",
                    color: error ? "#ffc0c0" : "#9cefff",
                    fontWeight: 700,
                  }}
                >
                  {error || info}
                </div>
              )}
            </div>

            <div style={cardStyle()}>
              <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 900, color: "#f4fbff" }}>
                Board
              </div>
              <div style={{ marginTop: 8, color: "#83b0c8", fontSize: isMobile ? 12 : 14 }}>
                {isMobile
                  ? "Tap to preview, tap again to place. Ships cannot overlap."
                  : "Hover to preview. Ships cannot overlap."}
              </div>

              <div style={{ marginTop: 16, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `18px repeat(${BOARD_SIZE}, ${placementCellSize}px)`,
                    gap: placementGap,
                    width: "max-content",
                    margin: "0 auto",
                    position: "relative",
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 18,
                      top: 18,
                      right: 0,
                      bottom: 0,
                      borderRadius: 12,
                      border: "1px solid rgba(94,224,255,0.08)",
                      boxShadow: "0 0 0 12px rgba(94,224,255,0.015)",
                      pointerEvents: "none",
                    }}
                  />
                  <ShipSilhouettes
                    ships={placedShips}
                    cellSize={placementCellSize}
                    gap={placementGap}
                  />
                  <div />
                  {Array.from({ length: BOARD_SIZE }).map((_, x) => (
                    <div
                      key={`placement-col-${x}`}
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
                  {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => {
                    const x = index % BOARD_SIZE;
                    const y = Math.floor(index / BOARD_SIZE);
                    const cellKey = keyOf(x, y);
                    const occupied = placedCellSet.has(keyOf(x, y));
                    const previewed = placementPreview.cells.has(cellKey);
                    const invalidPreview = previewed && !placementPreview.valid;
                    const validPreview = previewed && placementPreview.valid;

                    let background = "rgba(6, 28, 47, 0.88)";
                    let border = "1px solid rgba(76, 166, 206, 0.5)";

                    if (occupied) {
                      background = "transparent";
                      border = "1px solid transparent";
                    }

                    if (validPreview) {
                      background = "rgba(12, 81, 111, 0.95)";
                      border = "1px solid rgba(94, 224, 255, 0.78)";
                    }

                    if (invalidPreview) {
                      background = "rgba(108, 32, 22, 0.9)";
                      border = "1px solid rgba(255, 133, 116, 0.86)";
                    }

                    return (
                      <React.Fragment key={`${x}-${y}`}>
                        {x === 0 && (
                          <div
                            style={{
                              width: 18,
                              height: placementCellSize,
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
                        onClick={() => handlePlacementCellPress(x, y, isMobile)}
                        onMouseEnter={() => {
                          if (!isMobile) setPlacementHoverCell({ x, y });
                        }}
                        onMouseLeave={() => {
                          if (!isMobile) setPlacementHoverCell(null);
                        }}
                        onFocus={() => setPlacementHoverCell({ x, y })}
                        onBlur={() => {
                          if (!isMobile) setPlacementHoverCell(null);
                        }}
                        style={{
                          width: placementCellSize,
                          height: placementCellSize,
                          border,
                          borderRadius: 6,
                          background,
                          cursor: currentShipLength ? "pointer" : "default",
                          padding: 0,
                          boxSizing: "border-box",
                          position: "relative",
                          zIndex: 1,
                          boxShadow: validPreview
                            ? "0 0 0 1px rgba(94,224,255,0.12), inset 0 0 12px rgba(94,224,255,0.08)"
                            : invalidPreview
                              ? "0 0 12px rgba(255,120,80,0.08)"
                              : "none",
                        }}
                      />
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
  };

  if (!activeRoomCode && !roomView) {
    return renderHome();
  }

  if (!roomView) {
    return withConnectionNotice(
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at 50% 70%, rgba(67,197,255,0.16), transparent 18%), linear-gradient(180deg, #03101d 0%, #06192a 38%, #07243b 68%, #020b15 100%)",
          display: "grid",
          placeItems: "center",
          fontFamily: "'Segoe UI', 'Trebuchet MS', Arial, sans-serif",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div style={cardStyle()}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#f4fbff" }}>
            Entering room...
          </div>
        </div>
      </div>
    );
  }

  if (roomView.status === "battle" || roomView.status === "finished") {
    return withConnectionNotice(
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

  if (roomView.status === "lobby") {
    return withConnectionNotice(
      <WaitingRoomScreen
        roomView={roomView}
        onBack={handleBack}
        onStartPlacement={handleStartPlacement}
        error={error}
        info={info}
      />
    );
  }

  if (roomView.status === "placement" && roomView?.you?.ready) {
    return withConnectionNotice(
      <WaitingRoomScreen
        roomView={roomView}
        onBack={handleBack}
        onStartPlacement={handleStartPlacement}
        error={error}
        info={info}
      />
    );
  }

  return withConnectionNotice(renderPlacement());
}
