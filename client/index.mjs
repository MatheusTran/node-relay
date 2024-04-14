import { io } from "socket.io-client";
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from "nanospinner";
import crypto from "crypto";
import EventEmitter from "events";
import readline from "readline";
import stream from "stream";
import util from "util";

/*
 * asynchronously read inputs
 */
const myEmitter = new EventEmitter()

let rl = null
let stdoutMuted = false
let myPrompt = '> '
let completions = []

const collection = {
    stdout: new stream.Writable(),
    stderr: new stream.Writable()
}

function Serverline() {
return {
    init: init,
    cleanup:cleanup,
    secret: secret,
    question: function() {
        rl.question.apply(rl, arguments)
    },
    getPrompt: function() {
        return myPrompt
    },
    setPrompt: async function(strPrompt) {
        myPrompt = strPrompt
        rl.setPrompt(myPrompt)
    },
    isMuted: function() {
        return stdoutMuted
    },
    setMuted: function(enabled, msg) {
        stdoutMuted = !!enabled

        const message = (msg && typeof msg === 'string') ? msg : '> [hidden]'
        rl.setPrompt((!stdoutMuted) ? myPrompt : message)
        return stdoutMuted
    },
    setCompletion: function(obj) {
        completions = (typeof obj === 'object') ? obj : completions
    },
    getHistory: function() {
        return (rl.terminal) ? rl.history : []
    },
    setHistory: function(history) {
        if (rl.terminal && Array.isArray(history)) {
            rl.history = history
            return true
        }
        return !!rl.terminal
    },
    getCollection: function() {
        return {
            stdout: collection.stdout,
            stderr: collection.stderr
        }
    },
    getRL: function() {
        return rl
    },
    close: function() {
        rl.close()
    },
    pause: function() {
        rl.pause()
    },
    resume: function() {
        rl.resume()
    },
    on: function(eventName) {
        switch (eventName) {
            case 'line':
            case 'SIGINT':
            case 'completer':
            return myEmitter.on.apply(myEmitter, arguments)
        }

        rl.on.apply(myEmitter, arguments)
        },
        _debugModuleSupport: function(debug) {
        debug.log = function log() {
            console.log(util.format.apply(util, arguments).toString())
        }
    }
}
}

let fixSIGINTonQuestion = false

function beforeTheLastLine(chunk) {
    const nbline = Math.ceil((rl.line.length + rl._prompt.length + 1) / rl.columns)

    let text = ''
    text += '\n\r\x1B[' + nbline + 'A\x1B[0J'
    text += chunk.toString()
    text += Array(nbline).join('\n')

    return Buffer.from(text, 'utf8')
}

function cleanup() {
    // Remove all listeners attached to the readline instance
    rl.removeAllListeners();
    // Close the readline interface if it's still open
    if (rl) {
        rl.close();
    }

    // Clear any console overrides if necessary
    console = global.console; // Restoring the original console

    // Clear other module-specific listeners or timeouts/intervals if any were set
    myEmitter.removeAllListeners();

    // Reset internal state as needed
    stdoutMuted = false;
    rl = null;
    myPrompt = '> ';
    completions = [];
}

function init(options) {
    if (typeof options === 'string') {
        options = { prompt: options } // eslint-disable-line no-param-reassign
    }

    const slOptions = Object.assign({}, {
        prompt: '> '
    }, options)

    if (slOptions.forceTerminalContext) {
        process.stdin.isTTY = true
        process.stdout.isTTY = true
    }

    if (rl != null) {
        cleanup();
    }

    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: completer,
        prompt: slOptions.prompt
    })

    if (!rl.terminal) {
        console.warn('WARN: Compatibility mode! The current context is not a terminal. This may ' +
        'occur when you redirect terminal output into a file.')
        console.warn('You can try to define `options.forceTerminalContext = true`.')
    }

    const consoleOptions = {}

    ;(['colorMode', 'inspectOptions', 'ignoreErrors']).forEach((val) => {
        if (typeof slOptions[val] !== 'undefined') {
        consoleOptions[val] = slOptions[val]
        }
    })

    consoleOverwrite(consoleOptions)
    hiddenOverwrite()

    rl.on('line', function(line) {
        if (!stdoutMuted && rl.history && rl.terminal) {
        rl.history.push(line)
        }
        myEmitter.emit('line', line)
        if (rl.terminal) {
        rl.prompt()
        }
    })
    rl.on('SIGINT', function() {
        fixSIGINTonQuestion = !!rl._questionCallback
        if (rl.terminal) {
        rl.line = ''
        }
        if (!myEmitter.emit('SIGINT', rl)) {
        process.exit(0)
        }
    })
    rl.prompt()


    rl.input.on('data', function(char) { // fix CTRL+C on question
        if (char === '\u0003' && fixSIGINTonQuestion) {
        rl._onLine('')
        rl._refreshLine()
        }
        fixSIGINTonQuestion = false
    })
}

