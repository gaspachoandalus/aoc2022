import * as fs from "fs/promises"

export class Input {

    static async ReadAll(): Promise<string> {
        const buffer = await fs.readFile("./input.txt");
        return buffer.toString("utf-8");
    }

    static async ReadLines(): Promise<string[]> {
        return (await this.ReadAll()).split("\n");
    }
}

export type Status = {
    part1: number;
    part2: number;
}

interface Vector {
    x: number,
    y: number
}

const moves: Array<Vector> = [
    { x:  1, y:  0 },
    { x: -1, y:  0 },
    { x:  0, y:  1 },
    { x:  0, y: -1 }
];

type RecursiveArray = Array<number|RecursiveArray>;
    
export class Problem {

    static Run(content: string): Status | undefined {

        let packets: Array<RecursiveArray> = content.split("\n")
            .reduce((p, line) => {
                if (line == "") return p;
                p.push(line);
                return p;
            }, [])
            .map(v => eval(v));

        packets.push([[2]]);
        packets.push([[6]]);

        console.log(JSON.stringify(packets));

        packets.sort((a, b) => {
            const compare = this.compareArrays(a, b);
            if (compare === true) return -1;
            if (compare === false) return 1;
            return 0;
        });

        function isDivider(v: RecursiveArray) {
            return Array.isArray(v) && v.length == 1 && Array.isArray(v[0]) && v[0][0] == 2;
        }

        const indexDivider2 = packets.findIndex((v, i) => isDivider(v));
        const indexDivider6 = packets.findIndex((v, i) => isDivider(v));

        // console.log(JSON.stringify(packets));


        // const part1 = packets.reduce((p, pairs, i) => {
        //     const ordered = this.compareArrays(pairs[0], pairs[1]);
        //     console.log(`pair ${i+1} (${JSON.stringify(pairs[0])};${JSON.stringify(pairs[1])}): ${ordered}`);

        //     return ordered ? p + (i + 1) : p;
        // }, 0);

        return {
            part1: 0,
            part2: (indexDivider2 + 1) * (indexDivider6 + 1)
        };
    }

    static compareArrays(leftArray: RecursiveArray, rightArray: RecursiveArray) {

        for (let i = 0; i < leftArray.length; i++)
        {
            let left = leftArray[i];
            let right = rightArray[i];
            let ordered = null;

            // If the right list runs out of items first, the inputs are not in the right order
            if (right == null) {
                return false;
            }

            if (typeof left == "number" && typeof right == "number") {
                if (left < right) {
                    return true;
                }
                else if (left > right) {
                    return false;
                }
                // else continue comparison
            }
            else 
            {
                if (typeof left == "number") {
                    left = [ left ];
                }
                if (typeof right == "number") {
                    right = [ right ]
                }
                ordered = this.compareArrays(left, right);
            }

            if (ordered != undefined) return ordered;
        }

        // If the left list runs out of items first, the inputs are in the right order.
        if (leftArray.length < rightArray.length) return true;

        // If the lists are the same length and no comparison makes a decision about the order, continue checking the next part of the input.
    }

    static parse(lines: string[]): void {

        // TODO
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadAll();
const status = Problem.Run(lines);
console.log(status);
