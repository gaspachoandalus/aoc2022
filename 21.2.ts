import * as fs from "fs/promises"

// const INPUT = "./testInput.txt";
const INPUT = "./input.txt";

export class Input {

    static async ReadAll(): Promise<string> {
        const buffer = await fs.readFile(INPUT);
        return buffer.toString("utf-8");
    }

    static async ReadLines(): Promise<string[]> {
        return (await this.ReadAll()).split("\n");
    }
}

export type Status = {
    part1: number;
    part2: number;
}

interface Vector {
    x: number,
    y: number
}

const moves: Array<Vector> = [
    { x:  1, y:  0 },
    { x: -1, y:  0 },
    { x:  0, y:  1 },
    { x:  0, y: -1 }
];

const oppositeOp = {
    "+": "-",
    "*": "/",
    "-": "+",
    "/": "*",
};

export class Problem {

    static jobs: Map<string, {left: string, op: string, right: string}>;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        console.log("jobs", this.jobs);

        console.log("operation", this.operation("root"));

        const rpn = this.rpn("root");
        console.log("rpn");
        console.dir(rpn, { depth: null, maxArrayLength: null });

        // resolve
        rpn.pop(); // ==
        let number = rpn.pop(); // right value
        console.log("resolve number", number);
        while (rpn.length > 0) {
            const op = rpn.pop();
            const right = rpn.pop();

            if (typeof number == "number" && typeof right == "number") {
                switch (op) {
                    case "+": number = number - right; break;
                    case "-": number = number + right; break;
                    case "*": number = number / right; break;
                    case "/": number = number * right; break;
                }
            }

            console.log("resolve op", op, right, "=", number);

        }
        console.log("result", number);
    
        return {
            part1: 0,
            part2: 0
        };
    }

    static parse(lines: string[]): void {

        /**
root: pppw + sjmn
dbpl: 5
cczh: sllz + lgvd
zczc: 2
ptdq: humn - dvpt
dvpt: 3
         */
        this.jobs = lines.reduce((p, c) => {
            const [who, left, op, right] = c.split(" ");
            p.set(who.slice(0, who.length - 1), {
                left, // could be a number
                op,
                right
            });
            return p;
        }, new Map<string, {left: string, op: string, right: string}>())
    }

    static rpn(name: string): Array<string | number> {

        const list = [];
        const job = this.jobs.get(name);

        if (name == "humn") {
            return [ "humn" ];
        }

        if (job.op == undefined)
            return [ parseInt(job.left) ];

        let left = this.rpn(job.left);
        let right = this.rpn(job.right);

        if (name == "root") {
            //return `${left} == ${right}`
            // console.log("left", left)
            // console.log("right", right);
            return [...left, ...right, "=="];
        }

        let result;
        if (left.length == 1 && typeof left[0] == "number" && right.length == 1 && typeof right[0] == "number") {
            const leftN = left[0];
            const rightN = right[0];
            switch (job.op) {
                case "*": result = leftN * rightN; break;
                case "-": result = leftN - rightN; break;
                case "+": result = leftN + rightN; break;
                case "/": result = leftN / rightN; break;
            }
            return [ result ];
        }
        else 
        {
            let result;
            if (right.length > left.length) {
                if (job.op == "*" || job.op == "+") {
                    result = list.concat(...right, ...left, job.op);
                }
                else if (job.op == "-") {
                    result = list.concat(...right, -1, "*", ...left, "+");
                }
            }
            if (result == null) {
                result = list.concat(...left, ...right, job.op)
            }
            // console.log("ret", result);
            return result;
        }
    }

    static operation(name: string): string {
        const job = this.jobs.get(name);

        if (name == "humn") {
            return "humn";
        }

        if (job.op == undefined)
            return job.left;

        const left = this.operation(job.left);
        const right = this.operation(job.right);

        if (name == "root") {
            return `${left} == ${right}`
        }

        let result;
        if (left.match(/^\d+$/) && right.match(/^\d+$/)) {
            switch (job.op) {
                case "*": result = parseInt(left) * parseInt(right); break;
                case "-": result = parseInt(left) - parseInt(right); break;
                case "+": result = parseInt(left) + parseInt(right); break;
                case "/": result = parseInt(left) / parseInt(right); break;
            }

            return result.toString();
        }

        return `(${left}${job.op}${right})`
    }

    static explore(name: string, humn: number): number {
        const job = this.jobs.get(name);

        if (job.op == undefined)
            return parseInt(job.left);

        if (name == "root") {
            return this.explore(job.right, humn) - this.explore(job.left, humn);
        }
        // else if (name = "humn") {
        //     return humn;
        // }

        switch (job.op) {
            case "*": return this.explore(job.left, humn) * this.explore(job.right, humn);
            case "+": return this.explore(job.left, humn) + this.explore(job.right, humn);
            case "-": return this.explore(job.left, humn) - this.explore(job.right, humn);
            case "/": return this.explore(job.left, humn) / this.explore(job.right, humn);
        }

        throw new Error("unknown operation " + job.op);
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
