import { Display3D, Colors } from "./utils/Display3D.js";
import { Vector, distance, mod, moves, vectorAsString } from "./utils/vector.js";

export type Status = {
    part1: number;
    part2: number;
}

type TimedPosition = Vector & { z: number };

enum Layers {
    blizzards = 0,
    searchFrontier = 1,
    candidatePath = 2,
    current = 3,
    bestRoute = 4,
    trip1 = 5,
    trip2 = 6,
    trip3 = 7
}

const blizzardDirections: Record<string, Vector> = {
    ">": { x:  1, y:  0 },
    "<": { x: -1, y:  0 },
    "v": { x:  0, y:  1 },
    "^": { x:  0, y: -1 }
};

export const config = {
    type: "3D",
    cameraFollow: {
        distanceMultiplier: 3,
        // Equal +Y elevation and +Z offset give a 45° downward view.
        positionDirection: [0, 1, 1] as const
    }
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
        this.display.setStyle(Layers.blizzards, { color: Colors.orange, name: "Blizzards" })
        this.display.setStyle(Layers.searchFrontier, { color: Colors.green, name: "Search frontier" })
        this.display.setStyle(Layers.candidatePath, { color: Colors.blue, name: "Candidate route" })
        this.display.setStyle(Layers.current, { color: Colors.yellow, name: "Search position" })
        this.display.setStyle(Layers.bestRoute, { color: Colors.red, name: "Best route" })
        this.display.setStyle(Layers.trip1, { color: Colors.pink, name: "Path 1: start to exit" })
        this.display.setStyle(Layers.trip2, { color: Colors.white, name: "Path 2: exit to start" })
        this.display.setStyle(Layers.trip3, { color: Colors.green, name: "Path 3: start to exit" })
        this.display.start();

        this.parse(lines);

        const [count1, path1] = await this.bfs(this.start, 0, [], this.end);
        this.displayJourney(path1, Layers.trip1);
        await this.display.checkpoint();

        const [count2, path2] = await this.bfs(this.end, count1, [], this.start);
        this.displayJourney(path2, Layers.trip2);
        await this.display.checkpoint();

        const [count3, path3] = await this.bfs(this.start, count2, [], this.end);
        this.displayJourney(path3, Layers.trip3);

        for (const layer of [
            Layers.searchFrontier,
            Layers.candidatePath,
            Layers.current,
            Layers.bestRoute
        ]) {
            this.display.clear(layer);
        }
        await this.display.checkpoint();

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

    async bfs(pos: Vector, startMinute: number, startPath: Array<Vector>, end: Vector): Promise<[number, TimedPosition[]]> {

        const visited = new Map<string, Vector>();

        let deque = [ { pos, minute: startMinute, path: [{...pos, z: startMinute}] } ];
        let best = null;

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
            this.display.clear(Layers.candidatePath);
            for (const element of path) {
                this.display.addBlock(element.x, element.y, element.z, Layers.candidatePath);
            }

            // display deque nodes
            this.display.clear(Layers.searchFrontier);
            for (const i of deque.values()) {
                this.display.addBlock(i.pos.x, i.pos.y, i.minute, Layers.searchFrontier);
            }

            // display head
            this.display.clear(Layers.current)
            this.display.addBlock(pos.x, pos.y, minute, Layers.current);

            await this.display.checkpoint();

            this.display.center(pos.x, pos.y, minute);

            // await this.display
                // .setTitle(`minute ${minute}, list ${deque.length}, visited ${visited.size}`)
                // .setItems(path, Layers.path)
                // .setItems([pos], Layers.current)
                // .checkpoint();

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
                        const completedPath = [...path, { ...v, z: minute }];
                        best = [minute, completedPath];

                        // add solution
                        this.display.clear(Layers.bestRoute);
                        for (const point of completedPath) {
                            this.display.addBlock(point.x, point.y, point.z, Layers.bestRoute);
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

    private displayJourney(
        path: TimedPosition[],
        layer: Layers
    ): void {
        this.display.clear(layer);

        for (const point of path) {
            this.display.addBlock(point.x, point.y, point.z, layer);
        }
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
