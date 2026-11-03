import { Display3D, Colors } from "./utils/Display3D.js";
import { Vector3D, moves3D, vector3DAsString } from "./utils/vector.js";

export type Status = {
    part1: number;
    part2: number;
}

enum groups {
    object = 1,
    air = 2,
    frontier = 3
};

export const config = {
    type: "3D",
    cameraFollow: {
        distanceMultiplier: 1,
        // Keep the existing default 45° view and follow distance.
        positionDirection: [0, 1, 1] as const
    }
};

export class Problem {

    display: Display3D;
    cubes: Map<string, Vector3D> = new Map<string, Vector3D>();
    min = {x: Infinity, y: Infinity, z: Infinity};
    max = {x: -Infinity, y: -Infinity, z: -Infinity};

    constructor(display: Display3D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        const display3D = this.display;

        display3D.init();
        display3D.setStyle(groups.frontier, {
            name: "Air region being explored",
            color: Colors.orange,
            opacity: .75,
            transparent: true
        });
        display3D.setStyle(groups.air, {
            name: "Outside air",
            color: Colors.yellow,
            transparent: true,
            opacity: 0.4
        });
        display3D.setStyle(groups.object, {
            name: "Lava cubes",
            color: Colors.white,
            transparent: false
        });
        display3D.start();

        // read input and calc universe boundaries
        display3D.log("read input");
        for (const line of lines) {
            display3D.log(`input line: ${line}`);
            const splitted = line.split(",").map(c => parseInt(c));
            const pos = {x: splitted[0], y: splitted[1], z: splitted[2]};
            
            display3D.addBlock(pos.x, pos.y, pos.z, groups.object);

            this.cubes.set(vector3DAsString(pos), pos);
            this.min = {
                x: Math.min(this.min.x, pos.x - 1),
                y: Math.min(this.min.y, pos.y - 1),
                z: Math.min(this.min.z, pos.z - 1)
            },
            this.max = {
                x: Math.max(this.max.x, pos.x + 1),
                y: Math.max(this.max.y, pos.y + 1),
                z: Math.max(this.max.z, pos.z + 1)
            }

        }
        await display3D.center(this.min.x + (this.max.x - this.min.x) / 2, this.min.y + (this.max.y - this.min.y) / 2, this.min.z + (this.max.z - this.min.z) / 2);
        await display3D.checkpoint();

        console.log("min", this.min);
        console.log("max", this.max);
        console.log("total volume", (this.max.x - this.min.x + 1) * (this.max.y - this.min.y + 1) * (this.max.z - this.min.z + 1));
        console.log("total cubes", this.cubes.size);

        // calc surface touching air
        const surfaceTouchingAir = this.surfaceTouchingAir();
        console.log("surface part1", surfaceTouchingAir);
        
        const surfacePart2 = await this.floodFill();

        return {
            part1: surfaceTouchingAir,
            part2: surfacePart2
        };
    }

    async floodFill(): Promise<number> {
        const frontier: Array<Vector3D> = [];
        const visited = new Map<string, Vector3D>();
        let surface = 0;

        const first = { x: this.min.x, y: this.min.y, z: this.min.z };
        frontier.push(first);

        while (frontier.length) {
            this.display.clear(groups.frontier);
            for (const item of frontier) {
                this.display.addBlock(item.x, item.y, item.z, groups.frontier );
            }

            const item = frontier.shift();
            visited.set(vector3DAsString(item), item);
            this.display.addBlock(item.x, item.y, item.z, groups.air);

            for (const move of moves3D) {
                const next = { x: item.x + move.x, y: item.y + move.y, z: item.z + move.z };
                if (this.cubes.has(vector3DAsString(next))) {
                    surface++;
                    continue;
                }
                if (next.x < this.min.x || next.x > this.max.x || next.y < this.min.y || next.y > this.max.y || next.z < this.min.z || next.z > this.max.z) continue;
                if (visited.has(vector3DAsString(next))) continue;
                if (frontier.find(_ => _.x == next.x && _.y == next.y && _.z == next.z)) continue;

                frontier.push(next);
            }

            await this.display.checkpoint();
        }

        this.display.clear(groups.frontier);
        return surface;
    }

    surfaceTouchingAir() {
        let surface = 0;

        for (const [ strPos, pos ] of this.cubes) {
            for (const move of moves3D) {

                const next = {x: pos.x + move.x, y: pos.y + move.y, z: pos.z + move.z};
                const strNext = vector3DAsString(next);
    
                // add to surface
                if (!this.cubes.has(strNext)) {
                    surface++;
                }
            }
        }

        return surface;
    }
}