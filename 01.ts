import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';

class Input {
    static async Read(): Promise<string[]>
    {
        const filename = url.fileURLToPath(import.meta.url);
        var scriptName = path.basename(filename).split('.').slice(0, -1).join('.');
        const buffer = await fs.readFile(process.argv[2] || scriptName + ".in");
        return buffer.toString("utf-8").split("\n");
    }
}

type Status = {
    bestCalories: number[];
    currentCalories: number;
}

const lines = await Input.Read();
const status = lines.reduce<Status>((prev, current) => {
    if (current == "") {
        if (prev.currentCalories > prev.bestCalories[0]) {
            prev.bestCalories[0] = prev.currentCalories;
            prev.bestCalories.sort((a, b) => a - b);
        }
        prev.currentCalories = 0;
    }
    else {
        prev.currentCalories += parseInt(current);
    }

    return prev;
},
    {
        bestCalories: [0, 0, 0],
        currentCalories: 0
    });

console.log("part1:", status.bestCalories[2]);
console.log("part2:", status.bestCalories.reduce((p, c) => p + c, 0));

