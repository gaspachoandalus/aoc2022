import { Display3D, Colors } from "./utils/Display3D.js";
import { Vector, distance, mod, moves, vectorAsString } from "./utils/vector.js";

export type Status = {
    part1: number;
    part2: number;
}

enum Layers {
    current = 0,
    blizzards = 2,
    path = 3,
    solutions = 4
}

const blizzardDirections: Record<string, Vector> = {
    ">": { x:  1, y:  0 },
    "<": { x: -1, y:  0 },
    "v": { x:  0, y:  1 },
    "^": { x:  0, y: -1 }
};

export const config = {
    type: "3D"
};

export class Problem {

    blizzards: Array<{start: Vector, direction: Vector, symbol: string}>;
    start: Vector;
    end: Vector;
    size: Vector;
    blizzardsAt: Array<Map<string, {x: number, y: number, count: number, content?: string}>> = [];
    display: Display3D;

    constructor(display: Display3D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        this.display.init(100);
        this.display.setStyle(0, { color: Colors.orange, name: "blizzards" })
        this.display.setStyle(1, { color: Colors.green, name: "queue" })
        this.display.setStyle(2, { color: Colors.blue, name: "current path" })
        this.display.setStyle(3, { color: Colors.yellow, name: "current path head" })
        this.display.setStyle(4, { color: Colors.red, name: "solutions" })
        this.display.start();

        this.parse(lines);

        this.display.setBox(this.end.x, this.end.y, 0);

        let [count1, path1] = await this.bfs(this.start, 0, [], this.end);         // first run
        let [count2, path2] = await this.bfs(this.end, count1, [], this.start);    // go back to the start (to get snacks)
        let [count3, path3] = await this.bfs(this.start, count2, [], this.end);    // reach the goal again

        return {
            part1: count1,
            part2: count3
        };
    }

    blizzardPosAtTime(blizzard: {start: Vector, direction: Vector}, depth: number): Vector {
        return {
            x: mod(blizzard.start.x + (blizzard.direction.x * depth), this.size.x),
            y: mod(blizzard.start.y + (blizzard.direction.y * depth), this.size.y)
        };
    }

    highestMinute: number = 0;

    async bfs(pos: Vector, startMinute: number, startPath: Array<Vector>, end: Vector): Promise<[number, Array<Vector>]> {

        const visited = new Map<string, Vector>();

        let deque = [ { pos, minute: startMinute, path: [{...pos, z: startMinute}] } ];
        let best = null;

        let lastDisplayedMinute = -1;

        while (deque.length > 0) {

            // get first position from the queue
            let { pos, minute, path } = deque.shift();

            // explore next minute
            minute++;

            // build blizzards map at round
            if (this.blizzardsAt[minute] == null) {
                this.blizzardsAt[minute] = new Map<string, {x: number, y: number, count: number, content: string}>();
                for (const blizzard of this.blizzards) {
                    let blizzardPos = this.blizzardPosAtTime(blizzard, minute);

                    const value = this.blizzardsAt[minute].get(vectorAsString(blizzardPos))?.count ?? 0;
                    this.blizzardsAt[minute].set(vectorAsString(blizzardPos), { ...blizzardPos, count: (value+1) });
                }
            }

            // display current path
            this.display.clear(2);
            for (const element of path) {
                this.display.addBlock(element.x, element.y, element.z, 2);
            }

            // display deque nodes
            this.display.clear(1);
            for (const i of deque.values()) {
                this.display.addBlock(i.pos.x, i.pos.y, i.minute, 1);
            }

            // display head
            this.display.clear(3)
            this.display.addBlock(pos.x, pos.y, minute, 3);
            
            if (lastDisplayedMinute != minute) {

                // this.display.center(0);
                
                // Terminal.setItems(this.blizzardsAt[minute].values(), Layers.blizzards)
                
                if (minute > this.highestMinute) {
                    this.display.setBox(undefined, undefined, minute);
                //     this.display.clear(0)
                //     for (const item of this.blizzardsAt[minute].values()) {
                //         this.display.addBlock(item.x, item.y, minute, 0);
                //     }

                    this.highestMinute = minute;
                }

                // this.display.throttle();
                lastDisplayedMinute = minute;
            }

            await this.display.throttle();

            this.display.center(pos.x, pos.y, minute);

            // await this.display
                // .setTitle(`minute ${minute}, list ${deque.length}, visited ${visited.size}`)
                // .setItems(path, Layers.path)
                // .setItems([pos], Layers.current)
                // .throttle();

            // positions to check (4 around + current)
            const availablePositions = moves
                .concat({x: 0, y: 0}) // add "wait" => stay in same position
                .map( v => ({x: pos.x + v.x, y: pos.y + v.y}) )
                .filter(v => 
                    (v.x >= 0 && v.x < this.size.x && v.y >= 0 && v.y < this.size.y) ||
                    (v.x == this.start.x && v.y == this.start.y) ||
                    (v.x == this.end.x   && v.y == this.end.y)
                )
                .filter(v => !this.blizzardsAt[minute].has(vectorAsString(v)))
                .filter(v => !visited.has(`${vectorAsString(v)}_${minute}`))
                // nearest from end comes first
                .sort((a, b) => distance(a, end) - distance(b, end));

            for (const v of availablePositions) {

                if (v.x == end.x && v.y == end.y) {

                    // new best
                    if (null == best || minute < best[0]) {
                        this.display.log(`solution: ${minute}`);
                        best = [minute, [...path]];

                        // add solution
                        this.display.clear(4);
                        for (const i in path) {
                            this.display.addBlock(path[i].x, path[i].y, path[i].z, 4);
                        }
                    }

                    // return [minute, [...path]];
                }
                else {
                    visited.set(`${vectorAsString(v)}_${minute}`, {...v});
                    deque.push({pos: {...v}, minute, path: path.concat([{...v, z: minute}])});
                }
            }

            // sort deque nearest from end first
            deque.sort((a, b) => distance(a.pos, end) - distance(b.pos, end));
            if (best) {
                deque = deque.filter(item => (item.minute + distance(item.pos, end)) < best[0]);
            }
        }

        this.display.log(`best: ${best[0]}`);
        return best;
    }

    parse(lines: string[]): void {

        this.blizzards = lines.reduce((p, c, y) => {
            c.split("").forEach((v, x) => {
                if (v != "." && v != "#") {
                    p.push({start: {x: x - 1, y: y - 1}, direction: blizzardDirections[v], symbol: v});
                }
            });
            return p;
        }, new Array<{start: Vector, direction: Vector, symbol: string}>());

        this.size = {x: lines[0].length - 2, y: lines.length - 2};
        this.start = {x: 0, y: -1};
        this.end = {x: this.size.x - 1, y: this.size.y };
    }
}

