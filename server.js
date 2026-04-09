const io = require("socket.io")(process.env.PORT || 3000, {
    cors: { origin: "*" } // Allows connection from GitHub Pages
});

const rooms = {};

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7);
        rooms[roomId] = { id: roomId, players: {}, max: data.max || 5 };
        join(socket, roomId, data.nickname);
    });

    socket.on("join-room", (data) => {
        if (rooms[data.roomId] && Object.keys(rooms[data.roomId].players).length < rooms[data.roomId].max) {
            join(socket, data.roomId, data.nickname);
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
    rooms[roomId].players[socket.id] = { nickname };
    socket.emit("joined", { roomId, players: rooms[roomId].players });
}
