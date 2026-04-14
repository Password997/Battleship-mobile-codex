import { io } from "socket.io-client";

const SERVER_URL =
  process.env.REACT_APP_SERVER_URL ||
  "https://battleship-mobile-production.up.railway.app";

const socket = io(SERVER_URL, {
  path: "/socket.io",
  autoConnect: true,
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 10,
  transports: ["polling", "websocket"],
});

socket.on("connect", () => {
  console.log("SOCKET CONNECTED", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("SOCKET CONNECT ERROR", err?.message || err);
});

socket.on("disconnect", (reason) => {
  console.log("SOCKET DISCONNECTED", reason);
});

export default socket;