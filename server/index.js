const app = require("express")()
const server = require("http").createServer(app)
const { Server } = require("socket.io");
const io = require("socket.io")(server)

//const { instrument } = require("@socket.io/admin-ui");

//socket admin ui. I HAVE NO CLUE WHY THIS FUCKS UP MY CODE. ESPECIALLY THE TOP PART
/* const admin = new Server(server, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true
    }
}); 
instrument(admin, {
    auth: {
        type: "basic",
        username: "Mr Robot",
        password: "$2b$10$sk8wCRvsCjOZdplILzH3T.jDxhL8ltWoi7js.gLJcyraspf3.dPdK"
    }
}); */


var rooms = {"tbf":{password:"scaevitas", users:[], id:[]}, "room2":{password:"", users:[], id:[]}, "general":{password:"", users:[], id:[]}}

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
                if (rooms[room]["users"].filter(e=>e==username).length){
                    username = username+ `#${rooms[room]["users"].filter(e=>e==username).length}`
                } 
                rooms[room]["id"].push(socket.id)
                rooms[room]["users"].push(username)
                socket.to(room).emit('new', username)
                callback(200, username)
                return
            } 
            callback(100)
            return
        } 
        rooms[room] = {password:pass, users:[], id:[]}
        socket.join(room)
        callback(404)
    })
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
        rooms[room]["id"].splice(rooms[room]["id"].indexOf(socket.id),1)
        socket.leave(room)
    })
    socket.on("disconnect", ()=>{
        console.log(`${socket?.user?.username} left`)
        if (socket?.user?.room){
            const room = socket.user.room
            rooms[room]["users"].splice(rooms[room]["users"].indexOf(socket.user.username),1)
            rooms[room]["id"].splice(rooms[room]["id"].indexOf(socket.id),1)
            socket.to(room).emit("leave", socket.user.username)
        }
    })
});
//the env port checks if there is an environmental variable
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => console.log(`\n\x1b[32m[server]\x1b[0m running on port: \x1b[33m${PORT}\x1b[0m \n`));