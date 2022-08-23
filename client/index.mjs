#!/usr/bin/env node
import { io } from "socket.io-client";
var socket = io.connect('https://node-relay-station.herokuapp.com', {reconnect: true});
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from "nanospinner";
import myRL from "serverline";

var username = "anonymous"

var room = ""

console.log("welcome to messenger")

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

async function getName(){
    const input = await inquirer.prompt({
        name: 'username',
        prefix:chalk.green(">"),
        type: 'input',
        message: 'display name as:',
        default(){
            return username
        }
    })
    username = input.username
}

async function menu(){
    const input = await inquirer.prompt({
        name:"menu",
        type:"list",
        message:"Select an action\n",
        choices:[
            "join room",
            "change username",
            "exit program",
        ]
    
    })
    switch (input.menu){
        case "exit program":
            process.exit(1)
            break;//technically useless
        case "change username":
            await getName()
            await menu()
            break;
        case "join room":
            var ui = await inquirer.prompt({name:"room", prefix:chalk.green(">"), type:"input", message:"room:"});
            room = ui.room
            if (!room){
                room = "general"
            }
            var pass = await inquirer.prompt({name:"pass", prefix:chalk.green(">"), type:"password", mask:"*", message:"pass:"});
            pass = pass.pass
            const spinner = createSpinner('verifying...').start()
            await sleep()
            socket.emit("join", {room, pass, username}, (response)=>{
                
                switch (response){
                    case 100:
                        spinner.error({text:chalk.red(`incorrect password for room "${room}"`)})
                        menu()
                        break;
                    case 200:
                        spinner.success({text:chalk.yellow(`successfully joined ${room}`)})
                        messenger()
                        break;
                    case 404:
                        spinner.error({text:chalk.red(`could not find room ${room}. Created a new room instead`)})
                        messenger()
                        break;
                }
            })
            break;
    }
}

function messenger(){
    myRL.init(chalk.greenBright(`@~/${room}/${username}#: `))
    //myRL.setCompletion(['help', 'command1', 'command2', 'login', 'check', 'ping'])
    myRL.on('line', function(line) {
        socket.emit("message", room, username, line)
        switch (line) {
            case 'help':
            console.log('help: To get this message.')
            break
            case 'pwd':
            console.log('toggle muted', !myRL.isMuted())
            myRL.setMuted(!myRL.isMuted(), '> [hidden]')
            return true
            
        }
        })
    
        myRL.on('SIGINT', function(rl) {
            process.exit(1)
        })    
}

const load = createSpinner('connecting...').start()

socket.on("recieve", ({room, user, message, now})=>{
    console.log(`@~/${room}/${user}#: ${message}`)
})

socket.on("new", (username)=>{
    console.log(chalk.yellow(`new client connected. Welcome ${username}`))
})

socket.on("leave", (user)=>{
    console.log(chalk.red(`${user} has left the room`))
})

socket.on('connect', () => {
    sleep(1000)
    load.success({text:chalk.green('secure connection to server established')});
    console.log(socket.id);
    (async ()=>{
        await getName()
        console.log(`welcome ${username}`)
        await menu()
    })()
});

