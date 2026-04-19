const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 4000;
const BOARD_SIZE = 10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const ROOM_CODE_LENGTH = 4;

const rooms = {};

function makeRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";

  do {
    code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += letters[Math.floor(Math.random() * letters.length)];
    }
  } while (rooms[code]);

  return code;
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeShips(ships) {
  if (!Array.isArray(ships)) return null;

  const normalized = ships.map((ship) => {
    const cells = Array.isArray(ship?.cells) ? ship.cells : ship;

    if (!Array.isArray(cells)) return null;

    return cells.map((cell) => {
      if (Array.isArray(cell)) {
        return { x: Number(cell[0]), y: Number(cell[1]) };
      }

      return { x: Number(cell?.x), y: Number(cell?.y) };
    });
  });

  if (normalized.some((ship) => !ship)) return null;
  return normalized;
}

function validateShips(ships) {
  if (!Array.isArray(ships) || ships.length !== SHIP_LENGTHS.length) {
    return "Place all ships first.";
  }

  const occupied = new Set();

  for (let i = 0; i < ships.length; i += 1) {
    const ship = ships[i];
    const expectedLength = SHIP_LENGTHS[i];

    if (!Array.isArray(ship) || ship.length !== expectedLength) {
      return `Ship ${i + 1} must be length ${expectedLength}.`;
    }

    for (const cell of ship) {
      if (
        !Number.isInteger(cell.x) ||
        !Number.isInteger(cell.y) ||
        cell.x < 0 ||
        cell.x >= BOARD_SIZE ||
        cell.y < 0 ||
        cell.y >= BOARD_SIZE
      ) {
        return "Ships must stay inside the board.";
      }

      const key = keyOf(cell.x, cell.y);
      if (occupied.has(key)) {
        return "Ships cannot overlap.";
      }

      occupied.add(key);
    }

    const sameRow = ship.every((cell) => cell.y === ship[0].y);
    const sameColumn = ship.every((cell) => cell.x === ship[0].x);
    if (!sameRow && !sameColumn) {
      return "Ships must be straight.";
    }
  }

  return "";
}

function playerLabel(playerName, order) {
  const initials = String(playerName || "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
    .toUpperCase();

  return initials ? `P${order} ${initials}` : `P${order}`;
}

function createPlayer(socket, clientId, playerName, isHost, order) {
  return {
    id: socket.id,
    clientId,
    name: playerLabel(playerName, order),
    isHost,
    ships: [],
    hitsTakenKeys: [],
    missesTakenKeys: [],
    shotsTaken: [],
    sunkShipIndexes: [],
    shotHistory: [],
    revealedSunkShipCells: [],
    ready: false,
    defeated: false,
    connected: true,
  };
}

function getCurrentTurnPlayer(room) {
  if (!room?.order?.length) return null;
  return room.players[room.order[room.turnIndex]] || null;
}

function findPlayerByClientId(room, clientId) {
  if (!room || !clientId) return null;
  return room.order.map((playerId) => room.players[playerId]).find((player) => {
    return player?.clientId === clientId;
  });
}

function reattachPlayer(room, player, socket) {
  const oldId = player.id;
  socket.join(room.code);

  if (oldId === socket.id) return player;

  delete room.players[oldId];
  player.id = socket.id;
  player.connected = true;
  room.players[socket.id] = player;
  room.order = room.order.map((playerId) => (playerId === oldId ? socket.id : playerId));

  if (room.winnerId === oldId) {
    room.winnerId = socket.id;
  }

  return player;
}

function advanceTurn(room) {
  if (!room?.order?.length) return;

  for (let i = 0; i < room.order.length; i += 1) {
    room.turnIndex = (room.turnIndex + 1) % room.order.length;
    const nextPlayer = room.players[room.order[room.turnIndex]];

    if (nextPlayer && !nextPlayer.defeated) {
      return;
    }
  }
}

function addMissTaken(player, shotKey) {
  if (
    !player.missesTakenKeys.includes(shotKey) &&
    !player.hitsTakenKeys.includes(shotKey)
  ) {
    player.missesTakenKeys.push(shotKey);
  }
}

function recordShotTaken(player, x, y, result) {
  const shotKey = keyOf(x, y);
  const existing = player.shotsTaken.find((shot) => shot.x === x && shot.y === y);

  if (existing) {
    existing.result = result;
    return;
  }

  player.shotsTaken.push({ x, y, result, key: shotKey });
}

function recordSunkShip(player, ship) {
  for (const cell of ship) {
    recordShotTaken(player, cell.x, cell.y, "sunk");
  }
}

function revealSunkShip(room, sunkShip) {
  for (const playerId of room.order) {
    const player = room.players[playerId];
    if (!player) continue;

    const alreadyRevealed = player.revealedSunkShipCells.some((revealed) => {
      return (
        revealed.playerId === sunkShip.playerId &&
        revealed.cells?.every((cell, index) => {
          const other = sunkShip.cells[index];
          return other && other.x === cell.x && other.y === cell.y;
        })
      );
    });

    if (!alreadyRevealed) {
      player.revealedSunkShipCells.push(clone(sunkShip));
    }
  }
}

function findActiveShipsAt(player, x, y) {
  const hits = [];

  for (let index = 0; index < player.ships.length; index += 1) {
    if (player.sunkShipIndexes.includes(index)) continue;

    const ship = player.ships[index];
    if (ship.some((cell) => cell.x === x && cell.y === y)) {
      hits.push({ ship, index });
    }
  }

  return hits;
}

function isShipSunk(player, ship) {
  const hits = new Set(player.hitsTakenKeys);
  return ship.every((cell) => hits.has(keyOf(cell.x, cell.y)));
}

function publicPlayers(room) {
  return room.order
    .map((playerId) => room.players[playerId])
    .filter(Boolean)
    .map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      ready: player.ready,
      defeated: player.defeated,
      connected: player.connected,
      shipsLeft: Math.max(0, player.ships.length - player.sunkShipIndexes.length),
      totalShips: player.ships.length,
    }));
}

