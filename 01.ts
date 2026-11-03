export type Status = {
    part1: number;
    part2: number;
}

type Accumulator = {
    bestCalories: number[];
    currentCalories: number;
}

export class AOC {

    async Run(lines: string[]): Promise<Status> {

        const flush = (acc: Accumulator) => {
            if (acc.currentCalories > acc.bestCalories[0]) {
                acc.bestCalories[0] = acc.currentCalories;
                acc.bestCalories.sort((a, b) => a - b);
            }
            acc.currentCalories = 0;
        };

        const accumulator = lines.reduce<Accumulator>((prev, current) => {
            if (current == "") {
                flush(prev);
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
        flush(accumulator); // account for the last elf when input has no trailing blank line

        return {
            part1: accumulator.bestCalories[2],
            part2: accumulator.bestCalories.reduce((p, c) => p + c, 0)
        };
    }
}
