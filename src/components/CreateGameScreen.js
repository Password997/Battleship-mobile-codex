import { useState } from "react";

function CreateGameScreen({ onCreateRoom, onBack, isLoading }) {
  const [playerName, setPlayerName] = useState("");

  const handleSubmit = () => {
    const trimmedName = playerName.trim();

    if (!trimmedName) {
      alert("Please enter your name.");
      return;
    }

    onCreateRoom(trimmedName);
  };

  return (
    <div className="app__panel">
      <h1 className="app__title">Create Game</h1>
      <p className="app__text">Enter your name, then create a room.</p>

      <div style={{ marginTop: "16px" }}>
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
          {isLoading ? "Creating..." : "Create Room"}
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

export default CreateGameScreen;