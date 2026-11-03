import { WebDisplay3D } from "./utils/DisplayWeb3D.js";
import { Colors } from "./utils/Display3D.js";
import { Vector3D, moves3D, vector3DAsString } from "./utils/vector.js";

export type Status = {
    part1: number;
    part2: number;
}

enum groups {
    object = 1,
    air = 2,
    explore = 5
};

const display3D = WebDisplay3D.create();

export class Problem {

    static cubes: Map<string, Vector3D> = new Map<string, Vector3D>();
    static min = {x: Infinity, y: Infinity, z: Infinity};
    static max = {x: -Infinity, y: -Infinity, z: -Infinity};

    static async Run(lines: string[]): Promise<Status | undefined> {

        display3D.init();
        display3D.setStyle(groups.explore, {
            name: "explore",
            color: Colors.orange,
            opacity: .7,
            transparent: true
        });
        display3D.setStyle(groups.object, {
            name: "object",
            color: Colors.white,
            transparent: false
        });
        display3D.start();
        await display3D.throttle(.01);

        // read input and calc universe boundaries
        display3D.log("read input");
        for (const line of lines) {
            display3D.log(`input line: ${line}`);
            const splitted = line.split(",").map(c => parseInt(c));
            const pos = {x: splitted[0], y: splitted[1], z: splitted[2]};
            
            await display3D.addBlock(pos.x, pos.y, pos.z, groups.object).throttle(0);

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

            display3D.center(this.min.x + (this.max.x - this.min.x) / 2, this.min.y + (this.max.y - this.min.y) / 2, this.min.z + (this.max.z - this.min.z) / 2);
        }

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

    static surfaceTouchingAir() {
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

    static async floodFill(): Promise<number> {
        const frontier: Array<Vector3D> = [];
        const visited = new Map<string, Vector3D>();
        let surface = 0;

        const first = {x: this.min.x, y: this.min.y, z: this.min.z};
        frontier.push(first);

        while (frontier.length) {
            const item = frontier.shift();
            if (!item) continue;

            visited.set(vector3DAsString(item), item);
            display3D.addBlock(item.x, item.y, item.z, groups.explore);
            await display3D.throttle(1);

            for (const move of moves3D) {
                const next = {x: item.x + move.x, y: item.y + move.y, z: item.z + move.z};
                const strNext = vector3DAsString(next);

                if (this.cubes.has(strNext)) {
                    surface++;
                    continue;
                }
                if (next.x < this.min.x || next.x > this.max.x ||
                    next.y < this.min.y || next.y > this.max.y ||
                    next.z < this.min.z || next.z > this.max.z) continue;
                if (visited.has(strNext)) continue;
                if (frontier.find(_ => _.x == next.x && _.y == next.y && _.z == next.z)) continue;

                frontier.push(next);
            }
        }

        return surface;
    }

}