const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = 4000;
const BOARD_SIZE = 10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2];
const ROOM_CODE_LENGTH = 5;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, server: "battleship", port: PORT });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
});

const rooms = new Map();

function keyOf(x, y) {
  return `${x},${y}`;
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateUniqueRoomCode() {
  let code = randomRoomCode();
  while (rooms.has(code)) {
    code = randomRoomCode();
  }
  return code;
}

function createPlayer(socketId, name, order) {
  return {
    id: socketId,
    name: String(name || `Player ${order}`).trim(),
    ready: false,
    ships: [],
    hitsTaken: new Set(),
    shotHistory: [],
    revealedSunkShipCells: [],
    defeated: false,
    connected: true,
  };
}

function isInsideBoard(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function validateShipShape(ship, expectedLength) {
  if (!Array.isArray(ship) || ship.length !== expectedLength) return false;

  const xs = ship.map((c) => c.x);
  const ys = ship.map((c) => c.y);

  const sameRow = ys.every((y) => y === ys[0]);
  const sameCol = xs.every((x) => x === xs[0]);

  if (!sameRow && !sameCol) return false;

  if (sameRow) {
    const sorted = [...xs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  }

  const sorted = [...ys].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function normalizeShips(rawShips) {
  if (!Array.isArray(rawShips) || rawShips.length !== SHIP_LENGTHS.length) {
    return { ok: false, error: `You must place exactly ${SHIP_LENGTHS.length} ships.` };
  }

  const normalizedShips = [];
  const usedCells = new Set();

  for (let i = 0; i < SHIP_LENGTHS.length; i += 1) {
    const expectedLength = SHIP_LENGTHS[i];
    const rawShip = rawShips[i];

    if (!Array.isArray(rawShip) || rawShip.length !== expectedLength) {
      return { ok: false, error: `Ship ${i + 1} must have length ${expectedLength}.` };
    }

    const ship = rawShip.map((cell) => ({
      x: Number(cell.x),
      y: Number(cell.y),
    }));

    for (const cell of ship) {
      if (!isInsideBoard(cell.x, cell.y)) {
        return { ok: false, error: "All ship cells must be inside the board." };
      }
    }

    const uniqueWithinShip = new Set(ship.map((c) => keyOf(c.x, c.y)));
    if (uniqueWithinShip.size !== ship.length) {
      return { ok: false, error: "A ship cannot contain duplicate cells." };
    }

    if (!validateShipShape(ship, expectedLength)) {
      return { ok: false, error: `Ship ${i + 1} is invalid.` };
    }

    for (const cell of ship) {
      const cellKey = keyOf(cell.x, cell.y);
      if (usedCells.has(cellKey)) {
        return { ok: false, error: "Ships cannot overlap." };
      }
      usedCells.add(cellKey);
    }

    normalizedShips.push(ship);
  }

  return { ok: true, ships: normalizedShips };
}

function shipIsSunk(player, ship) {
  return ship.every((cell) => player.hitsTaken.has(keyOf(cell.x, cell.y)));
}

function updatePlayerDefeated(player) {
  if (!player.ships.length) {
    player.defeated = false;
    return;
  }

  const allCells = player.ships.flat();
  player.defeated = allCells.every((cell) => player.hitsTaken.has(keyOf(cell.x, cell.y)));
}

function alivePlayers(room) {
  return room.players.filter((p) => !p.defeated);
}

function aliveConnectedPlayers(room) {
  return room.players.filter((p) => !p.defeated && p.connected);
}

function getNextAlivePlayerId(room, fromPlayerId) {
  const players = room.players;
  if (!players.length) return null;

  const preferred = aliveConnectedPlayers(room);
  const fallback = alivePlayers(room);
  const eligible = preferred.length ? preferred : fallback;

  if (!eligible.length) return null;

  const startIndex = players.findIndex((p) => p.id === fromPlayerId);
  if (startIndex === -1) return eligible[0].id;

  for (let step = 1; step <= players.length; step += 1) {
    const idx = (startIndex + step) % players.length;
    const candidate = players[idx];
    if (!candidate.defeated && (preferred.length ? candidate.connected : true)) {
      return candidate.id;
    }
  }

  return eligible[0].id;
}

function maybeFinishGame(room) {
  const alive = alivePlayers(room);
  if (room.status === "battle" && alive.length <= 1) {
    room.status = "finished";
    room.currentTurnPlayerId = null;
    room.winnerId = alive[0]?.id || null;
    room.winnerName = alive[0]?.name || null;
  }
}

function buildPlayerView(room, viewerId) {
  const viewer = room.players.find((p) => p.id === viewerId);
  if (!viewer) return null;

  const currentTurnPlayer = room.players.find((p) => p.id === room.currentTurnPlayerId);

  const sunkShipIndexes = viewer.ships
    .map((ship, index) => (shipIsSunk(viewer, ship) ? index : null))
    .filter((value) => value !== null);

  return {
    roomCode: room.code,
    status: room.status,
    boardSize: BOARD_SIZE,
    shipLengths: SHIP_LENGTHS,
    currentTurnPlayerId: room.currentTurnPlayerId,
    currentTurnName: currentTurnPlayer?.name || null,
    isYourTurn: room.status === "battle" && room.currentTurnPlayerId === viewer.id,
    winnerId: room.winnerId,
    winnerName: room.winnerName,
    you: {
      id: viewer.id,
      name: viewer.name,
      ready: viewer.ready,
      defeated: viewer.defeated,
      ships: viewer.ships,
      hitsTakenKeys: [...viewer.hitsTaken],
      sunkShipIndexes,
      shotHistory: viewer.shotHistory,
      revealedSunkShipCells: viewer.revealedSunkShipCells || [],
    },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      defeated: p.defeated,
      alive: !p.defeated,
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
  };
}

function emitRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  for (const player of room.players) {
    if (player.connected && io.sockets.sockets.has(player.id)) {
      const payload = buildPlayerView(room, player.id);
      if (payload) {
        io.to(player.id).emit("room_state", payload);
      }
    }
  }
}

function reassignHostIfNeeded(room, oldHostId) {
  if (room.hostId !== oldHostId) return;
  room.hostId =
    room.players.find((p) => p.connected && !p.defeated)?.id ||
    room.players.find((p) => p.connected)?.id ||
    room.players.find((p) => !p.defeated)?.id ||
    room.players[0]?.id ||
    null;
}

function removePlayerFromRoom(socketId, hardRemove = true) {
  for (const [roomCode, room] of rooms.entries()) {
    const index = room.players.findIndex((p) => p.id === socketId);
    if (index === -1) continue;

    const player = room.players[index];

    if (hardRemove) {
      room.players.splice(index, 1);
      reassignHostIfNeeded(room, socketId);

      if (!room.players.length) {
        rooms.delete(roomCode);
        return;
      }

      if (room.status === "battle" && room.currentTurnPlayerId === socketId) {
        room.currentTurnPlayerId = getNextAlivePlayerId(room, socketId);
      }

      if (room.status !== "finished") {
        room.players.forEach(updatePlayerDefeated);
      }

      maybeFinishGame(room);
      emitRoomState(roomCode);
      return;
    }

    player.connected = false;
    reassignHostIfNeeded(room, socketId);

    if (room.status === "battle" && room.currentTurnPlayerId === socketId) {
      room.currentTurnPlayerId = getNextAlivePlayerId(room, socketId);
    }

    maybeFinishGame(room);
    emitRoomState(roomCode);
    return;
  }
}

function shipsAtCoordinate(player, x, y) {
  const result = [];
  for (let shipIndex = 0; shipIndex < player.ships.length; shipIndex += 1) {
    const ship = player.ships[shipIndex];
    if (ship.some((cell) => cell.x === x && cell.y === y)) {
      result.push({ shipIndex, ship });
    }
  }
  return result;
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
  socket.emit("server_hello", { socketId: socket.id });

  socket.on("create_room", (payload = {}, ack = () => {}) => {
    try {
      const playerName = String(payload.playerName || "").trim() || "Player 1";
      const roomCode = generateUniqueRoomCode();

      const room = {
        code: roomCode,
        status: "placement",
        hostId: socket.id,
        players: [createPlayer(socket.id, playerName, 1)],
        currentTurnPlayerId: null,
        winnerId: null,
        winnerName: null,
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      emitRoomState(roomCode);
      ack({ ok: true, roomCode, playerId: socket.id });
    } catch (_error) {
      ack({ ok: false, error: "Could not create room." });
    }
  });

  socket.on("join_room", (payload = {}, ack = () => {}) => {
    try {
      const roomCode = String(payload.roomCode || "").trim().toUpperCase();
      const playerName = String(payload.playerName || "").trim() || "Player";

      if (!roomCode || !rooms.has(roomCode)) {
        ack({ ok: false, error: "Room not found." });
        return;
      }

      const room = rooms.get(roomCode);

      if (room.status === "battle" || room.status === "finished") {
        ack({ ok: false, error: "This room is already in battle." });
        return;
      }

      if (room.players.some((p) => p.id === socket.id)) {
        ack({ ok: true, roomCode, playerId: socket.id });
        emitRoomState(roomCode);
        return;
      }

      room.players.push(createPlayer(socket.id, playerName, room.players.length + 1));
      socket.join(roomCode);
      emitRoomState(roomCode);
      ack({ ok: true, roomCode, playerId: socket.id });
    } catch (_error) {
      ack({ ok: false, error: "Could not join room." });
    }
  });

  socket.on("submit_ships", (payload = {}, ack = () => {}) => {
    try {
      const roomCode = String(payload.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        ack({ ok: false, error: "Room not found." });
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) {
        ack({ ok: false, error: "Player not found in room." });
        return;
      }

      const normalized = normalizeShips(payload.ships);
      if (!normalized.ok) {
        ack({ ok: false, error: normalized.error });
        return;
      }

      player.ships = normalized.ships;
      player.ready = true;
      player.hitsTaken = new Set();
      player.shotHistory = [];
      player.revealedSunkShipCells = [];
      player.defeated = false;
      player.connected = true;

      const everyoneReady = room.players.length >= 2 && room.players.every((p) => p.ready);

      if (everyoneReady) {
        room.status = "battle";
        room.currentTurnPlayerId = aliveConnectedPlayers(room)[0]?.id || alivePlayers(room)[0]?.id || null;
        room.winnerId = null;
        room.winnerName = null;
      } else {
        room.status = "placement";
      }

      emitRoomState(roomCode);
      ack({ ok: true });
    } catch (_error) {
      ack({ ok: false, error: "Could not submit ships." });
    }
  });

  socket.on("leave_room", (payload = {}, ack = () => {}) => {
    try {
      const roomCode = String(payload.roomCode || "").trim().toUpperCase();
      if (!roomCode || !rooms.has(roomCode)) {
        ack({ ok: true });
        return;
      }

      removePlayerFromRoom(socket.id, true);
      socket.leave(roomCode);
      ack({ ok: true });
    } catch (_error) {
      ack({ ok: false, error: "Could not leave room." });
    }
  });

  socket.on("fire_shot", (payload = {}, ack = () => {}) => {
    try {
      const roomCode = String(payload.roomCode || "").trim().toUpperCase();
      const x = Number(payload.x);
      const y = Number(payload.y);

      const room = rooms.get(roomCode);
      if (!room) {
        ack({ ok: false, error: "Room not found." });
        return;
      }

      if (room.status !== "battle") {
        ack({ ok: false, error: "Battle has not started." });
        return;
      }

      const shooter = room.players.find((p) => p.id === socket.id);
      if (!shooter) {
        ack({ ok: false, error: "Shooter not found." });
        return;
      }

      if (shooter.defeated) {
        ack({ ok: false, error: "Defeated players cannot shoot." });
        return;
      }

      if (room.currentTurnPlayerId !== socket.id) {
        ack({ ok: false, error: "It is not your turn." });
        return;
      }

      if (!isInsideBoard(x, y)) {
        ack({ ok: false, error: "Invalid shot." });
        return;
      }

      const shotAlreadyUsedByYou = shooter.shotHistory.some((shot) => shot.x === x && shot.y === y);
      if (shotAlreadyUsedByYou) {
        ack({ ok: false, error: "You already fired at that cell." });
        return;
      }

      const hitPlayers = [];
      const sunkShips = [];
      const eliminatedPlayers = [];

      for (const target of room.players) {
        if (target.id === shooter.id || target.defeated) continue;

        const matchingShips = shipsAtCoordinate(target, x, y);
        if (!matchingShips.length) {
          continue;
        }

        let registeredHitForThisTarget = false;

        for (const { shipIndex, ship } of matchingShips) {
          const wasSunkBefore = shipIsSunk(target, ship);

          // Regla final:
          // si existe al menos una nave enemiga en esta coordenada que siga a flote,
          // este disparo cuenta como HIT para el jugador actual.
          if (!wasSunkBefore) {
            registeredHitForThisTarget = true;
          }

          // El daño físico del barco sigue siendo compartido.
          // Repetir la misma celda por otro jugador NO agrega daño nuevo,
          // pero sí debe seguir contando como HIT mientras la nave no esté hundida.
          const cellKey = keyOf(x, y);
          target.hitsTaken.add(cellKey);

          const isSunkNow = shipIsSunk(target, ship);
          if (!wasSunkBefore && isSunkNow) {
            const cells = ship.map((cell) => ({ x: cell.x, y: cell.y }));
            sunkShips.push({
              targetPlayerId: target.id,
              targetPlayerName: target.name,
              shipIndex,
              cells,
            });

            shooter.revealedSunkShipCells.push({
              targetPlayerId: target.id,
              shipIndex,
              cells,
            });
          }
        }

        if (registeredHitForThisTarget) {
          hitPlayers.push({ id: target.id, name: target.name });
        }

        const wasDefeatedBefore = target.defeated;
        updatePlayerDefeated(target);

        if (!wasDefeatedBefore && target.defeated) {
          eliminatedPlayers.push({
            id: target.id,
            name: target.name,
          });
        }
      }

      shooter.shotHistory.push({
        x,
        y,
        hit: hitPlayers.length > 0,
        hitPlayerIds: hitPlayers.map((p) => p.id),
        hitPlayerNames: hitPlayers.map((p) => p.name),
      });

      room.players.forEach(updatePlayerDefeated);
      maybeFinishGame(room);

      if (room.status === "battle") {
        if (hitPlayers.length === 0) {
          room.currentTurnPlayerId = getNextAlivePlayerId(room, shooter.id);
        } else {
          room.currentTurnPlayerId = shooter.id;
        }
      }

      if (sunkShips.length) {
        io.to(shooter.id).emit("battle_popup", {
          type: "sunk",
          items: sunkShips.map((ship) => ({
            text: `You sunk a ship from ${ship.targetPlayerName}`,
          })),
        });
      }

      if (eliminatedPlayers.length) {
        io.to(room.code).emit("battle_popup", {
          type: "eliminated",
          items: eliminatedPlayers.map((player) => ({
            text: `${player.name} has been eliminated`,
          })),
        });
      }

      if (room.status === "finished" && room.winnerName) {
        io.to(room.code).emit("battle_popup", {
          type: "winner",
          items: [{ text: `${room.winnerName} wins!` }],
        });
      }

      emitRoomState(roomCode);

      ack({
        ok: true,
        hit: hitPlayers.length > 0,
        hitPlayers,
        sunkShips,
        eliminatedPlayers,
        winnerName: room.winnerName || null,
      });
    } catch (_error) {
      ack({ ok: false, error: "Could not fire shot." });
    }
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
    removePlayerFromRoom(socket.id, false);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Battleship server listening on http://0.0.0.0:${PORT}`);
});