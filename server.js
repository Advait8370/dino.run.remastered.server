const io = require("socket.io")(process.env.PORT || 3000, {
    cors: { origin: "*" } // Allows your GitHub site to connect
});

const rooms = {};

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("create-room", (settings) => {
        const roomId = Math.random().toString(36).substring(7);
        rooms[roomId] = {
            id: roomId,
            players: [],
            max: settings.max || 5,
            min: settings.min || 2,
            gameStarted: false
        };
        join(socket, roomId);
    });

    socket.on("join-room", (roomId) => {
        if (rooms[roomId] && rooms[roomId].players.length < rooms[roomId].max) {
            join(socket, roomId);
        } else {
            socket.emit("error-msg", "Room Full or Not Found");
        }
    });

    socket.on("sync", (data) => {
        // Broadcast player movement to everyone else in the same room
        socket.to(data.roomId).emit("player-moved", {
            id: socket.id,
            x: data.x,
            y: data.y,
            duck: data.duck
        });
    });

    socket.on("disconnect", () => {
        console.log("Player disconnected");
    });
});

function join(socket, roomId) {
    socket.join(roomId);
    rooms[roomId].players.push(socket.id);
    socket.emit("joined", { roomId, players: rooms[roomId].players });
    socket.to(roomId).emit("new-player", socket.id);
}
