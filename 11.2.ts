import * as fs from "fs/promises"

export class Input {

    static async ReadAll(): Promise<string> {
        const buffer = await fs.readFile("./testInput.txt");
        return buffer.toString("utf-8");
    }

    static async ReadLines(): Promise<string[]> {
        return (await this.ReadAll()).split("\n");
    }
}

export type Status = {
    result: number;
}

interface Monkey {
    items: Array<number>,
    operation: (n: number) => number,
    test: number,
    nextTrue: number,
    nextFalse: number,
    inspections: number
};

export class Problem {

    static testMonkeys: Array<Monkey> = [
        {
            items: [ 79, 98 ],
            operation: (old) => old * 19,
            test: 23,
            nextTrue: 2,
            nextFalse: 3,
            inspections: 0
        },
        {
            items: [ 54, 65, 75, 74 ],
            operation: (old) => old + 6,
            test: 19,
            nextTrue: 2,
            nextFalse: 0,
            inspections: 0
        },
        {
            items: [ 79, 60, 97 ],
            operation: (old) => old * old,
            test: 13,
            nextTrue: 1,
            nextFalse: 3,
            inspections: 0
        },
        {
            items: [ 74 ],
            operation: (old) => old + 3,
            test: 17,
            nextTrue: 0,
            nextFalse: 1,
            inspections: 0
        }
    ]

    static realMonkeys: Array<Monkey> = [
        {
            items: [ 93, 54, 69, 66, 71 ],
            operation: (old) => old * 3,
            test: 7,
            nextTrue: 7,
            nextFalse: 1,
            inspections: 0
        },
        {
            items: [ 89, 51, 80, 66 ],
            operation: (old) => old * 17,
            test: 19,
            nextTrue: 5,
            nextFalse: 7,
            inspections: 0
        },
        {
            items: [ 90, 92, 63, 91, 96, 63, 64 ],
            operation: (old) =>  old + 1,
            test: 13,
            nextTrue: 4,
            nextFalse: 3,
            inspections: 0
        },
        {
            items: [  65, 77 ],
            operation: (old) =>  old + 2,
            test: 3,
            nextTrue: 4,
            nextFalse: 6,
            inspections: 0
        },
        {
            items: [ 76, 68, 94 ],
            operation: (old) =>  old * old,
            test: 2,
            nextTrue: 0,
            nextFalse: 6,
            inspections: 0
        },
        {
            items: [ 86, 65, 66, 97, 73, 83 ],
            operation: (old) =>  old + 8,
            test: 11,
            nextTrue: 2,
            nextFalse: 3,
            inspections: 0
        },
        {
            items: [ 78 ],
            operation: (old) =>  old + 6,
            test: 17,
            nextTrue: 0,
            nextFalse: 1,
            inspections: 0
        },
        {
            items: [ 89, 57, 59, 61, 87, 55, 55, 88 ],
            operation: (old) =>  old + 7,
            test: 5,
            nextTrue: 2,
            nextFalse: 5,
            inspections: 0
        }
    ];

    static monkeys: Array<Monkey> = [];

    static Run(lines: string): Status | undefined {

        // lines.split("\n\n").map(this.ParseMonkey());

        const ROUNDS = 10000;

        this.monkeys = this.realMonkeys;
        const mod = this.monkeys.map(monkey => monkey.test).reduce((p, c) => p * c, 1);

        console.log(`mod: ${this.monkeys.map(monkey => monkey.test)}`);
        console.log(`mod: ${mod}`);

        for (let i = 0; i < ROUNDS; i++) {
            // console.log(`round ${i}`);
            this.round(mod);
        }
        this.display();

        console.log(`inspections: ${this.monkeys
            .map(monkey => monkey.inspections)
            .sort((a, b) => b-a)
        }`);
        
        return {
            result: this.monkeys
                .map(monkey => monkey.inspections)
                .sort((a, b) => b - a)
                .slice(0, 2)
                .reduce((p, c) => p * c, 1)
        }
    }

    private static round(mod: number) {

        for (const monkey of this.monkeys) {

            while (monkey.items.length > 0) {
                const item = monkey.items.splice(0, 1)[0];
                monkey.inspections += 1;
                let level = monkey.operation(item) % mod;
                if (level % monkey.test == 0) {
                    this.monkeys[monkey.nextTrue].items.push(level);
                }
                else {
                    this.monkeys[monkey.nextFalse].items.push(level);
                }
            }
        }
    }

    static display() {

        for (let id in this.monkeys) {
            console.log(`monkey ${id}: ${this.monkeys[id].items}`);
        }
    }
}

const lines = await Input.ReadAll();
const status = Problem.Run(lines);
console.log(status);
