import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';
import { Vector, moves, distance, vectorAsString, mod } from "./utils/vector.js";

class Input {
    static async ReadLines(): Promise<string[]>
    {
        const filename = url.fileURLToPath(import.meta.url);
        var scriptNumber = path.basename(filename).split('.').slice(0, -1).join('.').match(/\d+/);
        const buffer = await fs.readFile(process.argv[2] || scriptNumber + ".in");
        return buffer.toString("utf-8").split("\n");
    }
}
export type Status = {
    part1: number;
    part2: number;
}

export class AOC {

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        // TODO

        return {
            part1: 0,
            part2: 0
        };
    }

    static parse(lines: string[]): void {

        // TODO
    }
}

const lines = await Input.ReadLines();
const status = AOC.Run(lines);
console.log(status);
