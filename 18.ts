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
    boiling = 4,
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
        display3D.setStyle(groups.boiling, {
            name: "boiling",
            color: Colors.red,
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

        // create air and unvisitedAir map
        // WebDisplay3D.setText("fill empty space");
        const air = new Map<string, Vector3D>();
        const unvisitedAir = new Map<string, Vector3D>();
        for (let x = this.min.x; x <= this.max.x; x++) {
            for (let y = this.min.y; y <= this.max.y; y++) {
                for (let z = this.min.z; z <= this.max.z; z++) {
                    const pos = {x, y, z};
                    const strPos = vector3DAsString(pos);
                    if (!this.cubes.has(strPos)) {
                        air.set(strPos, pos);
                        unvisitedAir.set(strPos, pos);

                        // WebDisplay3D.addBlock(pos.x, pos.y, pos.z, groups.air);
                        // await WebDisplay3D.throttle(0);
                    }
                }
            }
        }

        console.log("air", air.size);
        console.log("total", air.size + this.cubes.size);

        let unreachableAirSurface = 0;
        while (unvisitedAir.size > 0) {

            const [firstValue] = unvisitedAir.values();
            const viewed = await this.exploreItems(firstValue, air, unvisitedAir);

            console.log("viewed", viewed);
            console.log("unvisited", unvisitedAir);

            if (!viewed.onBoundary) {
                unreachableAirSurface += viewed.surface;

                display3D.move(groups.explore, groups.boiling);
            }
            else {
                await display3D.pause();
                display3D.setStyle(groups.explore, {
                    transparent: false
                })
                display3D.clear(groups.explore);
                display3D.fadeOut(groups.object, .1);
            }
        }
        console.log("unreachableAirSurface", unreachableAirSurface);
        
        const surfacePart2 = surfaceTouchingAir - unreachableAirSurface;

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

    static async exploreItems(pos: Vector3D, items: Map<string, Vector3D>, unvisited: Map<string, Vector3D>) {

        display3D.log(`explore from ${JSON.stringify(pos)}`);

        const list: Array<Vector3D> = [];

        const viewed = new Map<string, Vector3D>();
        let onBoundary = false;

        let surface = 0;
        list.push(pos);

        while(list.length) {
            const item = list.shift(); // take first

            if (!onBoundary) {
                if (item.x == this.min.x || item.y == this.min.y || item.z == this.min.z ||
                    item.x == this.max.x || item.y == this.max.y || item.z == this.max.z) {
                        onBoundary = true;
                    }
            }

            display3D.addBlock(item.x, item.y, item.z, groups.explore);
            await display3D.throttle(1);
    
            viewed.set(vector3DAsString(item), item);
            unvisited.delete(vector3DAsString(item));

            for (const move of moves3D) {

                const next = {x: item.x + move.x, y: item.y + move.y, z: item.z + move.z};
                const strNext = vector3DAsString(next);

                // add to viewed
                if (items.has(strNext) && !viewed.has(strNext)) {
                    viewed.set(strNext, next);
                    list.push(next);
                }

                // add to surface
                if (!items.has(strNext)) {
                    surface++;
                }
            }
        }

        return { viewed, onBoundary, surface };
    }
}