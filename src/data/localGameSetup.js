const localOpponents = [
  {
    id: "enemy1",
    name: "Enemy 1",
    ships: [
      { name: "Destroyer", cells: ["0-0", "0-1"] },
      { name: "Cruiser", cells: ["0-2", "1-2", "2-2"] },
      { name: "Submarine", cells: ["3-3", "3-4", "3-5"] }
    ]
  },
  {
    id: "enemy2",
    name: "Enemy 2",
    ships: [
      { name: "Destroyer", cells: ["5-0", "5-1"] },
      { name: "Cruiser", cells: ["6-3", "7-3", "8-3"] },
      { name: "Submarine", cells: ["2-6", "2-7", "2-8"] }
    ]
  }
];

const turnOrder = ["player", ...localOpponents.map((enemy) => enemy.id)];

const createEnemyMap = (factory) =>
  Object.fromEntries(localOpponents.map((enemy) => [enemy.id, factory(enemy)]));

const createInitialGameState = (roomCode = "") => ({
  roomCode,
  currentTurnIndex: 0,
  battleMessage: "Battle started. Your turn.",
  lastShotSummary: {
    coordinate: "",
    resultText: ""
  },
  globalShots: [],
  globalHitCells: [],
  enemyShotsByEnemy: createEnemyMap(() => []),
  enemyHitCellsByEnemy: createEnemyMap(() => []),
  enemySunkShipsByTarget: createEnemyMap(() => []),
  playerSunkShips: []
});

export { localOpponents, turnOrder, createEnemyMap, createInitialGameState };