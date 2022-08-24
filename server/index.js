const app = require("express")()
const server = require("http").createServer(app)

const io = require("socket.io")(server)

socketToRoom = {}

var rooms = {"tbf":{password:"scaevitas", users:[]}, "room2":{password:"", users:[]}, "general":{password:"", users:[]}}

function getNow(time){
    var hours = Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((time % (1000 * 60)) / 1000);
    return (hours<10 ? "0" : "") + hours + (minutes<10 ? ":0" : ":") + minutes + (seconds<10 ? ":0" : ":") + seconds   
}

io.on("connection", socket =>{
    console.log("new connection")
    socket.on("join", ({room, pass, username}, callback)=>{
        socket["user"] = {username:username, room:room}
        if (rooms[room]){
            if (pass === rooms[room]["password"]){
                socket.join(room)
                rooms[room]["users"].push(username)
                socket.to(room).emit('new', username)
                callback(200)
            } else {
                callback(100)
            }
        } else {
            rooms[room] = {password:pass, users:[]}
            socket.join(room)
            callback(404)
        }
    })
    socket.on("set-name", (room, user, setUser)=>{
        socket.user.username = setUser
        rooms[room]["users"][rooms[room]["users"].indexOf(user)] = setUser
        socket.to(room).emit("changed", user, setUser)
    })
    socket.on("list", (room, callback)=>{
        callback(rooms[room]["users"])
    })
    socket.on("message", (room, user, message)=>{
        var now = new Date().getTime()
        now = getNow(now)
        console.log(`[${now}]@~${room}/${user}: ${message}`)
        socket.to(room).emit('recieve', {room, user, message, now:now})
    })
    socket.on("leave", (room, username)=>{
        console.log(`${username} left ${room}`)
        socket.to(room).emit("leave", username)
        rooms[room]["users"].splice(rooms[room]["users"].indexOf(username),1)
        socket.leave(room)
    })
    socket.on("disconnect", ()=>{
        console.log(`${socket?.user?.username} left`)
        if (socket?.user?.room){
            const room = socket.user.room
            rooms[room]["users"].splice(rooms[room]["users"].indexOf(socket.user.username),1)
            socket.to(room).emit("leave", socket.user.username)
        }
        //socket.to(socketToRoom[socket]).emit("leave", socket)
    })
});
//the env port checks if there is an environmental variable
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => console.log(`\n\x1b[32m[server]\x1b[0m running on port: \x1b[33m${PORT}\x1b[0m \n`));