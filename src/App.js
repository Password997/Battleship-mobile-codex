import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import WaitingRoomScreen from "./components/WaitingRoomScreen";
import BattleScreen from "./components/BattleScreen";

const BOARD_SIZE = 10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2];
const CLIENT_ID_STORAGE_KEY = "battleshipClientId";
const FLEET_SPRITE_URL = "/assets/fleet3.png";
const FLEET4_SPRITE_URL = "/assets/fleet4.png";
const PLACEMENT_BOARD_ART_URL = "/assets/pllacement board.png";
const FLEET_SPRITE_SOURCE_WIDTH = 1024;
const FLEET_SPRITE_SOURCE_HEIGHT = 1536;
const FLEET_ART_SPECS = [
  { length: 5, x: 48, y: 105, width: 891, height: 165 },
  { length: 4, x: 132, y: 412, width: 687, height: 121 },
  { length: 3, x: 80, y: 665, width: 483, height: 115 },
  { length: 3, x: 80, y: 665, width: 483, height: 115 },
  { length: 2, x: 670, y: 680, width: 287, height: 85 },
];
const FLEET_COUNTER_ART_SPECS = [
  { length: 5, x: 40, y: 32, width: 930, height: 255, sourceUrl: FLEET4_SPRITE_URL },
  ...FLEET_ART_SPECS.slice(1),
];

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

function getShipArtFrame(bounds, shipLength, cellSize) {
  const axisPadding = shipLength === 5 ? cellSize * 0.42 : cellSize * 0.16;
  const crossPadding = cellSize * 0.22;
  const orientationOffsets = {
    horizontal: {
      5: { x: 0, y: -2 },
      4: { x: 0, y: -1 },
      3: { x: 0, y: -1 },
      2: { x: 0, y: 0 },
    },
    vertical: {
      5: { x: 0, y: 0 },
      4: { x: 0, y: 0 },
      3: { x: 0, y: 0 },
      2: { x: 0, y: 0 },
    },
  };

  const artWidth = bounds.horizontal
    ? Math.max(bounds.width + axisPadding, cellSize * 1.45)
    : Math.max(bounds.width + crossPadding, cellSize * 1.2);
  const artHeight = bounds.horizontal
    ? Math.max(bounds.height + crossPadding, cellSize * 1.2)
    : Math.max(bounds.height + axisPadding, cellSize * 1.45);
  const offset =
    orientationOffsets[bounds.horizontal ? "horizontal" : "vertical"][shipLength] || { x: 0, y: 0 };

  return {
    width: artWidth,
    height: artHeight,
    left: bounds.left + (bounds.width - artWidth) / 2 + offset.x,
    top: bounds.top + (bounds.height - artHeight) / 2 + offset.y,
  };
}

