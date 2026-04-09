const io = require("socket.io")(process.env.PORT || 3000, {
    cors: { origin: "*" } // Allows your GitHub site to connect
});

const rooms = {};
let globalLeaderboard = []; // In-memory storage for top scores

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // --- ROOM CREATION & JOINING ---
    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7);
        rooms[roomId] = {
            id: roomId,
            players: {}, // Changed to object to track socket.id -> nickname
            max: data.max || 5,
            gameStarted: false
        };
        join(socket, roomId, data.nickname || "Dino");
    });

    socket.on("join-room", (data) => {
        const roomId = data.roomId;
        if (rooms[roomId] && Object.keys(rooms[roomId].players).length < rooms[roomId].max) {
            join(socket, roomId, data.nickname || "Dino");
        } else {
            socket.emit("error-msg", "Room Full or Not Found");
        }
    });

    // --- MULTIPLAYER SYNC ---
    socket.on("sync", (data) => {
        // Broadcast movement, ducking, and nickname to everyone else in the room
        socket.to(data.roomId).emit("player-moved", {
            id: socket.id,
            nickname: data.nickname,
            x: data.x,
            y: data.y,
            duck: data.duck
        });
    });

    // --- GLOBAL LEADERBOARD SYSTEM ---
    socket.on("submit-score", (data) => {
        if (data.name && data.score) {
            globalLeaderboard.push({ name: data.name, score: data.score });
            // Sort highest to lowest and keep only the top 10
            globalLeaderboard.sort((a, b) => b.score - a.score);
            globalLeaderboard = globalLeaderboard.slice(0, 10);
            // Broadcast the updated board to all connected clients
            io.emit("update-leaderboard", globalLeaderboard);
        }
    });

    socket.on("get-leaderboard", () => {
        socket.emit("update-leaderboard", globalLeaderboard);
    });

    // --- CLEANUP ---
    socket.on("disconnect", () => {
        for (const roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                socket.to(roomId).emit("player-left", socket.id);
            }
        }
        console.log("Player disconnected:", socket.id);
    });
});

function join(socket, roomId, nickname) {
    socket.join(roomId);
    if (!rooms[roomId].players) rooms[roomId].players = {};
    rooms[roomId].players[socket.id] = { nickname };
    
    // Tell the joining player they are in
    socket.emit("joined", { 
        roomId, 
        players: rooms[roomId].players 
    });
    
    // Notify others in the room
    socket.to(roomId).emit("new-player", {
        id: socket.id,
        nickname: nickname
    });
}
