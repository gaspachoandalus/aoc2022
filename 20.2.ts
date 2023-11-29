import { assert } from "console";
import { sign } from "crypto";
import * as fs from "fs/promises"

// const INPUT = "./testInput.txt";
const INPUT = "./input.txt";
const DECRYPTION_KEY = 811589153;
// const DECRYPTION_KEY = 1;
const ITERATIONS = 10;

export class Input {

    static async ReadAll(): Promise<string> {
        const buffer = await fs.readFile(INPUT);
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

export class Problem {

    static list: Array<string> = [];
    // static numberPosition: Map<string, number>;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);
        console.log("list", this.list);
        // console.log("map", this.numberPosition);

        // tests
        console.log("test1", this.move([ "1_0", "2_0", "3_0" ], 1, 3));
        console.log("test1", this.move([ "1_0", "2_0", "3_0" ], 1, -3));
        console.log("test1", this.move([ "1_0", "3_0", "2_0" ], 1, 1));

        let list = [ ...this.list ];
        for (let i = 0; i < ITERATIONS; i++) {
            list = this.moves(list);
        }

        const zeroIndex = list.findIndex(c => c == "0_0");
        const result =
            this.getNumberFromKey(list[(zeroIndex + 1000) % this.list.length]) +
            this.getNumberFromKey(list[(zeroIndex + 2000) % this.list.length]) +
            this.getNumberFromKey(list[(zeroIndex + 3000) % this.list.length]);

            console.log(result);

        return {
            part1: 0,
            part2: 0
        };
    }

    static getNumberFromKey(s: string) {
        return parseInt(s.split("_")[0]);
    }

    static moves(list: string[]): Array<string> {

        for (let i = 0; i < this.list.length; i++) {
            const value = this.list[i];
            Problem.moveValue(list, value);
        }

        console.log("newlist", list);

        return list;
    }

    private static moveValue(list: string[], value: string) {

        const pos = list.findIndex(c => c == value);
        let move = Problem.getNumberFromKey(list[pos]);

        return this.move(list, pos, move);
    }

    private static move(list: string[], pos: number, move: number) {

        // move %= newList.length;
        // let newPos = pos + (move % newList.length);
        // if (Math.sign(move) < 0) newPos--; 
        // newPos += newList.length;
        // newPos %= newList.length;
        // 0   1   2   3   4   5   6
        // 1,  2, -3,  9, -2,  0,  4
        let newBeforePos;
        if (move > 0) {
            newBeforePos = pos + (move % (list.length - 1)) + 1;
            if (newBeforePos > list.length) {
                newBeforePos -= list.length;
            }
        }
        else if (move < 0) {
            newBeforePos = pos + (move % (list.length - 1));
            if (newBeforePos == 0) {
                newBeforePos = list.length;
            }
            else if (newBeforePos < 0) {
                newBeforePos += list.length;
            }
        }
        else { // move == 0
            newBeforePos = pos; // no move
        }

        if (newBeforePos != pos) {
            const value = list.splice(pos, 1)[0];

            // if (newPos == 0)
            //     newList.splice(newList.length, 0, value); // put at end instead of start
            if (pos < newBeforePos)
                list.splice(newBeforePos - 1, 0, value);

            else
                list.splice(newBeforePos, 0, value);
        }

        return list;
    }

    static parse(lines: string[]): void {

        const list = lines.map(c => parseInt(c) * DECRYPTION_KEY);

        const map = new Map<string, number>();
        for (let i = 0; i < list.length; i++) {

            let subscript = 0;
            do {
                let name = `${list[i]}_${subscript}`;
                if (map.has(name)) {
                    subscript++;
                }
                else {
                    this.list.push(name);
                    map.set(name, i);
                    break;
                }
            }
            while (true);
        }

        // this.numberPosition = map;
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
