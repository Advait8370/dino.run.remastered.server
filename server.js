/** server.js - Admin Control Logic */
const io = require("socket.io")(process.env.PORT || 3000, { cors: { origin: "*" } });

const rooms = {};

io.on("connection", (socket) => {
    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7).toUpperCase();
        rooms[roomId] = { 
            id: roomId, 
            players: {}, 
            adminId: socket.id, // Store who created the room
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

    socket.on("admin-start", (data) => {
        const room = rooms[data.roomId];
        if (room && room.adminId === socket.id) {
            // Tell everyone in the room to start the game
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
                io.to(r).emit("lobby-update", rooms[r].players);
                socket.to(r).emit("player-left", socket.id);
            }
        }
    });
});

function join(socket, roomId, nickname) {
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { nickname };
    
    // Tell the specific player if they are the admin
    socket.emit("joined", { 
        roomId, 
        isAdmin: rooms[roomId].adminId === socket.id 
    });
    
    // Update the lobby list for everyone
    io.to(roomId).emit("lobby-update", rooms[roomId].players);
}