function secret(query, callback) {
    const toggleAfterAnswer = !stdoutMuted
    stdoutMuted = true
    rl.question(query, function(value) {
        if (rl.terminal) {
        rl.history = rl.history.slice(1)
        }

        if (toggleAfterAnswer) {
            stdoutMuted = false
        }

        callback(value)
    })
}

function hiddenOverwrite() {
rl._refreshLine = (function(refresh) {
    // https://github.com/nodejs/node/blob/v10.0.0/lib/readline.js#L326 && ./v9.5.0/lib/readline.js#L335
    return function _refreshLine() {
    let abc
    if (stdoutMuted && rl.line) {
        abc = rl.line
        rl.line = ''
    }

    refresh.call(rl)

    if (stdoutMuted && rl.line) {
        rl.line = abc
    }
    }
})(rl._refreshLine)

rl._writeToOutput = (function(write) {
    // https://github.com/nodejs/node/blob/v10.0.0/lib/readline.js#L289 && ./v9.5.0/lib/readline.js#L442
    return function _writeToOutput(argStringToWrite) {
    let stringToWrite = argStringToWrite

    if (!stdoutMuted) {
        stringToWrite = argStringToWrite
    } else if (rl.terminal) { // muted && terminal
        stringToWrite = '\x1B[2K\x1B[200D' + rl._prompt + '*'.repeat(rl.line.length)
    } else { // muted && terminal == false
        stringToWrite = ''
    }

    write.call(rl, stringToWrite)
    }
})(rl._writeToOutput)
}

function consoleOverwrite(options) {
const original = {
    stdout: process.stdout,
    stderr: process.stderr
}

Object.keys(collection).forEach((name) => {
    collection[name]._write = function(chunk, encoding, callback) {
    // https://github.com/nodejs/node/blob/v10.0.0/lib/readline.js#L178
    if (rl.terminal) {
        original[name].write(beforeTheLastLine(chunk), encoding, () => {
        rl._refreshLine()
        callback()
        })
    } else {
        original[name].write(chunk, encoding, callback)
    }
    }
})

const Console = console.Console
const consoleOptions = Object.assign({}, {
    stdout: collection.stdout,
    stderr: collection.stderr
}, options)
console = new Console(consoleOptions) // eslint-disable-line no-global-assign
console.Console = Console
}

function completer(line) {
let hits = completions.filter(function(c) {
    return c.indexOf(line) === 0
})

const arg = {
    line: line,
    hits: hits
}

myEmitter.emit('completer', arg)

hits = arg.hits
if (hits.length === 1) {
    return [hits, line]
} else {
    console.log('\x1B[96mSuggest:\x1B[00m')

    let list = ''
    let l = 0
    let c = ''
    let t = hits.length ? hits : completions

    for (let i = 0; i < t.length; i++) {
    c = t[i].replace(/(\s*)$/g, '')

    if (list !== '') {
        list += ', '
    }

    if (((list + c).length + 4 - l) > process.stdout.columns) {
        list += '\n'
        l = list.length
    }
    list += c
    }
    console.log('\x1B[96m' + list + '\x1B[00m')
    return [(line !== arg.line) ? [arg.line] : [], line]
}
}

const myRL = Serverline();

const rand = () => Math.floor(127 + Math.random() * 128); // Generates numbers from 127 to 255

var username = "anonymous"
var user_rgb = {r:rand(), g:rand(), b:rand()}
var room = ""

var publicKey = "";
var privateKey = "";
var encryptionKey = "";
var passphrase = "this is an example encryption key";
var ivSize = 16;
/**
 * generate asymmetric key pair
 */
function generateAsymmetricKeys(passphrase) {
    crypto.generateKeyPair('rsa', {
        modulusLength: 2048,  
        publicKeyEncoding: {
            type: 'spki',       
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',      
            format: 'pem',      
            cipher: 'aes-256-cbc',   
            passphrase
        }
    }, (err, publicKeyGenerated, privateKeyGenerated) => {
        if (err) {
            console.error(err);
            return;
        }
        publicKey = publicKeyGenerated
        privateKey = privateKeyGenerated
    });
}

/**
 * generate symmetric key for encrypting and decrypting keys
 */
