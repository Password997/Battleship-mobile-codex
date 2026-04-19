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
              background: "linear-gradient(135deg, #bfdbfe 0%, #60a5fa 58%, #2563eb 100%)",
              border: "2px solid #1d4ed8",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.28), 0 4px 10px rgba(37,99,235,0.18)",
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
                background: "rgba(255,255,255,0.44)",
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
        color: "#ffffff",
        border: "none",
        borderRadius: 12,
        padding: "9px 13px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
      }}
    >
      <span
        key={animationKey}
        className={animationKey ? "rotate-action-icon" : ""}
        style={{ fontSize: 21, lineHeight: 1, display: "inline-block" }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
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
        const color = isPlaced ? "#16a34a" : isCurrent ? "#2563eb" : "#cbd5e1";

        return (
          <div
            key={`${length}-${index}`}
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 5,
              color: isPlaced ? "#166534" : isCurrent ? "#1d4ed8" : "#64748b",
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
        background: "#000000",
        display: "grid",
        placeItems: "center",
        padding: 14,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <style>
        {`
          @keyframes homeSpinner {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
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
              fontSize: 28,
              fontWeight: 900,
              color: "#60a5fa",
              whiteSpace: "nowrap",
            }}
          >
            Battleship Multiplayer
          </div>

          <div
            style={{
              marginTop: 10,
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

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 800 }}>
                Type your initials
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
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
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      border: playerName[index] ? "1px solid #22c55e" : "1px solid #2563eb",
                      background: playerName[index] ? "#052e16" : "#050505",
                      color: playerName[index] ? "#bbf7d0" : "#dbeafe",
                      fontSize: 24,
                      fontWeight: 900,
                      textAlign: "center",
                      boxSizing: "border-box",
                      outline: "none",
                      textTransform: "uppercase",
                      boxShadow: playerName[index]
                        ? "0 0 0 3px rgba(34,197,94,0.18)"
                        : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            <input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="Room code"
              maxLength={4}
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
    const placementGap = 2;

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
              <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: "#111827" }}>
                Placement
              </div>
              <div style={{ marginTop: 6, color: "#6b7280", textAlign: isMobile ? "center" : "left" }}>
                Room code
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: "clamp(28px, 9vw, 46px)",
                  fontWeight: 900,
                  letterSpacing: "clamp(2px, 0.8vw, 5px)",
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 900, color: "#111827" }}>
                  Fleet
                </div>
                <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: "#1d4ed8" }}>
                  {currentShipLength
                    ? `Ship ${placedShips.length + 1} of ${SHIP_LENGTHS.length} - length ${currentShipLength}`
                    : "Fleet complete"}
                </div>
              </div>

              <div style={{ marginTop: 8, color: "#6b7280", lineHeight: 1.55, fontSize: isMobile ? 13 : 15 }}>
                {currentShipLength
                  ? `Place ship of length ${currentShipLength}.`
                  : "All ships placed. Ready to battle."}
              </div>

              <FleetCounter
                shipLengths={SHIP_LENGTHS}
                placedCount={placedShips.length}
                currentIndex={placedShips.length}
              />

              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PlacementActionButton
                  onClick={handleRotateShip}
                  icon="🔄"
                  label="Rotate"
                  animationKey={rotateAnimationKey}
                />

                <PlacementActionButton
                  onClick={handleUndoShip}
                  icon="↩"
                  label="Undo"
                  background="#6b7280"
                />

                <PlacementActionButton
                  onClick={handleResetPlacement}
                  icon="🧹"
                  label="Reset"
                  background="#111827"
                />

                <button
                  onClick={handleSubmitShips}
                  disabled={!placementComplete}
                  style={{
                    background: placementComplete ? "#15803d" : "#9ca3af",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor: placementComplete ? "pointer" : "default",
                    boxShadow: placementComplete
                      ? "0 0 0 3px rgba(34,197,94,0.22), 0 10px 18px rgba(21,128,61,0.25)"
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
                        color: "#64748b",
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

                    let background = "#ffffff";
                    let border = "1px solid #cbd5e1";

                    if (occupied) {
                      background = "transparent";
                      border = "1px solid transparent";
                    }

                    if (validPreview) {
                      background = "#bfdbfe";
                      border = "2px solid #2563eb";
                    }

                    if (invalidPreview) {
                      background = "#fee2e2";
                      border = "2px solid #dc2626";
                    }

                    return (
                      <React.Fragment key={`${x}-${y}`}>
                        {x === 0 && (
                          <div
                            style={{
                              width: 18,
                              height: placementCellSize,
                              color: "#64748b",
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
