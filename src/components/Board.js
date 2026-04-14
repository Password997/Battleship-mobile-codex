function Board({
  onCellClick,
  placedCells = [],
  attackedCells = [],
  hitCells = [],
  sunkCells = [],
  previewCells = [],
  invalidPreviewCells = [],
  isAttackBoard = false
}) {
  const rows = 10;
  const columns = 10;
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellKey = `${row}-${column}`;
      const isPlaced = placedCells.includes(cellKey);
      const isAttacked = attackedCells.includes(cellKey);
      const isHit = hitCells.includes(cellKey);
      const isSunk = sunkCells.includes(cellKey);
      const isPreview = previewCells.includes(cellKey);
      const isInvalidPreview = invalidPreviewCells.includes(cellKey);

      let background = "#1e293b";
      let border = "1px solid #334155";

      if (!isAttackBoard && isPlaced) {
        background = "#2563eb";
      }

      if (!isAttackBoard && isPreview) {
        background = "#60a5fa";
      }

      if (!isAttackBoard && isInvalidPreview) {
        background = "#f59e0b";
      }

      if (isAttacked) {
        background = isHit ? "#ef4444" : "#94a3b8";
      }

      if (isSunk) {
        background = "#ef4444";
        border = "3px solid #facc15";
      }

      cells.push(
        <button
          key={cellKey}
          type="button"
          onClick={onCellClick ? () => onCellClick(row, column) : undefined}
          style={{
            ...cellStyle,
            background,
            border
          }}
          title={`${String.fromCharCode(65 + row)}${column + 1}`}
        />
      );
    }
  }

  return <div style={boardStyle}>{cells}</div>;
}

const boardStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(10, 1fr)",
  gap: "4px",
  width: "100%",
  marginTop: "12px"
};

const cellStyle = {
  aspectRatio: "1 / 1",
  borderRadius: "6px",
  cursor: "pointer"
};

export default Board;