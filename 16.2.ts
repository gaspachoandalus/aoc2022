import { notEqual } from "assert";
import * as fs from "fs/promises"

// const INPUT = "./testInput.txt";
const INPUT = "./input.txt";


const NB_MINUTES = 26;
// const NB_MINUTES = 30;

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

interface Node {
    name: string,
    rate: number,
    next: Array<string>,
    bestNext?: Array<string>,
    distances?: Map<string, number>
}

export class Problem {

    static valves: Map<string, Node>;
    static best: { pressure: number, totalRate: number, totalExpectableRate: number, leftToOpen: number, opened: Array<string> } = { pressure: 0, totalRate: 0, totalExpectableRate: 0, leftToOpen: 0, opened: [] };
    static iteration = 0;
    static simplified: Array<string>;

    static async Run(lines: string[]): Promise<Status | undefined> {

        this.parse(lines);
        console.log("valves", this.valves);

        // const maxExpect = Object.keys(this.valves).reduce((p, c) => p + this.valves.get(c).rate, 0);
        let maxExpect = 0;
        for (const [key, value] of this.valves) {
            maxExpect += value.rate;
        }
        console.log("maxExpect", maxExpect);

        // calculate all distances
        this.simplified = [ "AA" ];
        for (const [ name, node ] of this.valves.entries()) {
            if (node.rate >  0) {
                this.simplified.push(name);
            }
        }

        console.log("simplified nodes", this.simplified.length, this.simplified);

        // simplify graph
        for (const name of this.simplified) {

            const valve = this.valves.get(name);
            const distances = this.mapBFS(valve);

            const bestNext: Array<string> = [];
            for (const item of distances.keys()) {
                if (this.valves.get(item).rate > 0) {
                    bestNext.push(item);
                }
            }
            valve.distances = distances;
            valve.bestNext = bestNext.sort((a, b) => this.valves.get(b).rate / valve.distances.get(b) - this.valves.get(a).rate / valve.distances.get(a));
        }
        console.log("valves", this.valves);
        await this.display();

        // first run
        this.explore(this.valves.get("AA"), "move", 0, 0, [], new Map<string, boolean>(), 0, 0, maxExpect, this.valves.size);
        console.log("best1", this.best);
        const part1 = this.best.pressure;

        // second run
        const opened = new Map<string, boolean>(this.best.opened.map(c => [ c, true ]));
        const totalExpectableRate = this.best.totalExpectableRate;
        const leftToOpen = this.best.leftToOpen;
        this.best = { pressure: 0, totalRate: 0, totalExpectableRate: 0, leftToOpen: 0, opened: [] };
        this.explore(this.valves.get("AA"), "move", 0, 0, [], opened, 0, 0, totalExpectableRate, leftToOpen);
        console.log("best2", this.best);
        const part2 = part1 + this.best.pressure;

        return {
            part1: part1,
            part2: part2
        };
    }

    static parse(lines: string[]) {

        this.valves = lines.map((c) => {
            //Valve AA has flow rate=0; tunnels lead to valves DD, II, BB
            const parts = c.split(" ");
            return {
                name: parts[1],
                rate: parseInt(parts[4].match(/\d+/)[0]),
                next: parts.slice(9).map(c => c.split(",")[0])
            }
        })
        .reduce((p, c) => {
            p.set(c.name, {
                name: c.name,
                rate: c.rate,
                next: c.next
            })
            return p;
        }, new Map<string, Node>);


        // sort next nodes by rate
        for (const [ , valve ] of this.valves) {
            valve.next.sort((a, b) => this.valves.get(b).rate - this.valves.get(a).rate);
        }
    }

    static async display() {
        let data = "stateDiagram-v2\n";
        data += "    [*] --> AA\n";
        for (const name of this.simplified) {
            for (const next of this.valves.get(name).bestNext) {
                data += "    " + `${name} --> ${next}` + "\n";
            }
        }
        await fs.writeFile("diagram.mermaid", data);
    }

    static mapBFS(node: Node): Map<string, number> {

        let queue: Array<{name: string, distance: number}> = [];
        let visited = new Map<string, number>();

        queue.push({ name: node.name, distance: 0 });
        
        while (queue.length) {

            const item = queue.shift();
            visited.set(item.name, item.distance);
//            console.log("mapBFS", item.name, item.distance);

            for (const next of this.valves.get(item.name).next) {
                if (!visited.has(next)) {
                    queue.push({ name: next, distance: item.distance + 1 });
                }
            }
        }

        return visited;
    }

    static explore(node1: Node, action1: string, minute: number, moveMinute1: number, list: Array<string>, opened: Map<string, boolean>, pressure, totalRate, totalExpectableRate, valvesLeftToOpen: number): void {

        // release pressure
        pressure += totalRate;

        // 
        this.iteration++;
        if ((this.iteration % 50_000_000) == 0) {
            console.log(new Date(), `explore iteration ${this.iteration.toLocaleString()}`, list);
        }

        const minutesLeft = NB_MINUTES - (minute+1);

        if ((pressure + (totalRate + totalExpectableRate) * minutesLeft) < this.best.pressure) {
            return;
        }

        list.push(`${minute.toString().padStart(2)} ${node1.name} ${action1}; release ${totalRate}`);

        // stop after max minutes
        if (minute == (NB_MINUTES - 1)) {
            if (pressure > this.best.pressure) {
                console.log("best",
                    new Date(),
                    list.reduce((p, c, i) => {p[i] = c; return p },{}),
                    opened.keys(),
                    pressure);
                this.best = { pressure, totalRate, totalExpectableRate, leftToOpen: valvesLeftToOpen, opened: [ ...opened.keys() ] };
            }
        }
        else if (valvesLeftToOpen == 0) {
            // all valves are open => go directly to last minute
            this.explore(node1, "wait", NB_MINUTES - 1, NB_MINUTES - 1, list, opened, pressure + minutesLeft * totalRate, totalRate, totalExpectableRate, valvesLeftToOpen);
        }
        else {
            let choices: Array<string> = [ null ]; // null by default => in tunnel
            if (minute == moveMinute1) {
                // choices =  [ ...node1.bestNext ];
                choices = [];
                if (node1.rate > 0 && !opened.has(node1.name)) choices.push("open");
                for (const next of node1.bestNext) {
                    if (node1.distances.get(next) <= minutesLeft) {
                        choices.push(next);
                    }
                }
            };

            for (const choice of choices) {

                let nextNode1: Node = node1;
                let nextTotalRate = totalRate;
                let nextTotalExpectableRate = totalExpectableRate;
                let nextValvesToOpen = valvesLeftToOpen
                let nextAction1: string;
                let nextMoveMinute1: number;

                if (choice == null) {
                    nextMoveMinute1 = moveMinute1;
                    nextAction1 = "in tunnel";
                }
                else if (choice == "open") {
                    nextAction1 = "open";
                    nextTotalRate += node1.rate;
                    nextTotalExpectableRate -= node1.rate;
                    nextValvesToOpen--;
                    nextMoveMinute1 = minute + 1.
                }
                else {
                    nextAction1 = "move";
                    nextNode1 = this.valves.get(choice);
                    nextMoveMinute1 = minute + node1.distances.get(choice);
                }

                if (nextAction1 == "open") opened.set(node1.name, true);

                this.explore(nextNode1, nextAction1, minute + 1, nextMoveMinute1, list, opened, pressure, nextTotalRate, nextTotalExpectableRate, nextValvesToOpen);

                if (nextAction1 == "open") opened.delete(node1.name);
            }
        }

        list.pop();
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = await Problem.Run(lines);
console.log(status);
