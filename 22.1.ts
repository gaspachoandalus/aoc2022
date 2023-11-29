import * as fs from "fs/promises"

const INPUT = "./input.txt";
// const INPUT = "./testInput.txt";

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

interface PositionAndDirection {
    coords: Vector,
    direction: number
}

const moves: Array<Vector> = [
    { x:  1, y:  0 }, // right
    { x:  0, y:  1 }, // down
    { x: -1, y:  0 }, // left
    { x:  0, y: -1 }  // top
];

export class Problem {

    static map: Array<{
        start: number,
        width: number,
        terrain: string
    }>;

    static start: PositionAndDirection;

    static directions: Array<string>;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        console.log("map", this.map);
        console.log("directions", this.directions);
        console.log("start", this.start);

        const pos = this.followPath({...this.start});

        console.log("end", pos);

        /**
         * Facing is 0 for right (>), 1 for down (v), 2 for left (<), and 3 for up (^). The final password is the sum of 1000 times the row, 4 times the column, and the facing.
         */

        const part1 = (pos.coords.y + 1) * 1000 + (pos.coords.x + 1) * 4 + (pos.direction);

        return {
            part1: part1,
            part2: 0
        };
    }

    static item(coords: Vector): string {
        const line = this.map[coords.y];

        return line.terrain.slice(coords.x - line.start, coords.x - line.start + 1)[0];
    }

    static next(coords: Vector, direction: number): Vector {

        const next = {
            x: coords.x + moves[direction].x,
            y: (coords.y + moves[direction].y + this.map.length) % this.map.length
        }

        if (moves[direction].y == 0) { // move horizontally
            if (moves[direction].x == 1) { // right
                if (next.x == this.map[next.y].start + this.map[next.y].width) {
                    next.x = this.map[next.y].start;
                }
            }
            else if (moves[direction].x == -1) { // left
                if (next.x == this.map[next.y].start - 1) {
                    next.x = this.map[next.y].start + this.map[next.y].width - 1;
                }
            }
        }
        else // move vertically
        {
            if (moves[direction].y == 1) { // down

                while (next.x < this.map[next.y].start || next.x >= this.map[next.y].start + this.map[next.y].width) {
                    next.y = (next.y + 1) % this.map.length; // find next possible line
                }
            }
            else if (moves[direction].y == -1) { // up

                while (next.x < this.map[next.y].start || next.x >= this.map[next.y].start + this.map[next.y].width) {
                    next.y = (next.y - 1 + this.map.length) % this.map.length; // find next possible line
                }
            }
        }

        return next;
    }

    static moveOne(pos: {coords: Vector, direction: number}, move: string): {coords: Vector, direction: number} {

        pos = {...pos};

        if (move == "R") {
            pos.direction = (pos.direction + 1) % moves.length;
        }
        else if (move == "L") {
            pos.direction = (pos.direction - 1 + moves.length) % moves.length;
        }
        else {
            let distance = parseInt(move);
            
            while (distance > 0) {
                const next = this.next(pos.coords, pos.direction);
                if (this.item(next) != ".") {
                    break; // break early if we can't move
                }
                pos.coords = next;
                distance--;
            }
        }

        return pos;
    }

    static followPath(pos: PositionAndDirection): PositionAndDirection {
        for (const move of this.directions) {
            pos = this.moveOne(pos, move);
            console.log("moved", move, pos, moves[pos.direction]);
        }

        return pos;
    }

    static parse(lines: string[]): void {

        this.map = lines.reduce((p, c, index, array) => {

            if (index == array.length - 2) {
                // ante-penultiem is empty
            }
            else if (index == array.length - 1) {
                // 10R5L5R10L4R5L5
                const directions = [];
                for (const dir of c.matchAll(/(\d+)|(R|L)/g)) {
                    // console.log(dir);
                    directions.push(dir[0]);
                }
                this.directions = directions;
            }
            else {
                const match = c.match(/(\s*)([.#]+)/);
                const space = match[1].length;
                const terrain = match[2];
                p.push({
                    start: space,
                    width: terrain.length,
                    terrain: terrain
                });
            }

            return p;
        }, []);

        this.start = {
            coords: {
                x: this.map[0].start,
                y: 0
            },
            direction: 0
        };
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
