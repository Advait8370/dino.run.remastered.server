const io = require("socket.io")(process.env.PORT || 3000, { cors: { origin: "*" } });
const rooms = {};
let globalLeaderboard = [];

io.on("connection", (socket) => {
    socket.on("create-room", (data) => {
        const roomId = Math.random().toString(36).substring(7).toUpperCase();
        rooms[roomId] = { 
            id: roomId, players: {}, adminId: socket.id, 
            max: parseInt(data.max) || 5, gameStarted: false 
        };
        join(socket, roomId, data.nickname);
    });

    socket.on("join-room", (data) => {
        const roomId = data.roomId.toUpperCase();
        const room = rooms[roomId];
        if (room && !room.gameStarted && Object.keys(room.players).length < room.max) {
            join(socket, roomId, data.nickname);
        } else {
            socket.emit("error-msg", room?.gameStarted ? "Game in progress" : "Room not found/full");
        }
    });

    socket.on("admin-start", (data) => {
        if (rooms[data.roomId]?.adminId === socket.id) {
            rooms[data.roomId].gameStarted = true;
            io.to(data.roomId).emit("start-multiplayer");
        }
    });

    socket.on("sync", (data) => {
        socket.to(data.roomId).emit("player-moved", {
            id: socket.id, nickname: data.nickname, x: data.x, y: data.y, duck: data.duck
        });
    });

    socket.on("submit-score", (data) => {
        globalLeaderboard.push({ name: data.name, score: data.score });
        globalLeaderboard.sort((a, b) => b.score - a.score);
        globalLeaderboard = globalLeaderboard.slice(0, 10);
        io.emit("update-leaderboard", globalLeaderboard);
    });

    socket.on("get-leaderboard", () => socket.emit("update-leaderboard", globalLeaderboard));

    socket.on("disconnect", () => {
        for (const r in rooms) {
            if (rooms[r].players[socket.id]) {
                delete rooms[r].players[socket.id];
                io.to(r).emit("lobby-update", { players: rooms[r].players, count: Object.keys(rooms[r].players).length });
                socket.to(r).emit("player-left", socket.id);
            }
        }
    });
});

function join(socket, roomId, nickname) {
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { nickname };
    socket.emit("joined", { roomId, isAdmin: rooms[roomId].adminId === socket.id });
    io.to(roomId).emit("lobby-update", { players: rooms[roomId].players, count: Object.keys(rooms[roomId].players).length });
}
