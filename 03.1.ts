enum Shapes {
    Rock = 0,
    Paper = 1,
    Scissors = 2
}

enum Target {
    Lose = 0,
    Draw = 1,
    Win = 2
}

export type Status = {
    score: number;
}

export class AOC
{
    static Run(lines: string[]): Status
    {
        return lines.reduce<Status>((prev, current) => {
            const { rucksack1, rucksack2 } = AOC.ParseLine(current);

            for (const item of rucksack1.split("")) {
                if (rucksack2.indexOf(item) >= 0) {
                    prev.score += AOC.ItemScore(item);
                    break;
                }
            }
        
            return prev;
        },
            {
                score: 0
            });
    }

    static ParseLine(line: string) {
        const rucksack1 = line.slice(0, line.length / 2);
        const rucksack2 = line.slice(line.length / 2);
        return { rucksack1, rucksack2 };
    }

    static ItemScore(item: string): number {
        const itemCharCode = item.charCodeAt(0);
        if (itemCharCode >= "a".charCodeAt(0) && itemCharCode <= "z".charCodeAt(0)) {
            return itemCharCode - "a".charCodeAt(0) + 1;
        }
        else {
            return itemCharCode - "A".charCodeAt(0) + 27;
        }
    }
}
