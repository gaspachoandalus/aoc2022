import { stringify } from "querystring";

export type Status = {
    result: number;
}

interface Vector {
    x: number,
    y: number
}

const DirectionToVector: Record<string, Vector> = {
    "R": { x:  1, y:  0 },
    "U": { x:  0, y: -1 },
    "L": { x: -1, y:  0 },
    "D": { x:  0, y:  1 }
}

export class Problem {

    static rope = {
        nodes: [
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 0, y: 0}
        ]
    }

    static Run(lines: string[]): Status | undefined {

        let cycle = 1;
        let register = 1;
        let accumulator = 0;

        for (let line of lines) {

            // parse CPU operation
            console.log(line);
            const splitted = line.split(" ");
            let operation = splitted[0];

            let cycles;
            let valueAfter;

            if (operation == "addx") {
                const value = parseInt(splitted[1]);
                cycles = 2;
                valueAfter = register + value;
            }
            else if (operation == "noop") {
                cycles = 1;
                valueAfter = register;
            }
            
            // simulate cycles
            for (let i = 0; i < cycles; i++, cycle++) {
                if (cycle >= 20 && (cycle - 20) % 40 == 0) {
                    console.log(`cycle ${cycle}: ${register}`);
                    accumulator += register * cycle;
                }
                if (i == cycles - 1) {
                    register  = valueAfter;
                }
            }
         }

        return {
            result: accumulator
        }
    }

    static display() {

        const bounds = this.rope.nodes.reduce((p, c) => {
            return {
                xmin: Math.min(p.xmin, c.x - 1),
                xmax: Math.max(p.xmax, c.x + 1),
                ymin: Math.min(p.ymin, c.y - 1),
                ymax: Math.max(p.ymax, c.y + 1),
            }
        },{
            xmin: this.rope.nodes[0].x, // -5,
            xmax: this.rope.nodes[0].x, // 5,
            ymin: this.rope.nodes[0].y, // -5,
            ymax: this.rope.nodes[0].y, // 5
        })

        console.log();
        const lines: string[][] = [];
        for (let y = 0; y < (bounds.ymax - bounds.ymin); y++) {
            lines.push(".".repeat(bounds.xmax - bounds.xmin).split(""));
        }
        for (let node = this.rope.nodes.length - 1; node >= 0; node--) {
            try
            {
                lines[this.rope.nodes[node].y - bounds.ymin][this.rope.nodes[node].x - bounds.xmin] = ""+node;
            }
            catch (e)
            {
                console.error(e);
            }
        }
        for (let y = bounds.ymin; y < bounds.ymax; y++) {
            console.log(lines[y - bounds.ymin].join(""));
        }
    }
}
