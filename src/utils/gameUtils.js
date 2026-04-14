export function generateGameCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    code += letters[randomIndex];
  }

  return code;
}

export function buildShipCells(row, column, shipSize, shipDirection, occupiedCells = []) {
  const nextShipCells = [];
  let isValid = true;

  for (let i = 0; i < shipSize; i += 1) {
    const nextRow = shipDirection === "vertical" ? row + i : row;
    const nextColumn = shipDirection === "horizontal" ? column + i : column;
    const cellKey = `${nextRow}-${nextColumn}`;

    if (nextRow > 9 || nextColumn > 9) {
      isValid = false;
    }

    nextShipCells.push(cellKey);
  }

  if (nextShipCells.some((cellKey) => occupiedCells.includes(cellKey))) {
    isValid = false;
  }

  return {
    cells: nextShipCells,
    isValid
  };
}

export function getAvailableShots(existingShots = []) {
  const availableShots = [];

  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const cellKey = `${row}-${column}`;

      if (!existingShots.includes(cellKey)) {
        availableShots.push(cellKey);
      }
    }
  }

  return availableShots;
}

export function getRandomShot(existingShots = []) {
  const availableShots = getAvailableShots(existingShots);

  if (availableShots.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * availableShots.length);
  return availableShots[randomIndex];
}

export function isShipSunk(shipCells = [], shots = []) {
  return shipCells.every((cell) => shots.includes(cell));
}