function buildRoomState(room, viewerId) {
  const viewer = room.players[viewerId];
  const currentTurnPlayer = getCurrentTurnPlayer(room);

  return {
    roomCode: room.code,
    boardSize: BOARD_SIZE,
    status: room.status,
    players: publicPlayers(room),
    currentTurnPlayerId: currentTurnPlayer?.id || "",
    currentTurnName: currentTurnPlayer?.name || "",
    isYourTurn:
      room.status === "battle" && currentTurnPlayer?.id === viewerId && !viewer?.defeated,
    winnerName: room.winnerId ? room.players[room.winnerId]?.name || "" : "",
    you: viewer
      ? {
          id: viewer.id,
          name: viewer.name,
          isHost: viewer.isHost,
          ready: viewer.ready,
          defeated: viewer.defeated,
          ships: clone(viewer.ships),
          hitsTakenKeys: [...viewer.hitsTakenKeys],
          missesTakenKeys: [...viewer.missesTakenKeys],
          shotsTaken: clone(viewer.shotsTaken),
          sunkShipIndexes: [...viewer.sunkShipIndexes],
          shotHistory: [...viewer.shotHistory],
          revealedSunkShipCells: clone(viewer.revealedSunkShipCells),
        }
      : null,
  };
}

function emitRoomState(room) {
  for (const playerId of room.order) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      playerSocket.emit("room_state", buildRoomState(room, playerId));
    }
  }
}

function emitPopup(room, type, items) {
  io.to(room.code).emit("battle_popup", { type, items });
}

