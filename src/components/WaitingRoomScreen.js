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
          "radial-gradient(circle at 50% 70%, rgba(67,197,255,0.16), transparent 18%), linear-gradient(180deg, #03101d 0%, #06192a 38%, #07243b 68%, #020b15 100%)",
        padding: 16,
        boxSizing: "border-box",
        color: "#e9f8ff",
        fontFamily: "'Segoe UI', 'Trebuchet MS', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
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

          @keyframes roomSweep {
            0% { transform: translateX(-50%) rotate(0deg); }
            100% { transform: translateX(-50%) rotate(360deg); }
          }
        `}
      </style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: -220,
          width: 700,
          height: 700,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          border: "1px solid rgba(95,224,255,0.08)",
          boxShadow: "0 0 0 70px rgba(95,224,255,0.02), 0 0 0 150px rgba(95,224,255,0.012)",
          opacity: 0.9,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: -220,
          width: 760,
          height: 760,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, rgba(95,224,255,0.18), rgba(95,224,255,0.02) 16%, transparent 26%, transparent 100%)",
          animation: "roomSweep 14s linear infinite",
          opacity: 0.42,
        }}
      />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(180deg, rgba(8,31,51,0.97), rgba(4,18,31,0.96))",
            borderRadius: 22,
            padding: 18,
            boxShadow: "0 18px 38px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(95,224,255,0.04)",
            border: "1px solid rgba(95,224,255,0.16)",
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
              <div style={{ color: "#5fe0ff", fontSize: 12, letterSpacing: "0.22em", fontWeight: 800, textTransform: "uppercase" }}>
                Multiplayer Staging
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#f4fbff", marginTop: 8 }}>
                {title}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#83b0c8",
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
                  color: "#5fe0ff",
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
                  color: "#67e3ff",
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
            <div style={statStyle("rgba(6, 31, 48, 0.9)", "#8ce9ff")}>
              {roomView?.you?.isHost ? "You are host" : "Crew station linked"}
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
                  ? "linear-gradient(180deg, rgba(255,135,61,1), rgba(142,61,17,1))"
                  : "linear-gradient(180deg, rgba(83,95,107,1), rgba(46,55,64,1))",
                color: "#ffffff",
                border: "1px solid rgba(255,198,158,0.18)",
                borderRadius: 16,
                padding: "16px 16px",
                fontWeight: 900,
                fontSize: 17,
                cursor: canStartPlacement ? "pointer" : "default",
                boxShadow: canStartPlacement
                  ? "0 0 0 1px rgba(255,164,104,0.24), 0 16px 26px rgba(0,0,0,0.28)"
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
                borderRadius: 16,
                padding: 14,
                border: `1px solid ${error ? "rgba(255,149,149,0.34)" : "rgba(104,226,255,0.22)"}`,
                background: error ? "rgba(90,20,20,0.34)" : "rgba(7,36,56,0.65)",
                color: error ? "#ffc0c0" : "#9cefff",
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
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f4fbff" }}>
              Crew
            </div>
            <div style={{ color: "#5fe0ff", fontSize: 13, fontWeight: 800 }}>
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
                    borderRadius: 18,
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 16,
                    background: positive ? "rgba(6, 49, 65, 0.78)" : "rgba(6, 31, 48, 0.78)",
                    animation: "crewArrive 0.22s ease-out",
                    boxShadow: `inset 4px 0 0 ${accent.border}, 0 16px 26px rgba(0,0,0,0.16)`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        minWidth: 48,
                        height: 56,
                        borderRadius: 12,
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
                        boxShadow: "0 10px 18px rgba(0,0,0,0.14)",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{identity.number}</span>
                      <span style={{ fontSize: 10, opacity: 0.82 }}>
                        {player.isHost ? "HOST" : "CREW"}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: "#f4fbff", fontSize: 17 }}>
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
                              color: "#9fc6d8",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            {shipsLeft}/{totalShips} ships
                          </span>
                        </div>
                      )}
                      <div style={{ marginTop: 2, color: "#5fe0ff", fontSize: 12, fontWeight: 800 }}>
                        {player.isHost ? "👑 HOST" : "CREW"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: positive ? "rgba(14, 92, 58, 0.28)" : "rgba(117, 72, 16, 0.3)",
                      color: positive ? "#86f0ba" : "#ffcf84",
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 12,
                      justifySelf: "end",
                      whiteSpace: "nowrap",
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
    background:
      background === "#111827"
        ? "linear-gradient(180deg, rgba(8,37,60,0.94), rgba(4,17,29,0.94))"
        : background,
    color: "#eefbff",
    border: "1px solid rgba(96,227,255,0.18)",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
  };
}

function statStyle(background, color) {
  return {
    background,
    color,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.08)",
  };
}
