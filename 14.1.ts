import * as fs from "fs/promises"

export class Input {

    static async ReadAll(): Promise<string> {
        const buffer = await fs.readFile("./input.txt");
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

    static map = new Map<string, boolean>()
    static start: Vector = {x: 500, y: 0};
    static lowest: number = 0;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        const part1 = this.pour();

        return {
            part1: part1,
            part2: 0
        };
    }

    static getCoordsKey(x: number, y: number) {
        return `${x},${y}`;
    }

    static pour(): number {
        let count = 0;

        while (this.pourOne() != undefined) {
            count++;
        }

        return count;
    }

    static pourOne() {
        let pos = { ...this.start };

        for(;;)
        {
            if (pos.y > this.lowest) {
                return undefined;
            }
            else if (this.map.get(this.getCoordsKey(pos.x, pos.y + 1)) == null) {
                pos.y++;
            }
            else if (this.map.get(this.getCoordsKey(pos.x - 1, pos.y + 1)) == null) {
                pos.x = pos.x - 1;
                pos.y = pos.y + 1;
            }
            else if (this.map.get(this.getCoordsKey(pos.x + 1, pos.y + 1)) == null) {
                pos.x = pos.x + 1;
                pos.y = pos.y + 1;
            }
            else {
                //stuck
                this.map.set(this.getCoordsKey(pos.x, pos.y), true);
                return 0;
            };
        }
    }


    static parse(lines: string[]): void {

        lines.forEach(line => line.split(" -> ").map(coords => coords.split(",").map(coord => parseInt(coord)))
        .reduce((p, c) => {
            if (p == null) {
                console.log("init", c);
                this.map.set(this.getCoordsKey(c[0], c[1]), true);
                this.lowest = Math.max(this.lowest, c[1]);
            }
            if (p != null) {
                console.log("current", c);
                const pos: Vector = { x: p[0], y: p[1]};
                console.log("pos", p);
                const direction: Vector = {
                    x: Math.sign(c[0] - p[0]),
                    y: Math.sign(c[1] - p[1])
                }
                console.log("direction", direction);
                while (pos.x != c[0] || pos.y != c[1]) {
                    pos.x += direction.x;
                    pos.y += direction.y;
                    this.map.set(this.getCoordsKey(pos.x, pos.y), true);
                    this.lowest = Math.max(this.lowest, pos.y);
                    console.log("filled", pos);
                }
            }
            return c;
        }, null));

        console.log("lowest", this.lowest);
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
