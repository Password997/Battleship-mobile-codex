import { io } from "socket.io-client";

function getServerUrl() {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }

  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:4000";
  }

  return window.location.origin;
}

const SERVER_URL = getServerUrl();

const socket = io(SERVER_URL, {
  path: "/socket.io",
  autoConnect: true,
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 10,
  transports: ["polling", "websocket"],
});

socket.on("connect", () => {
  console.log("SOCKET CONNECTED", socket.id, SERVER_URL);
});

socket.on("connect_error", (err) => {
  console.error("SOCKET CONNECT ERROR", err?.message || err);
});

socket.on("disconnect", (reason) => {
  console.log("SOCKET DISCONNECTED", reason);
});

export default socket;
