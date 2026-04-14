import { io } from "socket.io-client";

const SERVER_URL =
  process.env.REACT_APP_SERVER_URL ||
  "https://battleship-mobile-production.up.railway.app";

const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

export default socket;