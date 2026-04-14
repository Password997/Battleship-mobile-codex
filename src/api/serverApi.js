const SERVER_URL = "http://localhost:4000";

async function parseJson(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export async function createRoom() {
  const response = await fetch(`${SERVER_URL}/create-room`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

  return parseJson(response);
}

export async function joinRoom(roomCode, playerName) {
  const response = await fetch(`${SERVER_URL}/join-room`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      roomCode,
      playerName
    })
  });

  return parseJson(response);
}

export async function fetchRoom(roomCode) {
  const response = await fetch(`${SERVER_URL}/room/${roomCode}`, {
    method: "GET"
  });

  return parseJson(response);
}