import React from "react";

const PLAYER_COLORS = [
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  { bg: "#ffe4e6", border: "#e11d48", text: "#9f1239" },
  { bg: "#ccfbf1", border: "#0d9488", text: "#115e59" },
  { bg: "#f3e8ff", border: "#9333ea", text: "#6b21a8" },
  { bg: "#e0f2fe", border: "#0284c7", text: "#075985" },
  { bg: "#f1f5f9", border: "#64748b", text: "#334155" },
  { bg: "#dcfce7", border: "#65a30d", text: "#3f6212" },
  { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
];

function playerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function splitPlayerName(name = "") {
  const match = String(name).trim().match(/^(P\d+)\s*(.*)$/);
  if (!match) {
    return { number: "P?", label: String(name || "Crew").trim() || "Crew" };
  }

  return {
    number: match[1],
    label: match[2]?.trim() || match[1],
  };
}
export default function WaitingRoomScreen({
  roomView,
  onBack,
  onStartPlacement,
  error = "",
  info = "",
}) {
  const players = roomView?.players || [];
  const roomCode = roomView?.roomCode || "";
  const isLobby = roomView?.status === "lobby";
  const readyCount = players.filter((player) => player.ready).length;
  const connectedCount = players.filter((player) => player.connected).length;
  const allReady = !isLobby && players.length >= 2 && readyCount === players.length;
  const waitingCount = isLobby
    ? Math.max(0, 2 - players.length)
    : Math.max(players.length, 2) - readyCount;
  const canStartPlacement = isLobby && roomView?.you?.isHost && players.length >= 2;
  const title = isLobby ? "Crew Lobby" : "Fleet Ready";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #0f766e 0%, #155e75 45%, #1f2937 100%)",
        padding: 16,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <style>
        {`
          @keyframes waitSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes crewArrive {
            0% { transform: translateY(8px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            background: "rgba(236, 253, 245, 0.94)",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 16px 36px rgba(15,23,42,0.26)",
            border: "1px solid rgba(204,251,241,0.72)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                {title}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#475569",
                  fontSize: 14,
                  lineHeight: 1.35,
                }}
              >
                {isLobby
                  ? "Join the room. Host launches when the crew is in."
                  : "Battle starts when every fleet is ready."}
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: "#0f766e",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Room code
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: "clamp(34px, 11vw, 60px)",
                  fontWeight: 900,
                  letterSpacing: "clamp(3px, 0.9vw, 7px)",
                  color: "#0f766e",
                  lineHeight: 1,
                  textAlign: "center",
                  wordBreak: "break-word",
                }}
              >
                {roomCode}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={onBack}
                style={buttonStyle("#111827")}
              >
                Back
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            <div style={statStyle("#ccfbf1", "#115e59")}>
              Connected {connectedCount} / {players.length}
            </div>
            <div
              style={statStyle(
                isLobby || allReady ? "#d1fae5" : "#fef3c7",
                isLobby || allReady ? "#065f46" : "#92400e"
              )}
            >
              {isLobby
                ? players.length >= 2
                  ? "Ready to place"
                  : `Need ${waitingCount} more`
                : allReady
                  ? "Launching battle"
                  : `Ready ${readyCount} / ${players.length}`}
            </div>
          </div>

          {isLobby && (
            <button
              onClick={onStartPlacement}
              disabled={!canStartPlacement}
              style={{
                marginTop: 18,
                width: "100%",
                background: canStartPlacement
                  ? "linear-gradient(135deg, #0f766e 0%, #14b8a6 58%, #5eead4 100%)"
                  : "#9ca3af",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "16px 16px",
                fontWeight: 900,
                fontSize: 17,
                cursor: canStartPlacement ? "pointer" : "default",
                boxShadow: canStartPlacement
                  ? "0 0 0 3px rgba(20,184,166,0.24), 0 14px 24px rgba(15,118,110,0.28)"
                  : "none",
              }}
            >
              {roomView?.you?.isHost
                ? "Launch Fleet Setup"
                : "Waiting for host"}
            </button>
          )}

          {(error || info) && (
            <div
              style={{
                marginTop: 18,
                borderRadius: 8,
                padding: 14,
                border: `2px solid ${error ? "#fecaca" : "#bfdbfe"}`,
                color: error ? "#991b1b" : "#1d4ed8",
                fontWeight: 700,
              }}
            >
              {error || info}
            </div>
          )}

          <div
            style={{
              marginTop: 22,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
              Crew
            </div>
            <div style={{ color: "#0f766e", fontSize: 13, fontWeight: 800 }}>
              {players.length} aboard
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 12,
            }}
          >
            {players.map((player, index) => {
              const positive = isLobby ? player.connected : player.ready;
              const identity = splitPlayerName(player.name);
              const totalShips = player.totalShips || 5;
              const shipsLeft =
                typeof player.shipsLeft === "number" ? player.shipsLeft : totalShips;
              const fleetReady = !isLobby && player.ready;
              const accent = playerColor(index);
              return (
                <div
                  key={player.id}
                  style={{
                    border: positive ? "1px solid #99f6e4" : "1px solid #bae6fd",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    background: positive ? "rgba(204,251,241,0.72)" : "rgba(240,249,255,0.72)",
                    animation: "crewArrive 0.22s ease-out",
                    boxShadow: `inset 4px 0 0 ${accent.border}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        minWidth: 48,
                        height: 52,
                        borderRadius: 8,
                        background: accent.bg,
                        color: accent.text,
                        border: `1px solid ${accent.border}`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{identity.number}</span>
                      <span style={{ fontSize: 10, opacity: 0.82 }}>
                        {player.isHost ? "HOST" : "CREW"}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                        {identity.label}
                      </div>
                      {!isLobby && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            gap: 4,
                            alignItems: "center",
                          }}
                          aria-label={`${shipsLeft} ships alive`}
                        >
                          {Array.from({ length: totalShips }).map((_, index) => {
                            const alive = index < shipsLeft;
                            return (
                              <span
                                key={index}
                                style={{
                                  width: 16,
                                  height: 7,
                                  borderRadius: 3,
                                  background: alive ? accent.border : "#cbd5e1",
                                  display: "inline-block",
                                }}
                              />
                            );
                          })}
                          <span
                            style={{
                              marginLeft: 4,
                              color: "#334155",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            {shipsLeft}/{totalShips} ships
                          </span>
                        </div>
                      )}
                      <div style={{ marginTop: 2, color: "#0f766e", fontSize: 12, fontWeight: 800 }}>
                        {player.isHost ? "👑 HOST" : "CREW"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: positive ? "#dcfce7" : "#fef3c7",
                      color: positive ? "#166534" : "#92400e",
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    <StatusDot spinning={isLobby ? !player.connected : !player.ready} />
                    {isLobby
                      ? player.connected
                        ? "CONNECTED"
                        : "WAITING"
                      : player.ready
                        ? "FLEET READY"
                        : "PLACING"}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

function StatusDot({ spinning }) {
  return (
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: spinning ? "transparent" : "#22c55e",
        border: spinning ? "2px solid #f59e0b" : "none",
        borderTopColor: spinning ? "transparent" : "#22c55e",
        display: "inline-block",
        animation: spinning ? "waitSpin 0.8s linear infinite" : "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function buttonStyle(background) {
  return {
    background,
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function statStyle(background, color) {
  return {
    background,
    color,
    borderRadius: 8,
    padding: "12px 14px",
    fontWeight: 900,
    textAlign: "center",
  };
}
