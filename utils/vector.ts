// import chalk from "chalk";

// basic vector interface (often use as point)
export interface Vector {
    x: number;
    y: number;
}

// basic moves around.
// increse by one to rotate 90°
export const moves: Array<Vector> = [
    { x:  1, y:  0 }, // right
    { x:  0, y:  1 }, // down
    { x: -1, y:  0 }, // left
    { x:  0, y: -1 }  // up
];

export interface Vector3D {
    x: number,
    y: number,
    z: number
}

export const moves3D: Array<Vector3D> = [
    { x:  1, y:  0, z:  0 },
    { x: -1, y:  0, z:  0 },
    { x:  0, y:  1, z:  0 },
    { x:  0, y: -1, z:  0 },
    { x:  0, y:  0, z:  1 },
    { x:  0, y:  0, z: -1 },
];

// hash function to put a vector in a Map
export function vectorAsString(pos: Vector): string {
    return `${pos.x},${pos.y}`;
}

export function vector3DAsString(pos: Vector3D): string {
    return `${pos.x},${pos.y},${pos.z}`;
}

// manhattan distance between 2 points
export function distance(v1: Vector, v2: Vector) {
    return Math.abs(v1.x - v2.x) + Math.abs(v1.y - v2.y);
}

export function center(v1: Vector, v2: Vector): Vector {
    return {
        x: v1.x + (v2.x - v1.x) / 2,
        y: v1.y + (v2.y - v1.y) / 2
    };
}

export function lerp(v1: Vector, v2: Vector, alpha: number) {
    return {
        x: v1.x + (v2.x - v1.x) * alpha,
        y: v1.y + (v2.y - v1.y) * alpha
    }
}

// returns the positive modulo (not the "%" remainder)
export function mod(v: number, n: number) {
    return ((v % n) + n) % n;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function* iterateProperty<T, U>(iterable: Iterable<T>, property: (T) => U) {
    for (const obj of iterable) {
        yield property(obj);
    }
}

export function display(boundaries: {min: Vector, max: Vector}, hasItem: (Vector) => boolean)
{
    const PAD = 2;

    const maxVerticalLength = Math.max(boundaries.min.x.toString().length, boundaries.max.x.toString().length);
    const maxHorizontalLength = Math.max(boundaries.min.y.toString().length, boundaries.max.y.toString().length);

    /**
     * display     - - - - -                     1      <= horizontal axis line 1
     * display     5 4 3 2 1 0 1 2 3 4 5 6 7 8 9 0      <= horizontal axis line 2
     * display  -5           #   # # #                  <= 1st line
     * display  -4     # # #   #   #   #                <= 2nd line
     * display  -3       #   #   #   #                  <= 3rd line
     * ...
     */

    // display horizontal axis 
    for (let i = 0; i < maxVerticalLength; i++) {
        let line = [];
        for (let x = boundaries.min.x; x <= boundaries.max.x; x++) {
            line.push(x.toString().padStart(maxVerticalLength).slice(i, i+1).padStart(PAD));
        }
        console.log("".padStart(maxHorizontalLength), /* chalk.yellow */(line.join("")));
    }

    // display lines
    for (let y = boundaries.min.y; y <= boundaries.max.y; y++) {
        let line = [];
        for (let x = boundaries.min.x; x <= boundaries.max.x; x++) {
            const item = hasItem({x, y}) ? "#" : "";
            line.push(item.padStart(PAD));
        }
        console.log(/* chalk.yellow */(y.toString().padStart(maxHorizontalLength)), line.join(""));
    }
}
