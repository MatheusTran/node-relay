'use strict';

const cp = require('child_process');
var fs = require('fs');
const pro = require('process');


function indent(content) {
    return content.replaceAll("\n", "\n    ")
}

function print(msg) {
    return `(echo "${msg}")`
}

function assert(...children) {
    return(
`(assert
${children.join("\n")}
)`
    )
}

function op(operator, ...children) {
    return(
`(${operator}
    ${indent(children.join("\n"))}
)`
    )
}

function not(children) {
    return(`(not ${children})`)
}

function declare(variable, type) {
    return (`(declare-const ${variable} ${type})`)
}

function loop(start=0, end, fun) {
    return [...Array(end-start).keys()].map(n=>n+start).map(fun).filter(x => x).join("\n")
}

function getout() {
    return(
`
(check-sat)
(get-model)
`
    )
}

function format(content) {
    const vals = [...new Set([...content.matchAll(/ ([0-9]+)/g)].filter(i=>i!="").map(i=>+i[0]))].sort((a,b)=>b-a)
    
    vals.map(i=>{
        content = content.replaceAll(` ${i}`, ` \x1b[35m${i}\x1b[0m`)
    })
    content = content.replaceAll("(", "\x1b[36m(\x1b[0m")
    content = content.replaceAll(")", "\x1b[36m)\x1b[0m")
    content = content.replaceAll("ite", "\x1b[33mite\x1b[0m")
    content = content.replaceAll("sat", "\x1b[32msat\x1b[0m")
    content = content.replaceAll("un\x1b[32msat", "\x1b[31munsat")
    content = content.replaceAll("error", "\x1b[31merror\x1b[0m")
    content = content.replaceAll("true", "\x1b[32mtrue\x1b[0m")
    content = content.replaceAll("false", "\x1b[31mfalse\x1b[0m")
    content = content.replaceAll("and", "\x1b[33mand\x1b[0m")
    content = content.replaceAll("Int", "\x1b[35mInt\x1b[0m")
    content = content.replaceAll("define-fun", "\x1b[33mdefine-fun\x1b[0m")
    
    return content
}

function run(file) {
    cp.exec(`z3 ${file}`, async (error, stdout, stderr) => {
        if (error) {
            console.log(stderr)
            console.log(format(stdout))
            pro.exit()
        }
        if (args[3] === "True") {
            var table = []
            const xCooregex = /(?<=x!1 )[0-9]*/g
            const yCooregex = /(?<=x!0 )[0-9]*/g
            const valuesRegex = /(?<=\(ite \(and \(= x!0 [0-9]\) \(= x!1 [0-9]\)\) )[0-9]*/g
            const xCoors = [...stdout.matchAll(xCooregex)].filter(i=>i!="").map(i=>+i[0]);
            const yCoors = [...stdout.matchAll(yCooregex)].filter(i=>i!="").map(i=>+i[0]);
            const values = [...stdout.matchAll(valuesRegex)].filter(i=>i).map(i=>+i[0])
            var defVal = +stdout.match(/      [0-9]/)[0]
            for (var y = 0; y < Math.max(...yCoors) + 1; y++) {
                table.push([...Array(Math.max(...xCoors) + 1).keys()].map(i=>defVal))
            }
            
            for (var coor = 0; coor < xCoors.length; coor++) {
                table[yCoors[coor]][xCoors[coor]] = values[coor] 
            }

            console.table(table)
        } else {
            console.log(format(stdout))
        }
    })
}

function compile(file, ...content) {
    fs.writeFileSync(file, content.join("\n"), err=>{console.log(err)})
    console.log(`\x1b[32msuccessfully compiled to \x1b[35m"${file}"\x1b[0m`)
    run(file)
}


class Grid {
    constructor(name, x,y, type) {
        this.name = name
        this.width = x
        this.height = y
        this.type = type
    }

    coor(x,y) {
        return `${this.name}_${x}${y}`
    }

    declare() {
        return [...Array(this.width).keys()].map(x=>(
            [...Array(this.height).keys()].map(y=>(
                `(declare-const ${this.name}_${x}${y} ${this.type})`
            )).join("\n")
        )).join("\n")
    }
}

class Function {
    constructor(name, type) {
        this.name = name
        this.type = type
    }

    declare(...args) {
        return `(declare-fun ${this.name} (${args.join(" ")}) ${this.type})`
    }

    val(...args) {
        return `(${this.name} ${args.join(" ")})`
    }
}

var args = process.argv
if (args[2].match(".z4")){
    var contents = fs.readFileSync(args[2],'utf-8');
    eval(contents)
} else {
    run(args[2])
}