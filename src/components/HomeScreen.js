function HomeScreen({ onCreateGame, onJoinGame }) {
  return (
    <div className="app__panel">
      <h1 className="app__title">Battleship Mobile</h1>
      <p className="app__text">Play a turn-based multiplayer battleship game.</p>

      <div style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
        <button style={buttonStyle} onClick={onCreateGame}>
          Create Game
        </button>
        <button style={buttonStyleSecondary} onClick={onJoinGame}>
          Join Game
        </button>
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: "14px 16px",
  border: "none",
  borderRadius: "12px",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer"
};

const buttonStyleSecondary = {
  padding: "14px 16px",
  border: "1px solid #334155",
  borderRadius: "12px",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer"
};

export default HomeScreen;