import { Colors, Display2D } from "./utils/Display2D.js";
import { Vector, vectorAsString } from "./utils/vector.js";

export type Status = {
    part1: number;
    part2: number;
}

enum Layers {
    rope = 0,
    head = 1,
    visitedSecond = 2,
    visitedTail = 3
}

export const config = {
    type: "2D"
};

export class AOC {

    rope = {
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
    };

    display: Display2D;

    constructor(display: Display2D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        const visitedTail = new Map<string, Vector>();
        const visitedSecond = new Map<string, Vector>();

        visitedTail.set(vectorAsString({x: 0, y: 0}), {x: 0, y: 0});

        this.display.setLayer(Layers.head, "head", { style: { bgColor: Colors.red }});
        this.display.setLayer(Layers.rope, "rope");
        this.display.setLayer(Layers.visitedTail, "nodes visited by tail");
        this.display.setLayer(Layers.visitedSecond, "nodes visited by second element");

        for (const line of lines) {

            // parse movement
            const [sDirection, sCount] = line.split(" ");
            let direction: Vector = {
                "R": { x:  1, y:  0 },
                "U": { x:  0, y: -1 },
                "L": { x: -1, y:  0 },
                "D": { x:  0, y:  1 }
            }[sDirection];
            let count: number = parseInt(sCount);

            for (let i = 0; i < count; i++) {

                // move head
                this.rope.nodes[0].x += direction.x;
                this.rope.nodes[0].y += direction.y;
                
                await this.display.nextStep(`Round ${line} move to ${direction.x},${direction.y}`)
                    .throttle();

                // move following nodes
                for (let nodeIdx = 1; nodeIdx < this.rope.nodes.length; nodeIdx++) {
        
                    // save head position
                    let prev = this.rope.nodes[nodeIdx-1];
                    let curr = this.rope.nodes[nodeIdx];

                    if (Math.abs(prev.x - curr.x) == 2 && Math.abs(prev.y - curr.y) == 2) {
                        curr.x += (prev.x - curr.x) / 2;
                        curr.y += (prev.y - curr.y) / 2;
                    }
                    else if (prev.y == curr.y + 2) {
                        curr.y++;
                        curr.x = prev.x;
                    }
                    else if (prev.y == curr.y - 2) {
                        curr.y--;
                        curr.x = prev.x;
                    }
                    else if (prev.x == curr.x + 2) {
                        curr.x++;
                        curr.y = prev.y; 
                    }
                    else if (prev.x == curr.x - 2) {
                        curr.x--;
                        curr.y = prev.y;
                    }
                }
    
                visitedTail.set(vectorAsString(this.rope.nodes.slice(-1)[0]), {...this.rope.nodes.slice(-1)[0]});
                visitedSecond.set(vectorAsString(this.rope.nodes.slice(1, 2)[0]), {...this.rope.nodes.slice(1, 2)[0]});

                await this.display
                    .addItems(this.rope.nodes.slice(-1), Layers.visitedTail)
                    .addItems(this.rope.nodes.slice(1, 2), Layers.visitedSecond)    
                    .setItems(this.rope.nodes.slice(1), Layers.rope)
                    .setItems(this.rope.nodes.slice(0, 1), Layers.head)
                    .scrollIntoView(this.rope.nodes[0], true)
                    .throttle();
            }
        }

        this.display.end({
            part1: visitedSecond.size,
            part2: visitedTail.size
        });
        return {
            part1: visitedSecond.size,
            part2: visitedTail.size
        }
    }
}

// console.log(status);
