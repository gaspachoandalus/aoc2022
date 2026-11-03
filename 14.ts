import { Vector, vectorAsString } from "./utils/vector.js";
import { Display2D, Colors } from "./utils/Display2D.js";

export type Status = {
    part1: number;
    part2: number;
}

export const config = {
    type: "2D"
};

enum Layers {
    rocks = 0,
    falling = 1,
    still = 2
}

export class AOC {

    map = new Map<string, Vector>();
    start: Vector = { x: 500, y: 0 };
    lowest: number = 0;
    part1: number = 0;
    display: Display2D;

    constructor(display: Display2D)
    {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        this.parse(lines);
        const initialBounds = [...this.map.values(), this.start].reduce((bounds, pos) => ({
            min: {
                x: Math.min(bounds.min.x, pos.x),
                y: Math.min(bounds.min.y, pos.y)
            },
            max: {
                x: Math.max(bounds.max.x, pos.x + 1),
                y: Math.max(bounds.max.y, pos.y + 1)
            }
        }), {
            min: { x: this.start.x, y: this.start.y },
            max: { x: this.start.x + 1, y: this.start.y + 1 }
        });

        await this.display
            .init(95)
            .setLayer(Layers.rocks, "Rock formations", { style: { bgColor: Colors.white } })
            .setLayer(Layers.still, "Settled sand", { style: { bgColor: Colors.yellow } })
            .setLayer(Layers.falling, "Falling sand", { style: { bgColor: Colors.blue } })
            .setItems(this.map.values())
            .fitBounds(initialBounds)

        const status = await this.pour();

        return status;
    }

    async pour(): Promise<Status> {
        let count = 0;
        let part1 = 0;
        let falling: Array<Vector> = []; // first element is lowest

        const dropInterval = 3; // iteration interval between each grain
        let iteration = 0;
        do {
            if (iteration % dropInterval == 0 && !this.map.has(vectorAsString(this.start))) {
                falling.push({ ...this.start });
                count++;
            }
            iteration++;

            await this.display
                .setItems(falling, Layers.falling)
                .setTitle(`iteration ${iteration}, falling: ${falling.length}`)
                .checkpoint();

            // move each falling grain
            for (let grainIdx = 0; grainIdx < falling.length; grainIdx++) {
                if (await this.moveOneStep(falling[grainIdx]) == false) {
                    // stuck
                    const pos = falling[grainIdx];
                    this.map.set(vectorAsString(pos), { ...pos });
                    this.display.addItems([pos], Layers.still);

                    falling.splice(grainIdx, 1);
                    grainIdx--;
                }
            }

            if (part1 == 0 && falling.length && falling[0].y > this.lowest) {
                part1 = count - falling.length;
            }
        }
        while (!this.map.has(vectorAsString(this.start)));

        return {
            part1,
            part2: count
        };
    }

    isOccupied(pos: Vector): boolean {
        if (pos.y == this.lowest + 2) return true;
        return this.map.has(vectorAsString(pos));
    }

    async moveOneStep(pos: Vector) {
        const nextPositions = [
            { x: pos.x, y: pos.y + 1 },
            { x: pos.x - 1, y: pos.y + 1 },
            { x: pos.x + 1, y: pos.y + 1 }
        ];

        for (const next of nextPositions) {
            if (!this.isOccupied(next)) {
                pos.x = next.x;
                pos.y = next.y;
                return true;
            }
        }
        return false;
    }

    parse(lines: string[]): void {

        lines.forEach(line => line.split(" -> ").map(coords => {
            const [x, y] = coords.split(",").map(coord => parseInt(coord));
            return { x, y };
        })
            .reduce((p, c) => {
                if (p == null) {
                    // console.log("init", c);
                    this.map.set(vectorAsString({ ...c }), { ...c });
                    this.lowest = Math.max(this.lowest, c.y);
                }
                if (p != null) {
                    // console.log("current", c);
                    const pos: Vector = { ...p };
                    // console.log("pos", p);
                    const direction: Vector = {
                        x: Math.sign(c.x - p.x),
                        y: Math.sign(c.y - p.y)
                    }
                    // console.log("direction", direction);
                    for (const pos = { ...p }; pos.x != c.x || pos.y != c.y;)
                        while (pos.x != c.x || pos.y != c.y) {
                            pos.x += direction.x;
                            pos.y += direction.y;
                            this.map.set(vectorAsString(pos), { ...pos });
                            this.lowest = Math.max(this.lowest, pos.y);
                            // console.log("filled", pos);
                        }
                }
                return c;
            }, null as Vector));

        // console.log("lowest", this.lowest);
    }
}