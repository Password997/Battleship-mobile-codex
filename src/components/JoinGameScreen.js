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
      <div className="app__eyebrow">Fleet Link</div>
      <h1 className="app__title" style={{ fontSize: "clamp(30px, 7vw, 48px)" }}>
        Join Match
      </h1>
      <p className="app__text">
        Enter the room code and your callsign to board the multiplayer battle.
      </p>

      <div className="app__form">
        <input
          type="text"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
          placeholder="Room code"
          className="app__input"
        />

        <input
          type="text"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Admiral name"
          className="app__input"
        />
      </div>

      <div className="app__meta">
        <div className="app__meta-card">
          <div className="app__meta-label">Access</div>
          <div className="app__meta-value">Room Code Entry</div>
          <div className="app__meta-small">Fast join for private sessions</div>
        </div>
        <div className="app__meta-card">
          <div className="app__meta-label">Battle Size</div>
          <div className="app__meta-value">Scales Beyond Duels</div>
          <div className="app__meta-small">Made for larger turn orders</div>
        </div>
      </div>

      <div className="app__button-row">
        <button className="app__button" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Joining..." : "Join Room"}
        </button>

        <button
          className="app__button app__button--secondary"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default JoinGameScreen;
