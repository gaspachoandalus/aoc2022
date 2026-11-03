import { Colors, Display3D } from "./utils/Display3D.js";
import { Vector3D } from "./utils/vector.js";

export const config = {
    type: "3D",
    cameraFollow: {
        distanceMultiplier: 1.5,
        positionDirection: [1, 0.85, 0.25] as const,
        snapToInitialTarget: true
    }
};

export type Status = {
    part1: number;
    part2: number;
}

export class Problem {

    cubes: Map<string, Vector3D> = new Map<string, Vector3D>();
    min = {x: Infinity, y: Infinity, z: Infinity};
    max = {x: -Infinity, y: -Infinity, z: -Infinity};
    display: Display3D;

    constructor(display: Display3D) {
        this.display = display;
    }
    
    async Run(lines: string[] = null): Promise<Status | undefined> {

        this.display.init();
        this.display.start();
        await this.display.checkpoint();

        if (false) {

            this.display.addBlock(0, 0, 0, 0);
            // this.display.addBlock(1, 0, 0, 0);
        }
        else {

            const startingGroup = 1;
            const cubes = 5;
            const cubeSize = 5;
            const spaceBetweenCubes = 1;
            const offset = 0;// - (cubes * (cubeSize + spaceBetweenCubes)) / 2;

            this.display.center(
                (cubeSize - 1) / 2,
                (cubeSize - 1) / 2,
                ((cubes - 1) * (cubeSize + spaceBetweenCubes) + cubeSize - 1) / 2 + offset
            );
    
            for (let cubeIdx = startingGroup; cubeIdx < cubes + startingGroup; cubeIdx++) {
                this.display.setStyle(cubeIdx, {
                    color: Colors.red,
                    name: `group ${cubeIdx}`
                });
            }

            for (let cubeIdx = startingGroup; cubeIdx < cubes + startingGroup; cubeIdx++) {

                for (let z = 0; z < cubeSize; z++) {

                    for (let x = 0; x < cubeSize; x++) {

                        for (let y = 0; y < cubeSize; y++) {

                            this.display.addBlock(x, y, (cubeIdx - startingGroup) * (cubeSize + spaceBetweenCubes) + z + offset, cubeIdx);
                            await this.display.checkpoint();
                        }
                    }
                }

                // this.display.addBlock(cubeSize, cubeSize, cubeIdx * (cubeSize + spaceBetweenCubes) + 2 + offset, cubeIdx);
    
            }

            await this.display.pause();
            
            for (let cubeIdx = startingGroup; cubeIdx < cubes + startingGroup; cubeIdx++) {

                this.display.fadeOut(cubeIdx, .3);

            }
        }


        // this.display.merge(2, 1);
        // this.display.merge(3, 4);

            // threeEngine.addBlock(1,1,7, 2);
            // threeEngine.addBlock(1,1,7, 3);


        // await sleep(60000);
        return
    }
}