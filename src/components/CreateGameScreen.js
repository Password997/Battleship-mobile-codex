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
      <div className="app__eyebrow">Command Deck</div>
      <h1 className="app__title" style={{ fontSize: "clamp(30px, 7vw, 48px)" }}>
        Create Match
      </h1>
      <p className="app__text">
        Enter your callsign and open a new room for the fleet.
      </p>

      <div className="app__form">
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
          <div className="app__meta-label">Room Type</div>
          <div className="app__meta-value">Private Lobby</div>
          <div className="app__meta-small">Share the code with your crew</div>
        </div>
        <div className="app__meta-card">
          <div className="app__meta-label">Focus</div>
          <div className="app__meta-value">Multiplayer Ready</div>
          <div className="app__meta-small">Designed for bigger matches too</div>
        </div>
      </div>

      <div className="app__button-row">
        <button className="app__button" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Room"}
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

export default CreateGameScreen;