function removePlayerFromRoom(socket, roomCode, explicitLeave = false) {
  const room = rooms[roomCode];
  if (!room || !room.players[socket.id]) return;

  const player = room.players[socket.id];
  socket.leave(roomCode);

  if (room.status === "finished" && explicitLeave) {
    delete room.players[socket.id];
    room.order = room.order.filter((playerId) => playerId !== socket.id);

    if (room.order.length === 0) {
      delete rooms[roomCode];
      return;
    }

    emitRoomState(room);
    return;
  }

  if ((room.status === "battle" || room.status === "finished") && !explicitLeave) {
    player.connected = false;
    emitRoomState(room);
    return;
  }

  if (room.status === "battle" || room.status === "finished") {
    player.connected = false;
    player.defeated = true;

    if (room.status === "battle" && room.order[room.turnIndex] === socket.id) {
      advanceTurn(room);
    }

    emitRoomState(room);
    return;
  }

  delete room.players[socket.id];
  room.order = room.order.filter((playerId) => playerId !== socket.id);

  if (room.order.length === 0) {
    delete rooms[roomCode];
    return;
  }

  room.order.forEach((playerId, index) => {
    room.players[playerId].isHost = index === 0;
  });

  if (room.turnIndex >= room.order.length) {
    room.turnIndex = 0;
  }

  emitRoomState(room);
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ clientId, playerName } = {}, callback) => {
    const code = makeRoomCode();
    const room = {
      code,
      players: {},
      order: [],
      turnIndex: 0,
      status: "lobby",
      winnerId: "",
    };

    room.players[socket.id] = createPlayer(socket, clientId, playerName, true, 1);
    room.order.push(socket.id);
    rooms[code] = room;

    socket.join(code);
    callback?.({ ok: true, roomCode: code });
    emitRoomState(room);
  });

  socket.on("join_room", ({ clientId, roomCode, playerName } = {}, callback) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms[code];

    if (!room) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    const existingPlayer = findPlayerByClientId(room, clientId);
    if (existingPlayer) {
      reattachPlayer(room, existingPlayer, socket);
      callback?.({ ok: true, roomCode: code });
      emitRoomState(room);
      return;
    }

    if (room.players[socket.id]) {
      callback?.({ ok: true, roomCode: code });
      emitRoomState(room);
      return;
    }

    if (room.order.length >= MAX_PLAYERS) {
      callback?.({ ok: false, error: "Room is full." });
      return;
    }

    if (room.status !== "lobby") {
      callback?.({ ok: false, error: "Battle already started." });
      return;
    }

    room.players[socket.id] = createPlayer(socket, clientId, playerName, false, room.order.length + 1);
    room.order.push(socket.id);

    socket.join(code);
    callback?.({ ok: true, roomCode: code });
    emitRoomState(room);
  });

  socket.on("start_placement", ({ clientId, roomCode } = {}, callback) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms[code];
    const existingPlayer = findPlayerByClientId(room, clientId);
    const player = existingPlayer ? reattachPlayer(room, existingPlayer, socket) : room?.players[socket.id];

    if (!room || !player) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (!player.isHost) {
      callback?.({ ok: false, error: "Only the host can start placement." });
      return;
    }

    if (room.status !== "lobby") {
      callback?.({ ok: false, error: "Placement already started." });
      return;
    }

    if (room.order.length < MIN_PLAYERS) {
      callback?.({ ok: false, error: `Need at least ${MIN_PLAYERS} players.` });
      return;
    }

    room.status = "placement";
    room.turnIndex = 0;
    room.winnerId = "";

    room.order.forEach((playerId) => {
      const roomPlayer = room.players[playerId];
      if (!roomPlayer) return;

      roomPlayer.ships = [];
      roomPlayer.hitsTakenKeys = [];
      roomPlayer.missesTakenKeys = [];
      roomPlayer.shotsTaken = [];
      roomPlayer.sunkShipIndexes = [];
      roomPlayer.shotHistory = [];
      roomPlayer.revealedSunkShipCells = [];
      roomPlayer.ready = false;
      roomPlayer.defeated = false;
    });

    callback?.({ ok: true });
    emitRoomState(room);
  });

  socket.on("submit_ships", ({ clientId, roomCode, ships } = {}, callback) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms[code];
    const existingPlayer = findPlayerByClientId(room, clientId);
    const player = existingPlayer ? reattachPlayer(room, existingPlayer, socket) : room?.players[socket.id];

    if (!room || !player) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.status !== "placement") {
      callback?.({ ok: false, error: "Placement has not started." });
      return;
    }

    const normalizedShips = normalizeShips(ships);
    const validationError = validateShips(normalizedShips);
    if (validationError) {
      callback?.({ ok: false, error: validationError });
      return;
    }

    player.ships = normalizedShips;
    player.hitsTakenKeys = [];
    player.missesTakenKeys = [];
    player.shotsTaken = [];
    player.sunkShipIndexes = [];
    player.shotHistory = [];
    player.revealedSunkShipCells = [];
    player.ready = true;
    player.defeated = false;

    const allReady =
      room.order.length >= MIN_PLAYERS &&
      room.order.every((playerId) => room.players[playerId]?.ready);

    if (allReady) {
      room.status = "battle";
      room.turnIndex = 0;
      room.winnerId = "";
    }

    callback?.({ ok: true });
    emitRoomState(room);
  });

  socket.on("fire_shot", ({ clientId, roomCode, x, y } = {}, callback) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms[code];
    const existingPlayer = findPlayerByClientId(room, clientId);
    const shooter = existingPlayer ? reattachPlayer(room, existingPlayer, socket) : room?.players[socket.id];
    const shotX = Number(x);
    const shotY = Number(y);

    if (!room || !shooter) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.status !== "battle") {
      callback?.({ ok: false, error: "Battle has not started." });
      return;
    }

    if (room.order[room.turnIndex] !== shooter.id) {
      callback?.({ ok: false, error: "Not your turn." });
      return;
    }

    if (
      !Number.isInteger(shotX) ||
      !Number.isInteger(shotY) ||
      shotX < 0 ||
      shotX >= BOARD_SIZE ||
      shotY < 0 ||
      shotY >= BOARD_SIZE
    ) {
      callback?.({ ok: false, error: "Shot is outside the board." });
      return;
    }

    if (shooter.shotHistory.some((shot) => shot.x === shotX && shot.y === shotY)) {
      callback?.({ ok: false, error: "You already fired there." });
      return;
    }

    const hitPlayers = [];
    const sunkShips = [];
    const eliminatedPlayers = [];
    const sunkMissShips = [];
    const missTargets = [];
    let hit = false;
    const shotKey = keyOf(shotX, shotY);

    for (const targetId of room.order) {
      if (targetId === shooter.id) continue;

      const target = room.players[targetId];
      if (!target || target.defeated) continue;

      const shipHits = findActiveShipsAt(target, shotX, shotY);
      if (!shipHits.length) {
        const wasShipHitBefore = target.hitsTakenKeys.includes(shotKey);
        let previousSunkShip = null;
        if (wasShipHitBefore) {
          previousSunkShip = target.ships.find((ship, shipIndex) => {
            return (
              target.sunkShipIndexes.includes(shipIndex) &&
              ship.some((cell) => cell.x === shotX && cell.y === shotY)
            );
          });

          if (previousSunkShip) {
            sunkMissShips.push({
              playerId: target.id,
              playerName: target.name,
              cells: clone(previousSunkShip),
            });
          }
        }
        missTargets.push({ target, wasShipHitBefore });
        continue;
      }

      hit = true;
      hitPlayers.push({ id: target.id, name: target.name, shipsHit: shipHits.length });

      if (!target.hitsTakenKeys.includes(shotKey)) {
        target.hitsTakenKeys.push(shotKey);
      }

      let shotResult = "hit";

      for (const shipHit of shipHits) {
        if (!target.sunkShipIndexes.includes(shipHit.index) && isShipSunk(target, shipHit.ship)) {
          target.sunkShipIndexes.push(shipHit.index);
          shotResult = "sunk";
          recordSunkShip(target, shipHit.ship);
          const sunkShip = {
            playerId: target.id,
            playerName: target.name,
            cells: clone(shipHit.ship),
          };
          revealSunkShip(room, sunkShip);
          sunkShips.push(sunkShip);
        }
      }

      if (shotResult === "hit") {
        recordShotTaken(target, shotX, shotY, "hit");
      }

      if (target.sunkShipIndexes.length === target.ships.length && !target.defeated) {
        target.defeated = true;
        eliminatedPlayers.push({ id: target.id, name: target.name });
      }
    }

    for (const missTarget of missTargets) {
      if (hit) {
        if (!missTarget.wasShipHitBefore) {
          recordShotTaken(missTarget.target, shotX, shotY, "global-hit");
        }
      } else {
        addMissTaken(missTarget.target, shotKey);
        if (!missTarget.wasShipHitBefore) {
          recordShotTaken(missTarget.target, shotX, shotY, "miss");
        }
      }
    }

    shooter.shotHistory.push({
      x: shotX,
      y: shotY,
      hit,
      sunk: sunkShips.length > 0,
      sunkMiss: sunkMissShips.length > 0,
    });

    for (const ship of sunkMissShips) {
      const alreadyRevealed = shooter.revealedSunkShipCells.some((revealed) => {
        return (
          revealed.playerId === ship.playerId &&
          revealed.cells?.every((cell, index) => {
            const other = ship.cells[index];
            return other && other.x === cell.x && other.y === cell.y;
          })
        );
      });

      if (!alreadyRevealed) {
        shooter.revealedSunkShipCells.push(ship);
      }
    }

    if (sunkShips.length) {
      emitPopup(
        room,
        "sunk",
        sunkShips.map((ship) => ({ text: `Ship sunk: ${ship.playerName}` }))
      );
    }

    if (eliminatedPlayers.length) {
      emitPopup(
        room,
        "eliminated",
        eliminatedPlayers.map((player) => ({ text: `Player out: ${player.name}` }))
      );
    }

    const alivePlayers = room.order
      .map((playerId) => room.players[playerId])
      .filter((player) => player && !player.defeated);

    if (alivePlayers.length === 1) {
      room.status = "finished";
      room.winnerId = alivePlayers[0].id;
      emitPopup(room, "winner", [{ text: `Winner: ${alivePlayers[0].name}` }]);
    } else if (!hit) {
      advanceTurn(room);
    }

    callback?.({ ok: true, hit, hitPlayers, sunkShips, eliminatedPlayers, sunkMissShips });
    emitRoomState(room);
  });

  socket.on("leave_room", ({ roomCode } = {}, callback) => {
    removePlayerFromRoom(socket, normalizeRoomCode(roomCode), true);
    callback?.({ ok: true });
  });

  socket.on("disconnect", () => {
    Object.keys(rooms).forEach((roomCode) => {
      removePlayerFromRoom(socket, roomCode);
    });
  });
});

const buildPath = path.join(process.cwd(), "build");
const indexPath = path.join(buildPath, "index.html");
app.use(
  express.static(buildPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);
app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(indexPath);
});
app.get("/{*splat}", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(indexPath);
});

server.listen(PORT, () => {
  console.log(`SERVER RUNNING ${PORT}`);
  console.log(`SERVING CLIENT ${indexPath}`);
});
