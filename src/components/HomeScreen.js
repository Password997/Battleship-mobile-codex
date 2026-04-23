function HomeScreen({ onCreateGame, onJoinGame }) {
  return (
    <div className="app__panel app__panel--hero">
      <div className="app__preview-badge">Local Preview</div>
      <div className="app__title-wrap">
        <div className="app__eyebrow">Tactical Naval Warfare</div>
        <h1 className="app__title">Battleship</h1>
        <p className="app__text">
          A darker, sharper multiplayer command deck for six-player fleet battles.
        </p>
      </div>

      <div className="app__hero-art" aria-hidden="true">
        <div className="app__hero-radar" />
        <div className="app__hero-ship" />
      </div>

      <div className="app__cta-grid">
        <button className="app__action app__action--primary" onClick={onCreateGame}>
          <span className="app__action-title">Create Match</span>
          <span className="app__action-subtitle">
            Open a multiplayer room and command the fleet from the first move.
          </span>
        </button>

        <button className="app__action" onClick={onJoinGame}>
          <span className="app__action-title">Join Match</span>
          <span className="app__action-subtitle">
            Enter a room code and drop into an active tactical board.
          </span>
        </button>
      </div>

      <div className="app__meta">
        <div className="app__meta-card">
          <div className="app__meta-label">Mode</div>
          <div className="app__meta-value">Multiplayer Fleet Battle</div>
          <div className="app__meta-small">Built for 2-6 players</div>
        </div>
        <div className="app__meta-card">
          <div className="app__meta-label">Visual Target</div>
          <div className="app__meta-value">Premium Oceanic HUD</div>
          <div className="app__meta-small">Dark water, cyan radar, ember hits</div>
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
