/** server.js - Final Multi-Player & Admin Control Fix */
const io = require("socket.io")(process.env.PORT || 3000, { cors: { origin: "*" } });

const rooms = {};

io.on("connection", (socket) => {
    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7).toUpperCase();
        rooms[roomId] = { 
            id: roomId, 
            players: {}, 
            adminId: socket.id, 
            max: parseInt(data.max) || 5,
            gameStarted: false // Prevent late joins
        };
        join(socket, roomId, data.nickname);
    });

    socket.on("join-room", (data) => {
        const roomId = data.roomId.toUpperCase();
        const room = rooms[roomId];
        // Allow joining only if room exists, isn't full, and hasn't started
        if (room && !room.gameStarted && Object.keys(room.players).length < room.max) {
            join(socket, roomId, data.nickname);
        } else {
            socket.emit("error-msg", room?.gameStarted ? "Game already started" : "Room Full or Not Found");
        }
    });

    socket.on("admin-start", (data) => {
        const room = rooms[data.roomId];
        if (room && room.adminId === socket.id) {
            room.gameStarted = true; // Lock the room
            io.to(data.roomId).emit("start-multiplayer"); 
        }
    });

    socket.on("sync", (data) => {
        socket.to(data.roomId).emit("player-moved", {
            id: socket.id, nickname: data.nickname, x: data.x, y: data.y, duck: data.duck
        });
    });

    socket.on("disconnect", () => {
        for (const r in rooms) {
            if (rooms[r].players[socket.id]) {
                delete rooms[r].players[socket.id];
                // Broadcast updated count and list
                io.to(r).emit("lobby-update", {
                    players: rooms[r].players,
                    count: Object.keys(rooms[r].players).length
                });
                socket.to(r).emit("player-left", socket.id);
            }
        }
    });
});

function join(socket, roomId, nickname) {
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { nickname };
    
    socket.emit("joined", { 
        roomId, 
        isAdmin: rooms[roomId].adminId === socket.id,
        max: rooms[roomId].max
    });
    
    // Send updated player list and count to everyone in the lobby
    io.to(roomId).emit("lobby-update", {
        players: rooms[roomId].players,
        count: Object.keys(rooms[roomId].players).length
    });
}
