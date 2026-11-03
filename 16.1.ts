import { notEqual } from "assert";

const NB_MINUTES = 30;

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
    next: Array<string>
}

export class Problem {

    static valves: Map<string, Node>;
    static best = 0;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);
        console.log("valves", this.valves);

        // const maxExpect = Object.keys(this.valves).reduce((p, c) => p + this.valves.get(c).rate, 0);
        let maxExpect = 0;
        for (const [key, value] of this.valves) {
            maxExpect += value.rate;
        }
        console.log("maxExpect", maxExpect);

        this.explore(this.valves.get("AA"), "move", 0, [], new Map<string, number>(), new Map<string, boolean>(), 0, 0, maxExpect, this.valves.size);

        console.log("very best", this.best);
        return {
            part1: 0,
            part2: 0
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

    static explore(node: Node, action: string, minute: number, list: Array<string>, visited: Map<string, number>, opened: Map<string, boolean>, pressure, totalRate, totalExpectableRate, valvesLeftToOpen: number): void {

        // release pressure
        pressure += totalRate;

        if ((pressure + (totalRate + totalExpectableRate) * (NB_MINUTES - (minute+1))) < this.best) {
            return;
        }

        list.push(`${node.name} ${action} release ${totalRate}`);
        // visited.set(node.name, (visited.get(node.name) ?? 0) + 1);

        // stop after max minutes
        if (minute == (NB_MINUTES - 1)) {
            if (pressure > this.best) {
                console.log("best",
                    new Date(),
                    list.reduce((p, c, i) => {p[i] = c; return p },{}),
                    opened.keys(),
                    pressure);
                this.best = pressure;
            }
        }
        else if (valvesLeftToOpen == 0) { // go fost if all valves are open
            this.explore(node, "wait", minute + 1, list, visited, opened, pressure, totalRate, totalExpectableRate, valvesLeftToOpen);
        }
        else {
            // try open current valve if not already opened
            if (node.rate > 0 && !opened.has(node.name)) {
                opened.set(node.name, true);
                this.explore(node, "open", minute + 1, list, visited, opened, pressure, totalRate + node.rate, totalExpectableRate - node.rate, valvesLeftToOpen - 1);
                opened.delete(node.name);
            }
    
            // try next valves
            for (let next of node.next) {
                this.explore(this.valves.get(next), "move", minute + 1, list, visited, opened, pressure, totalRate, totalExpectableRate, valvesLeftToOpen);
            }
        }

        list.pop();
        // visited.delete(node.name);
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}
