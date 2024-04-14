const app = require("express")()
const server = require("http").createServer(app)
const io = require("socket.io")(server)
const bcrypt = require("bcrypt");

const saltRounds = 10;
var rooms = {"general":{passwordHash:'$2b$10$E2EC.Xb.vKZTkZoppO..eO5OYyAecmJmpNmAxK2X0gIx2YKzht.Ia', users:[], id:[]}}

function getNow(time){
    var hours = Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((time % (1000 * 60)) / 1000);
    return (hours<10 ? "0" : "") + hours + (minutes<10 ? ":0" : ":") + minutes + (seconds<10 ? ":0" : ":") + seconds   
}

function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9# ]/g, '');
}


io.on("connection", socket =>{
    console.log("new connection")
    socket.on("join", async ({room, pass, username, publicKey}, callback) => {
        username = normalizeName(username);
        socket["user"] = {username, room};
        if (rooms[room]) {
            if (await bcrypt.compare(pass, rooms[room].passwordHash)) {
                socket.join(room);
                var oldUsername = username;
                var i = 1;
                while (rooms[room].users.includes(username)) {
                    username = oldUsername + `#${i}`;
                    i++;
                }
                socket.to(room).emit('new', username);
                if (rooms[room].users.length > 0) {
                    socket.to(rooms[room].id[0]).timeout(10000).emit("request-key", {id:socket.id, foreignPublicKey:publicKey}, (_idk, encryptionKey) => {
                        callback(200, username, encryptionKey);
                    });
                } else {
                    callback(206, username, "");
                }
                rooms[room].id.push(socket.id);
                rooms[room].users.push(username);
                return;
            }
            callback(100);
            return;
        }
        // Hashing the password before creating the room
        const passwordHash = await bcrypt.hash(pass, saltRounds);
        rooms[room] = {passwordHash, users:[], id:[]};
        rooms[room].id.push(socket.id);
        rooms[room].users.push(username);
        socket.join(room);
        callback(404);
    });
    socket.on("set-name", ({room, user, setUser}, callback)=>{ //note to self, need to add a callback to this
        if (rooms[room]["users"].filter(e=>e==setUser).length){
            setUser = setUser+ `#${rooms[room]["users"].filter(e=>e==setUser).length}`
        } 
        socket.user.username = setUser
        rooms[room]["users"][rooms[room]["users"].indexOf(user)] = setUser
        socket.to(room).emit("changed", user, setUser)
        callback(setUser)
    })
    socket.on("dm", ({username, room, user, msg}, callback)=>{
        var now = new Date().getTime()
        now = getNow(now)
        user = rooms[room]["users"].indexOf(user)
        if (user <0){
            callback(404)
            return
        }
        room = rooms[room]["id"][user]
        io.to(room).emit("private", {room, user:username, message:msg, now:now})
        callback(200)
    })
    socket.on("list", (room, callback)=>{
        callback(rooms[room]["users"])
    })
    socket.on("message", (room, user, message, rgb)=>{
        var now = new Date().getTime()
        now = getNow(now)
        console.log(`[${now}]@~${room}/${user}: ${message}`)
        socket.to(room).emit('recieve', {room, user, message, now, rgb})
    })
    socket.on("leave", (room, username)=>{
        console.log(`${username} left ${room}`)
        socket.to(room).emit("leave", username)
        rooms[room]["users"].splice(rooms[room]["users"].indexOf(username),1)
        rooms[room]["id"].splice(rooms[room]["id"].indexOf(socket.id),1)
        socket.user.room = null
        socket.leave(room)
        if (room != "general" && rooms[room]["users"].length < 0) {
            delete rooms[room]
        }
    })
    socket.on("disconnect", ()=>{
        console.log(`${socket?.user?.username} left`)
        if (socket?.user?.room){
            const room = socket.user.room
            rooms[room]["users"].splice(rooms[room]["users"].indexOf(socket.user.username),1)
            rooms[room]["id"].splice(rooms[room]["id"].indexOf(socket.id),1)
            socket.to(room).emit("leave", socket.user.username)
            if (room != "general" && rooms[room]["users"].length < 0) {
                delete rooms[room]
            }
        }
    })
});
//the env port checks if there is an environmental variable
const PORT = process.env.PORT || 9000;
server.listen(PORT, async () => {
    console.log(`\n\x1b[32m[server]\x1b[0m running on port: \x1b[33m${PORT}\x1b[0m \n`)
});
setInterval(() => '', 1000 * 60 * 60);