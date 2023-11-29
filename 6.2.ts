import * as fs from "fs/promises"

class Input {
    static async Read(): Promise<string[]> {
        const buffer = await fs.readFile("./input.txt");
        const lines = buffer.toString("utf-8").split("\n");
        return lines;
    }
}

type Status = {
    result: number;
    sequence: string;
}

class Problem {
    static stacks: Array<Array<string>> = [];
    static line = 0;

    static Run(lines: string[]): Status | undefined {

        const line = lines[0];

        return this.findDistinct(line, 14);
    }

    static findDistinct(line: string, size: number): Status | undefined {
        for (let i = 0; i < line.length; i++) {

            if (this.areDistinct(line.slice(i, i+size))) {
                return {
                    result: i+size,
                    sequence: line.slice(i,i+size)
                }
            }
        }
    }

    static areDistinct(text: string) {

        for (let i1 = 0; i1 < text.length; i1++)
        {
            for (let i2 = i1+1; i2 < text.length; i2++)
            {
                if (text[i1] == text[i2]) {
                    return false;
                }
            }
        }

        return true;
    }
}

const lines = await Input.Read();
const status = Problem.Run(lines);
console.log(status);
