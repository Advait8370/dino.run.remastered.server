const io = require("socket.io")(process.env.PORT || 3000, {
    cors: { origin: "*" } // Allows connection from GitHub Pages
});

const rooms = {};
let globalLeaderboard = []; // In-memory leaderboard storage

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // --- 1. ROOM LOGIC ---
    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7);
        rooms[roomId] = { id: roomId, players: {}, max: data.max || 5 };
        join(socket, roomId, data.nickname || "Dino");
    });

    socket.on("join-room", (data) => {
        if (rooms[data.roomId] && Object.keys(rooms[data.roomId].players).length < rooms[data.roomId].max) {
            join(socket, data.roomId, data.nickname || "Dino");
        } else {
            socket.emit("error-msg", "Room Full or Not Found");
        }
    });

    // --- 2. MULTIPLAYER SYNC ---
    socket.on("sync", (data) => {
        // Broadcast movement and nickname to others in the room
        socket.to(data.roomId).emit("player-moved", {
            id: socket.id,
            nickname: data.nickname,
            x: data.x,
            y: data.y,
            duck: data.duck
        });
    });

    // --- 3. LEADERBOARD LOGIC ---
    socket.on("submit-score", (data) => {
        if (data.name && data.score) {
            globalLeaderboard.push({ name: data.name, score: data.score });
            globalLeaderboard.sort((a, b) => b.score - a.score); // Sort highest to lowest
            globalLeaderboard = globalLeaderboard.slice(0, 10); // Keep top 10
            io.emit("update-leaderboard", globalLeaderboard);
        }
    });

    socket.on("get-leaderboard", () => {
        socket.emit("update-leaderboard", globalLeaderboard);
    });

    // --- 4. DISCONNECT CLEANUP ---
    socket.on("disconnect", () => {
        for (const r in rooms) {
            if (rooms[r].players[socket.id]) {
                delete rooms[r].players[socket.id];
                socket.to(r).emit("player-left", socket.id);
            }
        }
    });
});

function join(socket, roomId, nickname) {
    socket.join(roomId);
    if (!rooms[roomId].players) rooms[roomId].players = {};
    rooms[roomId].players[socket.id] = { nickname };
    
    socket.emit("joined", { roomId, players: rooms[roomId].players });
    socket.to(roomId).emit("new-player", { id: socket.id, nickname });
}
