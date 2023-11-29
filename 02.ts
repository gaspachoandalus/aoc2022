import * as fs from "fs/promises"
import * as path from "path";
import * as url from 'url';

const enum Shapes {
    Rock = 0,
    Paper = 1,
    Scissors = 2
}

const WinningShapeAgainst = {
    [Shapes.Paper]:     Shapes.Scissors,
    [Shapes.Rock]:      Shapes.Paper,
    [Shapes.Scissors]:  Shapes.Rock
}

const LosingShapeAgainst = {
    [Shapes.Paper]:     Shapes.Rock,
    [Shapes.Rock]:      Shapes.Scissors,
    [Shapes.Scissors]:  Shapes.Paper
}

const enum Target {
    Lose = 0,
    Draw = 1,
    Win = 2
}

type Status = {
    part1: number;
    part2: number;
}

class AOC
{
    static Run(lines: string[]): Status
    {
        const status = {
            part1: 0,
            part2: 0
        };

        status.part1 = lines.reduce((prev, current) => {

            const { a: other, b: me } = AOC.ParseLine(current);
            return prev + AOC.ShapeScore(me) + AOC.RoundScore(me, other);
        }, 0);

        status.part2 = lines.reduce((prev, current) => {

            const { a: other, b: target } = AOC.ParseLine(current);
            const me = AOC.WhatShouldIPlay(other, target);
            return prev + AOC.ShapeScore(me) + AOC.RoundScore(me, other);
        }, 0);

        return status;
    }

    static ParseLine(line: string): {a: number, b: number} {
        const shapes = line.split(" ");
        const a = shapes[0].charCodeAt(0) - 'A'.charCodeAt(0);
        const b  = shapes[1].charCodeAt(0) - 'X'.charCodeAt(0);
    
        return { a, b };
    }

    static WhatShouldIPlay(other: Shapes, target: Target): Shapes
    {
        let me: Shapes;
        switch (target) {
            case Target.Draw: me = other; break;
            case Target.Win:  me = WinningShapeAgainst[other]; break;
            case Target.Lose: me = LosingShapeAgainst[other]; break;
        }

        return me;
    }

    static ShapeScore(shape: Shapes) {
        return shape + 1;
    }
    
    static RoundScore(shape1: Shapes, shape2: Shapes): number {
        if (shape1 == shape2) {
            return 3; // draw
        }
        else if (
            (shape1 == Shapes.Rock && shape2 == Shapes.Scissors) ||
            (shape1 == Shapes.Scissors && shape2 == Shapes.Paper) ||
            (shape1 == Shapes.Paper && shape2 == Shapes.Rock)
        ) {
            return 6; // win for shape1
        }
        else {
            return 0; // loose for shape1
        }
    }
}