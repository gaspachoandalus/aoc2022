import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';
import { Vector, moves, distance, vectorAsString, mod, display, sleep } from "./utils/vector.js";
import { Terminal } from "./utils/DisplayTerminal2D.js";

const MIN_COORDS = 0;
const MAX_COORDS = 4_000_000
const ROW_TO_CHECK = 2_000_000

export type Status = {
    part1: number;
    part2: number;
}

interface Measure {
    sensor: Vector;
    closest: Vector;
    distance?: number;
}

export class AOC {

    static measures: Array<Measure>;
    static bounds1: {min: Vector, max: Vector};
    static bounds: {min: Vector, max: Vector};

    static async Run(lines: string[]): Promise<Status | undefined> {

        this.parse(lines);

        console.log("measures", this.measures);

        this.measures.map(c => {
            c.distance = this.distance(c.closest, c.sensor);
        })
        console.log("measures", this.measures);

        // calc global bounds
        this.bounds1 = this.measures.reduce((p, c) => {
            p.min.x = Math.min(p.min.x, c.sensor.x - c.distance);
            p.min.y = Math.min(p.min.y, c.sensor.y - c.distance);
            p.max.x = Math.max(p.max.x, c.sensor.x + c.distance);
            p.max.y = Math.max(p.max.y, c.sensor.y + c.distance);
            return p;
        }, {min: {x: 0, y: 0}, max: {x: 0, y:0 }});
        console.log("bounds1", this.bounds1);

        // calc limited bounds part 2
        this.bounds = {
            min: {
                x: Math.max(this.bounds1.min.x, MIN_COORDS),
                y: Math.max(this.bounds1.min.y, MIN_COORDS)
            },
            max: {
                x: Math.min(this.bounds1.max.x, MAX_COORDS),
                y: Math.min(this.bounds1.max.y, MAX_COORDS)
            }
        }
        console.log("bounds", this.bounds);

        if (MAX_COORDS < 100)
            this.displayMap();

        await this.saveMapAsSVG();

        const part2 = this.part2();

        return {
            part1: this.cannotContain(ROW_TO_CHECK),
            part2: part2.x * 4_000_000 + part2.y
        };
    }

    static part2(): Vector {
        return this.measures.reduce((p, c) => {
            if (p) return p;
            const match = this.perimeter(c);
            return match;
        }, null as Vector);
    }

    static perimeter(measure: Measure): Vector {
        for (let y = measure.sensor.y - measure.distance - 1;
            y < measure.sensor.y + measure.distance + 1;
            y++) {
                let distX = measure.distance + 1 - Math.abs(y - measure.sensor.y);

                const left = {x: measure.sensor.x - distX, y};
                const right = {x: measure.sensor.x + distX, y};

                if (left.x >= MIN_COORDS && left.x <= MAX_COORDS && left.y >= MIN_COORDS && left.y <= MAX_COORDS) {
                    // console.log("check left", left);
                    const isNotCovered = !this.isCovered(left);
                    if (isNotCovered) {
                        console.log("found", left);
                        return left;
                    }
                }
                if (right.x >= MIN_COORDS && right.x <= MAX_COORDS && right.y >= MIN_COORDS && right.y <= MAX_COORDS) {
                    // console.log("check right", right);
                    const isNotCovered = !this.isCovered(right);
                    if (isNotCovered) {
                        console.log("found", right);
                        return right;
                    }
                }
            }
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

    static displayMap()
    {
        const PAD = 2;
        console.log("display", " ".repeat(2), [...Array(this.bounds.max.x - this.bounds.min.x + 1).keys()].map(c => c.toString().padStart(PAD)).join(" "));
    
        for (let y = this.bounds.min.y; y <= this.bounds.max.y; y++) {
            let line = [];
            for (let x = this.bounds.min.x; x <= this.bounds.max.x; x++) {
                const isAtSensorPerimeter = this.isAtSensorPerimeter({x,y});
                const isCovered = this.isCovered({x,y});
                line.push((isCovered ? "#" : " ").repeat(PAD+1));
            }
            console.log("display", y.toString().padStart(PAD), line.join(""));
        }
    }

    static mapNumber(n: number, min: number, max: number, newmin: number, newmax: number) {

        return (n / (max-min) * (newmax-newmin)) + newmin;
    }

    static async saveMapAsSVG()
    {
        let svg = `<svg viewBox="${this.bounds1.min.x} ${this.bounds1.min.y} ${this.bounds1.max.x - this.bounds1.min.x} ${this.bounds1.max.y - this.bounds1.min.y}" xmlns="http://www.w3.org/2000/svg">`;
        // this.measures.map(v => `<circle cx="${v.sensor.x}" cy="${v.sensor.y}" r="${v.distance}"/>`).forEach(v => console.log(v));
        
        svg += this.measures
            .sort((a, b) => a.distance - b.distance)
            .map((v, i, a) => {
                const points = [
                    {
                        x: v.sensor.x,
                        y: v.sensor.y - v.distance
                    },
                    {
                        x: v.sensor.x + v.distance,
                        y: v.sensor.y
                    },
                    {
                        x: v.sensor.x,
                        y: v.sensor.y + v.distance
                    },
                    {
                        x: v.sensor.x - v.distance,
                        y: v.sensor.y
                    }
                ];

            const transparency = Math.floor(this.mapNumber(i, 0, a.length, 100, 255));
            const backgroundColor = Math.floor(this.mapNumber(i, 0, a.length, 0, 255 * 255 * 255));
            const color = Math.floor(this.mapNumber(i, 0, a.length, 0, 255 * 255 * 255));

            return `<polygon points="${points.map(c => `${c.x} ${c.y}`).join(",")}" fill="#${backgroundColor.toString(16).padStart(6, "0")}" fill-opacity="0.75" />`;

        } )
        .join("\n");

        svg += `<rect x="0" y="0" width="${this.bounds.max.x}" height="${this.bounds.max.y}" stroke="red" stroke-width="1000" fill="red" fill-opacity="0.2" />`;
        svg += '</svg>';

        await fs.writeFile("input.svg", svg, {
            "encoding": "utf8",
            "flag": "w"
        });
    }

    static isAtSensorPerimeter(pos: Vector) {
        return this.measures.find(c => {
            return this.distance(c.sensor, pos) == c.distance;
        })
    }

    static isCoveredBy(pos: Vector): number {
        return this.measures.filter(c => this.distance(c.sensor, pos) <= c.distance).length;
    }

    static isCovered(pos: Vector) {
        return this.measures.find(c => {
            return this.distance(c.sensor, pos) <= c.distance;
        })
    }

    static findNotCovered(y: number): Vector {
        for (let x = this.bounds.min.x; x <= this.bounds.max.x; x++) {

            const covered = this.isCovered({x,y});

            if (!covered) {
                return {x,y};
            }
        }
    }

    static cannotContain(y: number) {
        let count = 0;
        for (let x = this.bounds.min.x; x <= this.bounds.max.x; x++) {

            // check if position is covered by at least one sensor
            const covered = this.isCovered({x,y});

            if (covered) {
                count++;
                continue;
            };

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