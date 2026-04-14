import React from "react";

export default function WaitingRoomScreen({
  roomView,
  onBack,
}) {
  const players = roomView?.players || [];
  const roomCode = roomView?.roomCode || "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: 16,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
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
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>
                Waiting Room
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: "#6b7280",
                  textAlign: "center",
                }}
              >
                Room code
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: "clamp(44px, 16vw, 88px)",
                  fontWeight: 900,
                  letterSpacing: "clamp(4px, 1.2vw, 10px)",
                  color: "#2563eb",
                  lineHeight: 1,
                  textAlign: "center",
                  wordBreak: "break-word",
                }}
              >
                {roomCode}
              </div>
            </div>

            <button
              onClick={onBack}
              style={{
                background: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 18px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gap: 12,
            }}
          >
            {players.map((player) => (
              <div
                key={player.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 800, color: "#111827", fontSize: 17 }}>
                  {player.name} {player.isHost ? "👑" : ""}
                </div>

                <div
                  style={{
                    background: player.ready ? "#dcfce7" : "#fef3c7",
                    color: player.ready ? "#166534" : "#92400e",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {player.ready ? "READY" : "NOT READY"}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 18,
              color: "#6b7280",
              fontSize: 15,
              textAlign: "center",
            }}
          >
            The battle starts automatically when all players are ready.
          </div>
        </div>
      </div>
    </div>
  );
}