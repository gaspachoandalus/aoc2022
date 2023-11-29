import * as fs from "fs/promises"
import { listenerCount, mainModule } from "process";

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

    static measures: Array<{sensor: Vector, closest: Vector, distance?: number}>;
    static bounds: {min: Vector, max: Vector};

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        console.log("measures", this.measures);

        this.measures.map(c => {
            c.distance = this.distance(c.closest, c.sensor);
        })

        this.bounds = this.measures.reduce((p, c) => {
            p.min.x = Math.min(p.min.x, c.sensor.x - c.distance);
            p.min.y = Math.min(p.min.y, c.sensor.y - c.distance);
            p.max.x = Math.max(p.max.x, c.sensor.x + c.distance);
            p.max.y = Math.max(p.max.y, c.sensor.y + c.distance);
            return p;
        }, {min: {x: 0, y: 0}, max: {x: 0, y:0 }});

        console.log("measures", this.measures);
        console.log("bounds", this.bounds);
        // TODO

        return {
            part1: this.checkRow(2000000),
            // part1: this.checkRow(10),
            part2: 0
        };
    }

    static distance(v1: Vector, v2: Vector) {
        // return Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
        return Math.abs(v2.x - v1.x) + Math.abs(v2.y - v1.y);
    }

    static parse(lines: string[]): void {

        this.measures = lines.reduce((p, line) => {

            const splitted = line.split(" ");
            console.log("splitted", splitted);
            const measure = {
                sensor: {
                    x: parseInt(splitted[2].match(/[-]?\d+/)[0]),
                    y: parseInt(splitted[3].match(/[-]?\d+/)[0])
                },
                closest: {
                    x: parseInt(splitted[8].match(/[-]?\d+/)[0]),
                    y: parseInt(splitted[9].match(/[-]?\d+/)[0])
                }
            };
            p.push(measure);
            return p;
        }, []);
    }
    
    static checkRow(y: number) {
        let count = 0;
        for (let x = this.bounds.min.x; x <= this.bounds.max.x; x++) {

            // check if position is covered by at least one sensor
            const covered = this.measures.find(c => {
                return this.distance(c.sensor, {x,y}) <= c.distance;
            })

            if (!covered) continue;

            // for (const measure of this.measures) {
            //     if (this.distance(measure.sensor, {x, y}) <= measure.distance) {
            //         possible = false;
            //         break;
            //     }
            // }

            // console.log("considering", x, y);

            // check if position matches exactly a known beacon
            const exactMatch = this.measures.find(c => c.closest.x == x && c.closest.y == y);
            if (exactMatch) {
                // console.log("  => exact match");
                continue;
            }

            // check if position is not reachable by any sensor
            const inside = this.measures.find(c => this.distance(c.sensor, {x,y}) <= c.distance);

            if (inside) {
                // console.log("  => inside", inside.sensor.x, inside.sensor.y);
                count++;
            }
            else {
                // console.log("  => cannot contain a beacon");
            }
        }

        return count;
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