function FleetSprite({
  spec,
  width,
  height,
  rotate = false,
  fitRotated = false,
  dimmed = false,
  active = false,
}) {
  if (!spec) return null;

  const sourceUrl = spec.sourceUrl || FLEET_SPRITE_URL;
  const sourceWidth = spec.sourceWidth || FLEET_SPRITE_SOURCE_WIDTH;
  const sourceHeight = spec.sourceHeight || FLEET_SPRITE_SOURCE_HEIGHT;
  const scale = rotate && fitRotated
    ? Math.min(width / spec.height, height / spec.width)
    : Math.min(width / spec.width, height / spec.height);
  const renderWidth = spec.width * scale;
  const renderHeight = spec.height * scale;
  const frameWidth = rotate ? width : renderWidth;
  const frameHeight = rotate ? height : renderHeight;

  return (
    <div
      aria-hidden="true"
      style={{
        width: frameWidth,
        height: frameHeight,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: renderWidth,
          height: renderHeight,
          backgroundImage: `url(${sourceUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${sourceWidth * scale}px ${sourceHeight * scale}px`,
          backgroundPosition: `${-spec.x * scale}px ${-spec.y * scale}px`,
          transform: rotate
            ? "translate(-50%, -50%) rotate(90deg)"
            : "translate(-50%, -50%)",
          transformOrigin: "center center",
          filter: `${dimmed ? "saturate(0.45) brightness(0.6)" : "drop-shadow(0 8px 18px rgba(0,0,0,0.28))"} ${active ? "drop-shadow(0 0 18px rgba(95,224,255,0.28))" : ""}`.trim(),
          opacity: dimmed ? 0.5 : 1,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function ShipSilhouettes({ ships, cellSize, gap, shipSpecs = FLEET_ART_SPECS }) {
  return (
    <>
      {(ships || []).map((ship, index) => {
        const bounds = getShipBounds(ship, cellSize, gap);
        const spec = shipSpecs.find((item) => item.length === ship.length);
        const frame = getShipArtFrame(bounds, ship.length, cellSize);

        return (
          <div
            key={`placed-ship-shape-${index}`}
            className="ship-bob"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <FleetSprite
              spec={spec}
              width={frame.width}
              height={frame.height}
              rotate={!bounds.horizontal}
              fitRotated={!bounds.horizontal}
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
    background: `linear-gradient(180deg, rgba(8,31,51,0.95), rgba(4,18,31,0.94)), url(${PLACEMENT_BOARD_ART_URL})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
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
        justifyContent: "center",
        gap: 7,
        width: "100%",
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
  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;

  return (
    <div
      style={{
        marginTop: 12,
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(5, minmax(0, 1fr))",
        gap: 8,
        alignItems: "stretch",
      }}
    >
      {shipLengths.map((length, index) => {
        const isPlaced = index < placedCount;
        const isCurrent = index === currentIndex;
        const status = isPlaced ? "SET" : isCurrent ? "NEXT" : "WAIT";

        return (
          <div
            key={`${length}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "auto 1fr auto" : "1fr",
              alignItems: "center",
              gap: 8,
              padding: isMobile ? "9px 10px" : "10px 9px",
              borderRadius: 12,
              background: isCurrent
                ? "linear-gradient(180deg, rgba(10,55,76,0.96), rgba(6,24,38,0.92))"
                : "rgba(5,18,31,0.68)",
              border: isCurrent
                ? "1px solid rgba(95,224,255,0.42)"
                : isPlaced
                  ? "1px solid rgba(255,176,111,0.28)"
                  : "1px solid rgba(95,224,255,0.1)",
              color: isPlaced ? "#ffd0b0" : isCurrent ? "#a5f0ff" : "#6f97ab",
              fontWeight: isCurrent ? 900 : 700,
              minHeight: isMobile ? 0 : 82,
              boxShadow: isCurrent
                ? "0 0 0 1px rgba(95,224,255,0.08), 0 10px 18px rgba(0,0,0,0.18)"
                : "none",
            }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                justifySelf: isMobile ? "auto" : "center",
                borderRadius: 10,
                background: isPlaced
                  ? "rgba(255,176,111,0.16)"
                  : isCurrent
                    ? "rgba(95,224,255,0.18)"
                    : "rgba(95,224,255,0.06)",
                color: isPlaced ? "#ffd0b0" : isCurrent ? "#eaffff" : "#87a9b8",
                fontSize: 16,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {length}
            </div>
            <div
              style={{
                display: "grid",
                gap: 5,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(95,224,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, length * 18)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: isPlaced
                      ? "linear-gradient(90deg, #ffb06f, #ffe0bd)"
                      : isCurrent
                        ? "linear-gradient(90deg, #5fe0ff, #b8f6ff)"
                        : "rgba(116,150,166,0.5)",
                  }}
                />
              </div>
              <div
                style={{
                  display: isMobile ? "block" : "none",
                  color: "#83b0c8",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                }}
              >
                Length {length}
              </div>
            </div>
            <span
              style={{
                justifySelf: isMobile ? "end" : "center",
                fontSize: 10,
                lineHeight: 1,
                letterSpacing: "0.12em",
                color: isPlaced ? "#ffd0b0" : isCurrent ? "#8ff0ff" : "#6f97ab",
              }}
            >
              {status}
            </span>
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
  const [rulesOpen, setRulesOpen] = useState(false);

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

  useEffect(() => {
    if (activeRoomCode || roomView) return;

    const timer = setTimeout(() => {
      initialsInputRefs.current[0]?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [activeRoomCode, roomView]);

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

  const addNotification = useCallback((text, options = {}) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [
      ...prev,
      { id, text, durationMs: options.durationMs ?? 3200 },
    ]);
  }, []);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const flashAttackCells = useCallback((cells, type = "hit") => {
    if (!cells?.length) return;
    setFlashCells((prev) => ({
      ...prev,
      attack: {
        ...prev.attack,
        ...cells.reduce((acc, cell) => {
          acc[keyOf(cell.x, cell.y)] = type;
          return acc;
        }, {}),
      },
    }));

    const durationMs = type === "sunk" ? 1000 : 320;

    setTimeout(() => {
      setFlashCells((prev) => {
        const next = { ...prev.attack };
        for (const cell of cells) {
          delete next[keyOf(cell.x, cell.y)];
        }
        return { ...prev, attack: next };
      });
    }, durationMs);
  }, []);

  const flashAttackCell = useCallback((x, y, type) => {
    flashAttackCells([{ x, y }], type);
  }, [flashAttackCells]);

  const flashDefenseCells = useCallback((cells, type = "hit") => {
    if (!cells?.length) return;
    setFlashCells((prev) => {
      const nextDefense = { ...prev.defense };
      for (const cell of cells) {
        nextDefense[keyOf(cell.x, cell.y)] = type;
      }
      return { ...prev, defense: nextDefense };
    });

    const durationMs = type === "sunk" ? 1000 : 350;

    setTimeout(() => {
      setFlashCells((prev) => {
        const nextDefense = { ...prev.defense };
        for (const cell of cells) {
          delete nextDefense[keyOf(cell.x, cell.y)];
        }
        return { ...prev, defense: nextDefense };
      });
    }, durationMs);
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

      if (previous?.you?.sunkShipIndexes && payload?.you?.sunkShipIndexes && payload?.you?.ships) {
        const prevSunk = new Set(previous.you.sunkShipIndexes);
        const newSunkIndexes = payload.you.sunkShipIndexes.filter((index) => !prevSunk.has(index));
        const newSunkCells = newSunkIndexes.flatMap((index) => payload.you.ships[index] || []);
        if (newSunkCells.length) {
          flashDefenseCells(newSunkCells, "sunk");
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
      const notificationDurationMs = payload?.type === "sunk" ? 750 : 3200;
      items.forEach((item) => {
        if (item?.text) {
          addNotification(item.text, { durationMs: notificationDurationMs });
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
            if (response.sunkShips?.length) {
              flashAttackCells(
                response.sunkShips.flatMap((ship) => ship.cells || []),
                "sunk"
              );
            } else {
              flashAttackCell(x, y, "hit");
            }
          } else {
            setInfo("Miss");
            playEffect("miss");
            vibrate(25);
            if (response.sunkMissShips?.length) {
              flashAttackCells(
                response.sunkMissShips.flatMap((ship) => ship.cells || []),
                "sunk"
              );
            } else {
              flashAttackCell(x, y, "miss");
            }
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

  const renderRulesSheet = () => {
    if (!rulesOpen) return null;

    const rows = [
      ["Goal", "Sink all enemy fleets and be the last player standing."],
      ["Setup", "Place 5 ships: 5, 4, 3, 3 and 2 cells. Ships cannot overlap."],
      ["Turns", "Fire at the Enemy Board. Miss ends your turn. Hit lets you fire again."],
      ["Intel", "Amber diamond means a ship was revealed there, but you have not fired that cell yet."],
      ["Win", "A player is out when all ships are sunk. Last fleet alive wins."],
    ];
    const icons = [
      ["💧", "Miss"],
      ["🔥", "Hit"],
      ["💥", "Sunk"],
      ["◆", "Intel"],
    ];

    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 120,
          background: "rgba(1, 8, 14, 0.72)",
          display: "grid",
          placeItems: "end center",
          padding: 14,
          boxSizing: "border-box",
        }}
        onClick={() => setRulesOpen(false)}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(100%, 520px)",
            maxHeight: "84vh",
            overflowY: "auto",
            borderRadius: 24,
            border: "1px solid rgba(95,224,255,0.22)",
            background: "linear-gradient(180deg, rgba(7,31,51,0.98), rgba(3,13,24,0.98))",
            boxShadow: "0 24px 70px rgba(0,0,0,0.42)",
            padding: 18,
            color: "#e9f8ff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ color: "#63e6ff", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Quick Kit
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900 }}>
                Rules
              </div>
            </div>
            <button
              onClick={() => setRulesOpen(false)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "1px solid rgba(95,224,255,0.18)",
                background: "rgba(5,18,31,0.72)",
                color: "#eefbff",
                fontSize: 20,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 9 }}>
            {rows.map(([title, text]) => (
              <div
                key={title}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(95,224,255,0.12)",
                  background: "rgba(4,18,31,0.62)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ color: "#8eeeff", fontSize: 12, fontWeight: 900 }}>{title}</div>
                <div style={{ marginTop: 4, color: "#cfefff", fontSize: 13, lineHeight: 1.35 }}>{text}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {icons.map(([icon, meaning]) => (
              <div
                key={meaning}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(95,224,255,0.12)",
                  background: "rgba(4,18,31,0.62)",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <span style={{ color: meaning === "Intel" ? "#ffd99b" : "#ffffff", fontSize: 18 }}>{icon}</span>
                <span>{meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHomeV2 = () => {
    const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
    const homeBackground = "/assets/31dabfeb-75ee-484d-96c9-32b44770dccb.png";

    return (
      <div
        className="screen-shell"
        style={{
          minHeight: "100vh",
          background: "#020913",
          fontFamily: "'Segoe UI', 'Trebuchet MS', Arial, sans-serif",
          color: "#eefaff",
        }}
      >
        <style>
          {`
            @keyframes homeSpinnerV2 {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>

        <div
          style={{
            minHeight: "100vh",
            maxWidth: 540,
            margin: "0 auto",
            position: "relative",
            overflow: "hidden",
            backgroundImage: `linear-gradient(180deg, rgba(1,8,14,0.2) 0%, rgba(1,8,14,0.16) 18%, rgba(1,8,14,0.38) 42%, rgba(1,8,14,0.74) 66%, rgba(1,8,14,0.96) 100%), url(${homeBackground})`,
            backgroundSize: isMobile ? "94%" : "74%",
            backgroundPosition: isMobile ? "center 20px" : "center -48px",
            backgroundRepeat: "no-repeat",
          boxShadow: "0 0 0 1px rgba(87,216,255,0.08), 0 28px 80px rgba(0,0,0,0.45)",
        }}
      >
          <div className="command-beacon" aria-hidden="true" />
          <div className="tactical-sweep" aria-hidden="true" />
          <div className="ocean-haze" aria-hidden="true" />
          <div className="ambient-particles" aria-hidden="true" />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(1,8,14,0.04) 0%, rgba(1,8,14,0.08) 44%, rgba(1,8,14,0.22) 58%, rgba(1,8,14,0.7) 72%, rgba(1,8,14,0.96) 84%, rgba(1,8,14,1) 100%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: isMobile ? "46%" : "40%",
              background:
                "linear-gradient(180deg, rgba(2,9,19,0) 0%, rgba(2,9,19,0.16) 12%, rgba(2,9,19,0.56) 30%, rgba(2,9,19,0.9) 54%, rgba(2,9,19,0.98) 74%, rgba(2,9,19,1) 100%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(rgba(74, 207, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 207, 255, 0.035) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              opacity: 0.28,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: isMobile ? "14px 14px 16px" : "24px 20px 24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 999,
                  background: "rgba(4, 21, 35, 0.62)",
                  border: "1px solid rgba(103,226,255,0.18)",
                  backdropFilter: "blur(8px)",
                  color: socketConnected ? "#99f6b5" : "#ffd47a",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: socketConnected ? "#22c55e" : "transparent",
                    border: socketConnected ? "none" : "2px solid #facc15",
                    borderTopColor: socketConnected ? "#22c55e" : "transparent",
                    display: "inline-block",
                    animation: socketConnected ? "none" : "homeSpinnerV2 0.8s linear infinite",
                  }}
                />
                {socketConnected ? "Online" : "Connecting"}
              </div>

              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 999,
                  background: "rgba(4, 21, 35, 0.62)",
                  border: "1px solid rgba(103,226,255,0.18)",
                  backdropFilter: "blur(8px)",
                  color: "#b7f4ff",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Local Preview
              </div>
            </div>

            <div style={{ flex: isMobile ? 0.72 : 1 }} />

            <div
              style={{
                display: "grid",
                gap: isMobile ? 10 : 12,
                marginTop: isMobile ? -20 : 24,
                transform: isMobile ? "translateY(-74px)" : "none",
              }}
            >
              <div
                style={{
                  padding: isMobile ? 14 : 18,
                  borderRadius: 24,
                  background: "linear-gradient(180deg, rgba(4,18,31,0.12), rgba(3,13,24,0.18))",
                  border: "1px solid rgba(94,224,255,0.1)",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.24)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    textAlign: "center",
                    color: "#9fefff",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    Initials
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(190,241,255,0.72)",
                      textTransform: "uppercase",
                    }}
                  >
                    3 letters
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "center",
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
                        width: isMobile ? 58 : 64,
                        height: isMobile ? 58 : 64,
                        borderRadius: 18,
                        border: playerName[index]
                          ? "1px solid rgba(113, 255, 167, 0.42)"
                          : "1px solid rgba(94,224,255,0.22)",
                        background: "transparent",
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

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 118px",
                    gap: 10,
                  }}
                >
                  <input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="ROOM CODE"
                    maxLength={4}
                    style={{
                      width: "100%",
                      padding: "16px 18px",
                      borderRadius: 18,
                      border: "1px solid rgba(94,224,255,0.18)",
                      background: "transparent",
                      color: "#eefaff",
                      fontSize: 18,
                      boxSizing: "border-box",
                      letterSpacing: 6,
                      textTransform: "uppercase",
                      outline: "none",
                      minWidth: 0,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    style={{
                      border: "1px solid rgba(94,224,255,0.18)",
                      borderRadius: 18,
                      padding: "0 12px",
                      background: "linear-gradient(180deg, rgba(8,43,66,0.18), rgba(4,20,34,0.24))",
                      color: "#eefaff",
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
                    }}
                  >
                    Rules
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <button
                    onClick={handleCreateRoom}
                    style={{
                      border: "1px solid rgba(94,224,255,0.18)",
                      borderRadius: 20,
                      padding: isMobile ? "16px 14px" : "18px 14px",
                      background: "linear-gradient(180deg, rgba(8,43,66,0.18), rgba(4,20,34,0.24))",
                      color: "#eefaff",
                      fontSize: 15,
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxShadow: "0 14px 26px rgba(0,0,0,0.24)",
                    }}
                  >
                    Create Room
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    style={{
                      border: "1px solid rgba(94,224,255,0.18)",
                      borderRadius: 20,
                      padding: isMobile ? "16px 14px" : "18px 14px",
                      background: "linear-gradient(180deg, rgba(8,43,66,0.18), rgba(4,20,34,0.24))",
                      color: "#eefaff",
                      fontSize: 15,
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxShadow: "0 14px 26px rgba(0,0,0,0.24)",
                    }}
                  >
                    Join Room
                  </button>
                </div>
              </div>

              {(error || info) && (
                <div
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    border: `1px solid ${error ? "rgba(255,149,149,0.34)" : "rgba(104,226,255,0.22)"}`,
                    background: error ? "rgba(90,20,20,0.5)" : "rgba(7,36,56,0.7)",
                    color: error ? "#ffc0c0" : "#9cefff",
                    fontWeight: 700,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {error || info}
                </div>
              )}
            </div>
          </div>
        </div>
        {renderRulesSheet()}
      </div>
    );
  };

  const renderPlacement = () => {
    const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
    const placementCellSize = isMobile ? 30 : 34;
    const placementGap = 2;

    return (
      <div
        className="screen-shell"
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
        <div className="command-beacon" aria-hidden="true" />
        <div className="tactical-sweep" aria-hidden="true" />
        <div className="ocean-haze" aria-hidden="true" />
        <div className="ambient-particles" aria-hidden="true" />
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
            className="command-card"
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
            <div
              className={isMobile ? "" : "command-card"}
              style={{
                ...(isMobile
                  ? {
                      order: 2,
                      padding: 0,
                      background: "transparent",
                      border: "none",
                      boxShadow: "none",
                    }
                  : { ...cardStyle(), order: 1 }),
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, auto))",
                  gap: 10,
                  alignItems: "stretch",
                }}
              >
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
                    width: "100%",
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

            <div
              className="command-card"
              style={{
                ...cardStyle(),
                order: isMobile ? 1 : 2,
                padding: isMobile ? 10 : 20,
              }}
            >
              {!isMobile && (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#f4fbff" }}>
                    Board
                  </div>
                  <div style={{ marginTop: 8, color: "#83b0c8", fontSize: 14 }}>
                    Hover to preview. Ships cannot overlap.
                  </div>
                </>
              )}

              <div style={{ marginTop: isMobile ? 0 : 16, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <div
                  key={`placement-board-${placedShips.length}`}
                  className={placedShips.length ? "placement-board--snap" : ""}
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
    return renderHomeV2();
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
