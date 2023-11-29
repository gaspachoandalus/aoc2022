import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';

type Status = {
    bestCalories: number[];
    currentCalories: number;
}

class AOC
{
    static Run(lines: string[]): Status
    {
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

        return status;
    }
}
