export type Status = {
    result: number;
}

type Monkey = {
    items: number[];
    operation: (old: number) => number;
    test: (input: number) => number;
    nextTrue: number;
    nextFalse: number;
    inspections: number;
};
export class Problem {

    monkeys = [];

    Run(lines: string[]): Status | undefined {

        /* sample monkey
        Monkey 0:
        Starting items: 93, 54, 69, 66, 71
        Operation: new = old * 3
        Test: divisible by 7
        If true: throw to monkey 7
        If false: throw to monkey 1
        */

        for (let i = 0; i + 5 < lines.length; i+=7) {
            const monkey = this.parseMonkey(lines.slice(i, i+6));
            this.monkeys.push(monkey);
        }

        for (let i = 0; i < 20; i++) {
            this.round();
            this.display();
        }

        console.log(`inspections: ${this.monkeys
            .map(monkey => monkey.inspections)
            .sort((a, b) => b-a)
        }`);
        
        const product = this.monkeys
            .map(monkey => monkey.inspections)
            .sort((a, b) => b-a)
            .slice(0, 2)
            .reduce((p, c) => p * c, 1);
        return {
            result: product
        }
    }

    private parseMonkey(lines: string[]): Monkey {
            const monkey: Monkey = {
                items: [],
                operation: (old) => old,
                test: (input) => input,
                nextTrue: 0,
                nextFalse: 0,
                inspections: 0
            };
            lines[0].match(/Monkey \d+/);
            monkey.items = Array.from(lines[1].matchAll(/(\d+)/g)).map(item => parseInt(item[0], 10));
            const operation = lines[2].match(/Operation: new = (.+)/)[1];
            monkey.operation = new Function("old", `return ${operation}`) as Monkey["operation"];
            const divisibleBy = lines[3].match(/Test: divisible by (\d+)/)[1];
            monkey.test = new Function("input", `return input % ${parseInt(divisibleBy)}`) as Monkey["test"];
            monkey.nextTrue = parseInt(lines[4].match(/If true: throw to monkey (\d+)/)[1]);
            monkey.nextFalse = parseInt(lines[5].match(/If false: throw to monkey (\d+)/)[1]);

            console.log(monkey);

            return monkey;
    }

    private round() {

        for (const monkey of this.monkeys) {

            while (monkey.items.length > 0) {
                const item = monkey.items.splice(0, 1)[0];
                monkey.inspections += 1;
                let level = Math.floor(monkey.operation(item) / 3);
                if (monkey.test(level) == 0) {
                    this.monkeys[monkey.nextTrue].items.push(level);
                }
                else {
                    this.monkeys[monkey.nextFalse].items.push(level);
                }
            }
        }
    }

    display() {

        for (let id in this.monkeys) {
            console.log(`monkey ${id}: ${this.monkeys[id].items}`);
        }
    }
}
