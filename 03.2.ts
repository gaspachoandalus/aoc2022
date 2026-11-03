type Status = {
    score: number;
}

class Game
{
    static Run(lines: string[]): Status
    {
        let status: Status = {
            score: 0
        };
        for (let pos = 0; pos < lines.length; pos += 6) {
            const item1 = Game.CommonItem(lines[pos],   lines[pos+1], lines[pos+2]); // 1st group of 3
            const item2 = Game.CommonItem(lines[pos+3], lines[pos+4], lines[pos+5]); // 2nd group of 3

            status.score += Game.ItemScore(item1);
            status.score += Game.ItemScore(item2);
        }

        return status;
    }

    static ParseLine(line: string) {
        const rucksack1 = line.slice(0, line.length / 2);
        const rucksack2 = line.slice(line.length / 2);
        return { rucksack1, rucksack2 };
    }

    static CommonItem(rucksack1: string, rucksack2: string, rucksack3: string) {
        let items: Map<string, number> = new Map(); // map item => bit field of presence in rucksack 1|2|4
        Game.CheckRucksack(rucksack1, 1, items);
        Game.CheckRucksack(rucksack2, 2, items);
        Game.CheckRucksack(rucksack3, 4, items);
        for (const [key, value] of items) {
            if (value == (1 | 2 | 4)) {
                return key;
            }
        }
    }

    static CheckRucksack(rucksack: string, id: number, items: Map<string, number>) {
        rucksack.split("").sort().forEach((value) => {
            items.set(value, (items.get(value) ?? 0) | id);
        });
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

export { Game as Problem };
