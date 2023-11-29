import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';
import { Vector, moves, distance, vectorAsString, mod } from "./utils/vector.js";

export type Status = {
    part1: number;
    part2: number;
}

export class AOC {

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        // TODO

        return {
            part1: 0,
            part2: 0
        };
    }

    static parse(lines: string[]): void {

        // TODO
    }
}