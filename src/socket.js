import { io } from "socket.io-client";

const host = window.location.hostname;
const SERVER_URL = `http://${host}:4000`;

const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  timeout: 10000,
});

export default socket;