function generateSymmetricKey(keyLength = 32) {
    const key = crypto.randomBytes(keyLength);
    return key.toString('hex');
}

/**
 * encrypts data using the symmetric key
 */
function encryptData(data, keyHex) {
    const key = Buffer.from(keyHex, 'hex'); // Convert hex string back to Buffer
    const iv = crypto.randomBytes(ivSize); // AES block size in bytes
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedOutput = iv.toString('hex') + encrypted; // Combine IV and encrypted data
    return encryptedOutput;
}
/**
 * decrypts data with the symmetric key
 */
function decryptData(encryptedOutput, keyHex) {
    try {
        const key = Buffer.from(keyHex, 'hex'); // Convert hex string back to Buffer
        const iv = Buffer.from(encryptedOutput.substring(0, 32), 'hex'); // Extract IV from combined output
        const encryptedData = encryptedOutput.substring(32); // Extract encrypted data
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return "???"
    }
}

generateAsymmetricKeys(passphrase);

/**
 * encrypts data using the asymmetric key pair
 */
function encryptDataAsymmetric(data, publicKey) {
    try {
        const buffer = Buffer.from(data, 'utf8');
        const encrypted = crypto.publicEncrypt(publicKey, buffer);
        return encrypted.toString('base64');
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

/**
 * decrypts data using the asymmetric key pair
 */
function decryptDataAsymmetric(encryptedData, privateKey, passphrase) {
    try {
        const buffer = Buffer.from(encryptedData, 'base64');
        const decrypted = crypto.privateDecrypt(
            {
                key: privateKey,
                passphrase: passphrase,
                //padding: crypto.constants.RSA_PKCS1_PADDING,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
            },
            buffer
        );
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * connect to host
 */
const host = await inquirer.prompt({name:"url", prefix:">", type:"input", message:"url", default(){return "http://localhost:9000"}})
var socket = io.connect(host.url, {reconnect: true});

/**
 * sleep x miliseconds. Default 2 seconds
 */
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

/**
 * rgb message
 * @param {r: int, g: int, b:int} rgb 
 * @param msg 
 * @returns encoding to color the string
 */
function colorMsg(rgb, msg) {
    const color = `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`; // Set foreground color
    const reset = `\x1b[0m`; // Reset to default colors
    return (`${color}${msg}${reset}`);
}

/**
 * clears the screen
 */
function clear_screen() {
    process.stdout.write('\x1Bc')
}

/**
 * get the name that the user wants
 */
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

/**
 * lets the user choose their color
 */
async function getColor(){
    console.log("press enter for random color")
    const red = await inquirer.prompt({
        name: 'val',
        prefix:chalk.red(">"),
        type: 'input',
        message: chalk.red('red: '),
        default(){
            return rand()
        }
    })
    const green = await inquirer.prompt({
        name: 'val',
        prefix:chalk.green(">"),
        type: 'input',
        message: chalk.green('green: '),
        default(){
            return rand()
        }
    })
    const blue = await inquirer.prompt({
        name: 'val',
        prefix:chalk.blue(">"),
        type: 'input',
        message: chalk.blue('blue: '),
        default(){
            return rand()
        }
    })
    user_rgb = {r:red.val, g:green.val, b:blue.val}
}

/**
 * creates the centred box with the info
 */
function printCenteredBox() {
    const boxWidth = 46; // Width of the box

    // Function to remove ANSI escape codes for length calculations
    function stripAnsi(str) {
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    // Function to create a line with centered text, ignoring ANSI codes
    function createLine(text) {
        const cleanText = stripAnsi(text); // Get text length without ANSI codes
        const padding = boxWidth - 2 - cleanText.length; // Calculate total padding needed
        const paddingLeft = Math.floor(padding / 2); // Padding on the left side
        const paddingRight = padding - paddingLeft; // Padding on the right side
        return `|${' '.repeat(paddingLeft)}${text}${' '.repeat(paddingRight)}|\n`;
    }

    // Welcome message with color
    const welcomeMsg = `welcome ${colorMsg(user_rgb, username)}`;
    const idMsg = `id: \x1b[35m${socket.id}\x1b[0m`;
    const rgbMsg = `rgb: (${user_rgb.r} ${user_rgb.g} ${user_rgb.b})`;

    return ("+--------------------------------------------+\n") +
    (createLine(welcomeMsg)) +
    (createLine(idMsg)) + 
    (createLine(rgbMsg)) + 
    ("+--------------------------------------------+\n");
}

/**
 * menu screen
 */
async function menu(){
    clear_screen()
    const input = await inquirer.prompt({
        name:"menu",
        type:"list",
        prefix:printCenteredBox(),
        message:"Select an action\n",
        choices:[
            "join room",
            "settings",
            "exit program",
        ]
    });
    switch (input.menu){
        case "settings":
            await settings();
            return;
        case "join room":
            var ui = await inquirer.prompt({name:"room", prefix:"\x1b[36m>\x1b[0m", type:"input", message:"room:"});
            room = ui.room;
            if (!room){
                room = "general";
            }
            var pass = await inquirer.prompt({name:"pass", prefix:chalk.green(">"), type:"password", mask:"*", message:"pass:"});
            pass = pass.pass
            const spinner = createSpinner('verifying...').start();
            socket.emit("join", {room, pass, username, publicKey}, (response, newName, key) =>{
                switch (response){
                    case 100:
                        spinner.error({text:chalk.red(`incorrect password for room "${room}"`)})
                        menu()
                        break;
                    case 200:
                        username = newName;
                        encryptionKey = decryptDataAsymmetric(key[0], privateKey, passphrase)
                        spinner.success({text:chalk.yellow(`successfully joined ${room}`)})
                        messenger()
                        break;
                    case 206:
                        encryptionKey = generateSymmetricKey();
                        spinner.success({text:chalk.yellow(`successfully joined ${room}`)})
                        messenger()
                        break;
                    case 404:
                        spinner.error({text:chalk.red(`could not find room ${room}. Created a new room instead`)})
                        encryptionKey = generateSymmetricKey();
                        messenger()
                        break;
                    default:
                        spinner.error({text:chalk.red(`an unknown issue occured when connecting to "${room}"`)})
                        menu()
                }
            })
            break;
        case "exit program":
            process.exit(1);
    }
}

/**
 * settings screen
 */
async function settings() {
    clear_screen()
    const input = await inquirer.prompt({
        name:"menu",
        type:"list",
        prefix:printCenteredBox(),
        message:"Select an action\n",
        choices:[
            "change username",
            "change color",
            "load settings",
            "load keys",
            "generate keys",
            "export settings",
            "back"
        ]
    });
    switch (input.menu){
        case "load settings":
            var res = await inquirer.prompt({name:"file", prefix:"\x1b[36m>\x1b[0m", type:"input", message:"file:"});
            var data = readJsonFile(res.file)
            if (data) {
                username = data?.username ? data.username : username
                user_rgb = data?.rgb ? data.rgb : user_rgb
                privateKey = data?.privateKey ? data.privateKey : privateKey
                privateKey = data?.publicKey ? data.publicKey : publicKey
            }
            await settings();
            return;
        case "change color":
            await getColor()
            await settings()
            return;
        case "change username":
            await getName();
            await settings();
            return;
        case "load keys":
            var publicKeyPath = await inquirer.prompt({name:"file", prefix:"\x1b[36m>\x1b[0m", type:"input", message:"public:"});
            var privateKeyPath = await inquirer.prompt({name:"file", prefix:"\x1b[36m>\x1b[0m", type:"input", message:"private:"});
            publicKey = fs.readFileSync(publicKeyPath.file, 'utf-8');
            privateKey = fs.readFileSync(privateKeyPath.file, 'utf-8');
            await settings();
            break;
        case "generate keys":
            var newPassphrase = await inquirer.prompt({name:"passphrase", prefix:chalk.green(">"), type:"password", mask:"*", message:"passphrase:"});
            passphrase = newPassphrase.passphrase
            generateAsymmetricKeys(passphrase)
            await settings();
            break;
        case "export settings":
            writeToFile("test.json", JSON.stringify({username, rgb:user_rgb, privateKey, publicKey}))
            await settings();
            break;
        case "back":
            await menu();
            return;
    }
}

function getNow(){
    var time = new Date().getTime()
    var hours = Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((time % (1000 * 60)) / 1000);
    return (hours<10 ? "0" : "") + hours + (minutes<10 ? ":0" : ":") + minutes + (seconds<10 ? ":0" : ":") + seconds   
}
var intervalid = null;

/**
 * message template
 */
function message_template(time, room, username, msg) {
    return `@~[${time}][${room}][${username}]#: ${msg}`
}
/**
 * where all the logic for messaging is handled
 */
async function messenger(){
    myRL.init(message_template(getNow(), room, colorMsg(user_rgb, username), ""));
    
    intervalid = setInterval(() => {
        myRL.setPrompt(message_template(getNow(), room, colorMsg(user_rgb, username), ""))
        myRL.getRL()._refreshLine()
    }, 1000);
    
    myRL.setCompletion(['!help', '!goto', '!name','!nick', '!exit', '!list', '!tell', '!cls', 'cls', 'goto', '!join'])
    myRL.on('line', async function(line) {
        var command = line.split("!")
        command.splice(0,1)
        switch (command[0]?.replace(" ", "")) {            
            case 'help':
                help_page();
                break;
            case 'nick':
            case 'name':
                set_name(command);
                break;
            case "whisper":
            case "tell":
            case 'dm':
                send_private_msg(command);
                break;
            case 'exit':
                process.exit(1)
            case 'cls':
                clear_screen();
                break;
            case "list":
                list_room();
                break;
            case "leave":
            case "menu":
                clearInterval(intervalid);
                intervalid = null;
                socket.emit("leave", room, username)
                myRL.close()
                clear_screen();
                await menu();
                return;
            case "pass":
                break;
            case "id":
                console.log(`\x1b[35m${socket.id}\x1b[0m`)
                break;
            default:
                if (line.charAt(0)==="!"){ //this is just so that it is possible to add new commands server side
                    socket.emit(command[0]?.replace(" ", ""), {room, username, line, user_rgb}, (response)=>{
                        eval(response)
                    })
                } 
                socket.emit("message", room, username, encryptData(line, encryptionKey), user_rgb);
                break;
        }
    });
    myRL.on('SIGINT', function(rl) {
        process.exit(1);
    });    
}

// -----------message commands---------------

function help_page() {
    console.log("Commands are currently an experimnetal feature.")
    console.log(`\x1b[36mpress tab to auto complete commands. Commands are not sent to other users
!help: To get this message. 
!name (alias: nick): to set a new name for yourself. Syntax: !name !%setName%.
!leave (alias: !menu): goes back to homescreen.
!exit: exits out of node-relay. You can also do ctr + c
!list: lists all users in the room.
!tell: privately sends a message. syntax !tell !name %name% !msg %msg%
!pass: sets a new password for the room. only available to room admins
!cls (alias: cls): clears entire screens
!id: prints your socket id
    \x1b[0m`);
}

function set_name(command) {
    socket.emit("set-name", {room, user:username, setUser:command[1]}, (response)=>{
        username = response
        console.log(`\x1b[36mchanged name to ${username}\x1b[0m`)
        myRL.setPrompt(message_template(getNow(), room, colorMsg(user_rgb, username), ""));
    })
}


function list_room() {
    socket.emit("list", room, (users) => {
        users.forEach(element => {
            console.log(element)
        });
    })
}

function send_private_msg(command) {
    if (command.length<3){
        console.log(`\x1b[31m2 arguments expected. Only had ${command.length}\x1b[0m`)
        return;
    }
    socket.emit("dm", {username, room:room, user:command[1].slice(0, -1), msg:encryptData(command[2], encryptionKey)}, (response)=>{
        switch(response){
            case 200:
                console.log(`\x1b[36mmessage successfully sent to ${command[1]}\x1b[0m`)
                break;
            case 404:
                console.log(`\x1b[31mcould not find user ${command[1]}\x1b[0m`)
                break;
        }
    })
}

const load = createSpinner('connecting...').start()

// ----------------socket events---------------------

socket.on("recieve", ({now, room, user, message, rgb})=>{
    console.log(message_template(now, room, colorMsg(rgb, user), decryptData(message, encryptionKey)))
})

socket.on("private", ({room, user, message})=>{
    console.log(message_template("\x1b[35mPRIVATE\x1b[0m", user, decryptData(message, encryptionKey)))
})


socket.on("new", (username)=>{
    console.log(chalk.yellow(`new client connected. Welcome ${username}`))
})

socket.on("leave", (user)=>{
    console.log(chalk.red(`${user} has left the room`))
})

socket.on('connect', () => {
    load.success({text:`\x1b[33msecure connection to server established\x1b[0m`});
    (async ()=>{
        if (myRL.getRL() != null) {
            myRL.close()
        }
        if (intervalid != null) {
            clearInterval(intervalid)
            intervalid = null;
        }
        clear_screen();
        await getName();
        await menu();
    })();
});

socket.on("request-key", ({id, foreignPublicKey}, callback) => {
    if (!encryptionKey) {
        encryptionKey = generateSymmetricKey();
    }
    var encryptedEncryptionKey = encryptDataAsymmetric(encryptionKey, foreignPublicKey)
    callback(encryptedEncryptionKey);
});

socket.on("disconnect", ()=>{
    console.log(colorMsg({r:255, g:0, b:0}, "disconnected from server"))
})