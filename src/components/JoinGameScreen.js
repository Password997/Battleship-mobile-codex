import { useState } from "react";

function JoinGameScreen({ onJoinRoom, onBack, isLoading }) {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");

  const handleSubmit = () => {
    const trimmedRoomCode = roomCode.trim().toUpperCase();
    const trimmedName = playerName.trim();

    if (!trimmedRoomCode) {
      alert("Please enter a room code.");
      return;
    }

    if (!trimmedName) {
      alert("Please enter your name.");
      return;
    }

    onJoinRoom(trimmedRoomCode, trimmedName);
  };

  return (
    <div className="app__panel">
      <h1 className="app__title">Join Game</h1>
      <p className="app__text">Enter the room code and your name.</p>

      <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
        <input
          type="text"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
          placeholder="Room code"
          style={inputStyle}
        />

        <input
          type="text"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Your name"
          style={inputStyle}
        />
      </div>

      <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button style={primaryButtonStyle} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Joining..." : "Join Room"}
        </button>

        <button style={secondaryButtonStyle} onClick={onBack} disabled={isLoading}>
          Back
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "15px",
  boxSizing: "border-box"
};

const primaryButtonStyle = {
  padding: "12px 16px",
  border: "none",
  borderRadius: "12px",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer"
};

const secondaryButtonStyle = {
  padding: "12px 16px",
  border: "1px solid #334155",
  borderRadius: "12px",
  background: "#111827",
  color: "#e2e8f0",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer"
};

export default JoinGameScreen;