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

export class Problem {

    static jobs: Map<string, {left: string, op: string, right: string}>;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        console.log(this.jobs);
        console.log(this.explore("root"));

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

    static explore(name: string): number {
        const job = this.jobs.get(name);

        if (job.op == undefined)
            return parseInt(job.left);

        switch (job.op) {
            case "*": return this.explore(job.left) * this.explore(job.right);
            case "+": return this.explore(job.left) + this.explore(job.right);
            case "-": return this.explore(job.left) - this.explore(job.right);
            case "/": return this.explore(job.left) / this.explore(job.right);
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
