type Status = {
    result: string;
}

export class Problem {
    static stacks: Array<Array<string>> = [];
    static line = 0;

    static Run(lines: string[]): Status {

        this.ParseStacks(lines);

        for (; this.line < lines.length; this.line++)
        {
            this.ParseMove(lines[this.line]);
        }

        console.log(this.stacks);

        return {
            result: this.Result()
        }
    }

    static ParseStacks(lines: string[]) {

        for (; lines[this.line] != ""; this.line++) {
            if (lines[this.line][1] == "1") continue;
            this.ParseStack(lines[this.line]);
        }

        for (let stackId = 0; stackId < this.stacks.length; stackId++)
        {
            this.stacks[stackId].reverse();
        }

        this.line++; // ignore empty line

        console.log(this.stacks);
    }

    static ParseStack(line: string) {

/*
                [B]     [L]     [S]
        [Q] [J] [C]     [W]     [F]
    [F] [T] [B] [D]     [P]     [P]
    [S] [J] [Z] [T]     [B] [C] [H]
    [L] [H] [H] [Z] [G] [Z] [G] [R]
[R] [H] [D] [R] [F] [C] [V] [Q] [T]
[C] [J] [M] [G] [P] [H] [N] [J] [D]
[H] [B] [R] [S] [R] [T] [S] [R] [L]
 1   2   3   4   5   6   7   8   9 

move 8 from 7 to 1
*/

        const stacks = line.length / 4;

        for (let stackId = 0; stackId < stacks; stackId++)
        {
            const container = line[stackId * 4 + 1];
            if (container != " " && container != null) {
                if (!this.stacks[stackId])
                {
                    this.stacks[stackId] = [];
                }

                this.stacks[stackId].push(container);
            }
        }
    }

    static ParseMove(line: string)
    {
        const parsedMove = line.match(/move (\d+) from (\d+) to (\d+)/);
        const count = parseInt(parsedMove[1]);
        const from = parseInt(parsedMove[2]);
        const to = parseInt(parsedMove[3]);
        
        const fromStack = this.stacks[from - 1];
        const containers = fromStack.splice(fromStack.length - count);
        this.stacks[to - 1].push(...containers);
    }

    static Result(): string
    {
        let result = "";
        for (let stack = 0; stack < this.stacks.length; stack++)
        {
            const stackSize = this.stacks[stack].length;
            result += this.stacks[stack][stackSize - 1];
        }

        return result;
    }
}
