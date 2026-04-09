/** server.js - Room Management Fix */
const io = require("socket.io")(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

const rooms = {};

io.on("connection", (socket) => {
    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7).toUpperCase();
        rooms[roomId] = { 
            id: roomId, 
            players: {}, // Use object to store unique socket IDs
            max: data.max || 5 
        };
        join(socket, roomId, data.nickname);
    });

    socket.on("join-room", (data) => {
        const roomId = data.roomId.toUpperCase();
        if (rooms[roomId] && Object.keys(rooms[roomId].players).length < rooms[roomId].max) {
            join(socket, roomId, data.nickname);
        } else {
            socket.emit("error-msg", "Room Full or Not Found");
        }
    });

    socket.on("sync", (data) => {
        socket.to(data.roomId).emit("player-moved", {
            id: socket.id,
            nickname: data.nickname,
            x: data.x,
            y: data.y,
            duck: data.duck
        });
    });

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
    // Store player info in the room object
    rooms[roomId].players[socket.id] = { nickname };
    
    // Send the Room ID back to the creator/joiner
    socket.emit("joined", { roomId, players: rooms[roomId].players });
    
    // Notify others in the room
    socket.to(roomId).emit("new-player", { id: socket.id, nickname });
}
