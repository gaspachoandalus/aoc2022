import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';

class Input {
    static async ReadLines(): Promise<string[]>
    {
        const filename = url.fileURLToPath(import.meta.url);
        var scriptName = path.basename(filename).split('.').slice(0, -1).join('.');
        const buffer = await fs.readFile(process.argv[2] || scriptName + ".in");
        return buffer.toString("utf-8").split("\n");
    }
}

export type Status = {
    part1: string;
}

export class Problem {

    static Run(lines: string[]): Status | undefined {

        const result = lines.reduce((p, c) => {
            return p + this.SNAFU2Decimal(c);
        }, 0)

        // console.log("sum:", result);

        return {
            part1: this.Decimal2SNAFU(result)
        };
    }

    static Decimal2SNAFU(n: number): string {

        const size = Math.round(Math.log(n)/Math.log(5));

        let result = this.dfs([], size, 0, n);

        return result.map(v => [ "=", "-", "0", "1", "2"][v+2]).join("");
    }

    // static iterationDate = 0;
    // static iteration = 0;

    static dfs(a: Array<number>, pos: number, current: number, target: number): Array<number> {

        if (current == target) {
            if (pos >= 0) {
                return this.dfs([ ...a, 0 ], pos - 1, current, target);
            }
            // console.log("found:", current, "iteration:", this.iteration, "pos:", pos, "array:", a);
            return [...a];
        }

        if (pos == -1) {
            return null;
        }

        const gap = Math.abs(target - current);
        // this.iteration++;
        // if (Date.now() - this.iterationDate > 1000) {
        //     console.log("iteration:", current, "pos:", pos, "gap:", gap, "array:", a);
        //     this.iterationDate = Date.now();
        // }

        let maxLeft = 0; // maximum reachable if all next digits are "2"
        for (let i = pos; i >= 0; i--) {
            maxLeft += 2 * Math.pow(5, i);
        }
        if (gap > maxLeft) {
            return null;
        }

        const tries = [ -2, -1, 0, 1, 2 ]
            .sort((a, b) => Math.abs(target - current + a * Math.pow(5, pos)) - Math.abs(target - current + b * Math.pow(5, pos)));

        for (const try_ of tries) {
            const found = this.dfs([...a, try_], pos - 1, current + try_ * Math.pow(5, pos), target);
            if (found)
                return found;
        }

        return null;
    }

    static SNAFU2Decimal(s: string): number {
        const map = {
            "2": 2,
            "1": 1,
            "0": 0,
            "-": -1,
            "=": -2
        };

        let value = 0;
        for (let i = 0; i < s.length; i++) {
            const pos = s.length - i - 1;
            value += Math.pow(5, i) * map[ s.slice(-(i+1))[0] ];
        }

        return value;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
