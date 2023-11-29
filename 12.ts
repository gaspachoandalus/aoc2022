import { Vector, iterateProperty, moves } from "./utils/vector.js";
import { Colors, Display2D } from "./utils/Display2D.js";

export type Status = {
    part1: number;
    part2: number;
}

export class AOC {

    map: Array<Array<string>> = [];
    distance: Array<Array<Array<Vector>>> = [];
    start: Vector = {x: 0, y: 0};
    end: Vector = {x: 0, y: 0};
    display: Display2D;

    constructor(display: Display2D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        // parse map
        this.map = lines.map((line, y) => line.split("")
            .map((pos, x) => {
                if (pos == "S") { 
                    this.start = {x, y};
                    pos = "a";
                }
                else if (pos == "E") {
                    this.end = {x, y};
                    pos = "z";
                }
                return pos;
            }
        ));
        
        // initialise distances
        // this.distance = Array(this.map.length).fill([]);
        this.distance = lines.map((line, y) => line.split("")
            .map((pos, x) => {
                if (pos == "E") {
                    return [];
                }
                return null;
            }
        ));

        this.display
            .setLayer(0, "hills", { style: {color: Colors.white, bgColor: Colors.black} })
            .setLayer(1, "part1", { style: {color: null, bgColor: Colors.blue } }) // part2
            .setLayer(2, "part3", { style: {color: null, bgColor: Colors.green } }) // part1
            .setLayer(3, "covered", { style: {color: null, bgColor: Colors.yellow, strike: true} }) // BFS coverage
            .setLayer(4, "breadth first search front", { style: {color: null, bgColor: Colors.red } }) // BFS front
            .setItems(this.map.map((v, y) => ({x: 0, y, content: v.join("")})), 0)
            // .addItems([{...this.start, content: "S"}, {...this.end, content: "E"}], 0);
            .setBoundaries()

        await this.bfs(this.end, this.start);
        this.display.setItems(this.distance[this.start.y][this.start.x], 2);

        const nearestANode = this.map.reduce<Vector>((p, c, y) => {
            return c.reduce<Vector>((p, c, x) => {
                if (c == "a") {
                    if (p && (this.distance[p.y][p.x]?.length ?? Infinity) < (this.distance[y][x]?.length ?? Infinity))
                        return p;
                    else
                        return {x,y};
                }
                else
                    return p;
            }, p)
        }, null);

        this.display.setItems(this.distance[nearestANode.y][nearestANode.x], 1)

        return {
            part1: this.distance[this.start.y][this.start.x]?.length,
            part2: this.distance[nearestANode.y][nearestANode.x]?.length
        }
    }

    async bfs(start: Vector, end: Vector): Promise<void> {

        const deque: Array<{pos:Vector, path: Array<Vector>}> = [ {
            pos: {...start},
            path: []
        }];

        this.distance[start.y][start.x] = [];

        while (deque.length > 0) {
            const curr = deque.shift();

            const currentElevation = this.map[curr.pos.y][curr.pos.x].charCodeAt(0);

            await this.display
                .setItems(iterateProperty(deque.values(), o => o.pos), 4)
                .addItems([{...curr.pos}], 3)
                .setTitle(`distance: ${curr.path.length}`)
                .throttle();

            // try places around
            moves
                .map(move => ({x: curr.pos.x + move.x, y: curr.pos.y + move.y }))
                .filter(next => next.x >= 0 && next.x < this.map[0].length && next.y >= 0 && next.y < this.map.length)
                // .filter(next => this.distance[next.y][next.x] == Infinity)
                .filter(next => !this.distance[next.y][next.x])
                .filter(next => this.map[next.y][next.x].charCodeAt(0) >= (currentElevation - 1))
                .forEach(next => {
                    this.distance[next.y][next.x] = [...curr.path, {...next}];
                    deque.push({pos: {...next}, path: [...curr.path, {...next}]});
                });
        }
    }
}
