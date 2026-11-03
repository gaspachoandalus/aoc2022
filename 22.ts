import { Vector, moves } from "./utils/vector.js";
import { Display2D } from "./utils/Display2D.js";

export type Status = {
    part1: number;
    part2: number;
}

export const config = {
    type: "2D"
};

interface PositionAndDirection {
    coords: Vector,
    direction: number
}

const links = [
    { // 1
        source: {
            x: 0,
            y: 150,
            horizontal: false
        },
        dest: {
            x: 50,
            y: 0,
            horizontal: true,
        },
        invert: false,
        rotation: -90
    },
    { // 2
        source: {
            x: 0,
            y: 200-1,
            horizontal: true
        },
        dest: {
            x: 100,
            y: 0,
            horizontal: true,
        },
        invert: false,
        rotation: 0
    },
    { // 3
        source: {
            x: 50-1,
            y: 150,
            horizontal: false
        },
        dest: {
            x: 50,
            y: 150-1,
            horizontal: true,
        },
        invert: false, 
        rotation: -90
    },
    { // 4
        source: {
            x: 0,
            y: 100,
            horizontal: false
        },
        dest: {
            x: 50,
            y: 0,
            horizontal: false,
        },
        invert: true,
        rotation: 180
    },
    { // 5
        source: {
            x: 0,
            y: 100,
            horizontal: true
        },
        dest: {
            x: 50,
            y: 50,
            horizontal: false,
        },
        invert: false, 
        rotation: 90
    },
    { // 6
        source: {
            x: 100-1,
            y: 100,
            horizontal: false
        },
        dest: {
            x: 150-1,
            y: 0,
            horizontal: false,
        },
        invert: true,
        rotation: 180
    },
    { // 7
        source: {
            x: 100-1,
            y: 50,
            horizontal: false
        },
        dest: {
            x: 100,
            y: 50-1,
            horizontal: true,
        },
        invert: false,
        rotation: -90
    }
];

export class AOC {

    display: Display2D;

    map: Array<{
        start: number,
        width: number,
        terrain: string
    }>;

    start: PositionAndDirection;

    directions: Array<string>;

    constructor(display: Display2D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        this.parse(lines);

        this.display
            .init(99)
            .setLayer(0, "Map")
            .setLayer(3, "Walker position")
            .setItems(this.map.map((v, y) => ({x: v.start, y, content: v.terrain})))
            .fitBounds({
                min: { x: this.start.coords.x - 10, y: this.start.coords.y - 10 },
                max: { x: this.start.coords.x + 11, y: this.start.coords.y + 11 }
            })
            .checkpoint();

        const pos = await this.followPath({...this.start});

        /**
         * Facing is 0 for right (>), 1 for down (v), 2 for left (<), and 3 for up (^). The final password is the sum of 1000 times the row, 4 times the column, and the facing.
         */

        const part2 = (pos.coords.y + 1) * 1000 + (pos.coords.x + 1) * 4 + (pos.direction);

        return {
            part1: 0,
            part2: part2
        };
    }

    item(coords: Vector): string {
        const line = this.map[coords.y];
        console.assert(line);
        const item = line.terrain.slice(coords.x - line.start, coords.x - line.start + 1)[0];
        console.assert(item);
        return item;
    }

    next(pos: PositionAndDirection): PositionAndDirection {

        const coords = pos.coords;
        const direction = pos.direction;

        const box = {
            x: Math.floor(coords.x / 50),
            y: Math.floor(coords.y / 50),
        };

        const next = {
            x: coords.x + moves[direction].x,
            y: coords.y + moves[direction].y
        }

        const nextBox = {
            x: Math.floor(next.x / 50),
            y: Math.floor(next.y / 50),
        }

        // no limit reached => continue
        if (!(box.x == nextBox.x && box.y == nextBox.y)) {
            // limit reached => check link
            for (let linkId = 0; linkId < links.length; linkId++) {
                const link = links[linkId];
                let posAndDirection: PositionAndDirection;

                posAndDirection = this.checkLink(direction, link, coords);
                if (posAndDirection) {
                    return posAndDirection;
                }

                posAndDirection = this.checkLink(direction, {source: link.dest, dest: link.source, invert: link.invert, rotation: -link.rotation}, coords);
                if (posAndDirection) {
                    return posAndDirection;
                }
            }
        }

        return { coords: next, direction: direction };
    }

    private checkLink(direction: number, link: { // 7
        source: { x: number; y: number; horizontal: boolean; }; dest: { x: number; y: number; horizontal: boolean; }; invert: boolean; rotation: number;
    }, coords: Vector): PositionAndDirection {

        const next = {x: 0, y: 0};

        let relativePos = 0;
        // move horizontally => check vertical links
        if (moves[direction].y == 0 && link.source.horizontal == false && coords.x == link.source.x && coords.y >= link.source.y && coords.y < link.source.y + 50) {
            relativePos = coords.y - link.source.y;
        }
        // move vertically => check horizontal links
        else if (moves[direction].x == 0 && link.source.horizontal == true && coords.y == link.source.y && coords.x >= link.source.x && coords.x < link.source.x + 50) {
            relativePos = coords.x - link.source.x;
        }
        else {
            return null;
        }

        if (link.invert)
            relativePos = 49 - relativePos;

        if (link.dest.horizontal) {
            /** example
             *                   ^
             *      |            |
             *  ----|---->   ---------
             *      |            |
             */
            next.x = link.dest.x + relativePos;
            next.y = link.dest.y;
        }
        else {
            /** example
             *      |            |
             *  ----|---->   <---|----
             *      |            |
             */
            next.x = link.dest.x;
            next.y = link.dest.y + relativePos;
        }

        return {
            coords: next,
            direction: ((direction + link.rotation / 90) % 4 + 4) % 4
        };
    }

    async moveOneStep(pos: {coords: Vector, direction: number}, move: string): Promise<{coords: Vector, direction: number}> {

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
                const next = this.next(pos);
                if (this.item(next.coords) != ".") {
                    break; // break early if we can't move
                }
                pos = { coords: {...next.coords}, direction: next.direction };
                distance--;

                await this.display
                    .setItems([{...pos.coords, content: " "}], 3)
                    .scrollIntoView(pos.coords, false)
                    .checkpoint();

            }
        }

        return pos;
    }

    async followPath(pos: PositionAndDirection): Promise<PositionAndDirection> {
        for (const move of this.directions) {
            // console.log("moving:", move);
            pos = await this.moveOneStep(pos, move);
            // console.log("pos:", pos);
        }

        return pos;
    }


    mapNumber(n: number, min: number, max: number, newmin: number, newmax: number) {
        return (n - min) / (max - min) * (newmax - newmin) + newmin;
    }

    parse(lines: string[]): void {

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
}