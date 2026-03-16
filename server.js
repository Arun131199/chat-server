const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });
const users = new Map(); // cliendId ->{ws, username,color}

// random colors
const COLORS = [
  "#63ffb4",
  "#ff6b6b",
  "#4488ff",
  "#ffd93d",
  "#ff922b",
  "#cc5de8",
  "#20c997",
  "#f06595",
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function broadcast(data, excludeId = null) {
  users.forEach((user, id) => {
    if (id !== excludeId && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(data));
    }
  });
}

// Send to all including sender
function broadcastAll(data) {
  users.forEach((user) => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(data));
    }
  });
}

// Get users list (without ws object)
function getUsersList() {
  return Array.from(users.entries()).map(([id, user]) => ({
    id,
    username: user.username,
    color: user.color,
  }));
}

wss.on("connection", (ws) => {
  const clientId = uuidv4();
  console.log(`✅ New connection: ${clientId}`);

  // ── Handle incoming messages ──────────────────────────────
  ws.on("message", (rawData) => {
    let data;
    try {
      data = JSON.parse(rawData);
    } catch {
      return;
    }

    // JOIN — user joins chat
    if (data.type === "JOIN") {
      const user = {
        ws,
        username: data.username || `User_${clientId.slice(0, 4)}`,
        color: getRandomColor(),
      };
      users.set(clientId, user);

      // Send welcome to this user
      ws.send(
        JSON.stringify({
          type: "WELCOME",
          clientId,
          username: user.username,
          color: user.color,
          users: getUsersList(),
          message: `Welcome to the chat, ${user.username}!`,
        }),
      );

      // Notify others
      broadcast(
        {
          type: "USER_JOINED",
          clientId,
          username: user.username,
          color: user.color,
          users: getUsersList(),
          timestamp: Date.now(),
        },
        clientId,
      );

      console.log(`👤 ${user.username} joined. Total: ${users.size}`);
    }

    // CHAT MESSAGE
    if (data.type === "MESSAGE") {
      const user = users.get(clientId);
      if (!user) return;

      const messageData = {
        type: "MESSAGE",
        id: uuidv4(),
        clientId,
        username: user.username,
        color: user.color,
        text: data.text,
        timestamp: Date.now(),
      };

      // Send to everyone including sender
      broadcastAll(messageData);
      console.log(`💬 ${user.username}: ${data.text}`);
    }

    // TYPING indicator
    if (data.type === "TYPING") {
      const user = users.get(clientId);
      if (!user) return;

      broadcast(
        {
          type: "TYPING",
          clientId,
          username: user.username,
          isTyping: data.isTyping,
        },
        clientId,
      );
    }
  });

  // ── Disconnect ────────────────────────────────────────────
  ws.on("close", () => {
    const user = users.get(clientId);
    if (user) {
      console.log(`🔴 ${user.username} disconnected`);
      users.delete(clientId);

      broadcast({
        type: "USER_LEFT",
        clientId,
        username: user.username,
        users: getUsersList(),
        timestamp: Date.now(),
      });
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

console.log("🚀 WebSocket server running on ws://localhost:8080");
