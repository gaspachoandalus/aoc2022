const COUNT = 1_000_000_000_000;
const KEEP_LINES = 30;

const WIDTH = 7;
const debug = typeof process !== "undefined" && Boolean(process.env.DEBUG);

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

const shapesWidth = [
    4,
    3,
    3,
    1,
    2
];

const shapes = [

    [
        0b1111 // "####"
    ],

    [
        0b010, //".#.",
        0b111, // "###",
        0b010  // ".#."
    ],

    [
        0b001, // "..#",
        0b001, // "..#",
        0b111, // "###"
    ],

    [
        0b1, // "#",
        0b1, // "#",
        0b1, // "#",
        0b1, // "#",
    ],

    [
        0b11, // "##",
        0b11, // "##",
    ]
];

export class Problem {

    static jets: Array<string>;
    static shape = 0;
    static top = 0;
    static previousTop = 0;
    static jet = 0;
    // static occupied = new Map<string, boolean>();
    static tower = new Map<number, {line: number, iteration: number}>();
    static pos: number;
    static currentShape: Array<number>;
    static currentShapeHeight: number;
    static pattern = { number: 0, last: 0, start: 30, length: 0 };
    static maxPatternLength;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        /*
line   24 !     11!    14
line   25 !     11!    14
line   26 !  1111 !    15 <==
line   27 !   1   !    16
line   28 !  111  !    16

line   76 !  1111 !    46
line   77 !  111  !    47
line   78 !  111  !    47
line   79 !  1111 !    50 <==
line   80 !   1   !    51
line   81 !  111  !    51

         */
        // ligne 26 à 78: 53 lignes répétition
        // => rocks 50-15 = 35

        // 1. 25 lignes => 15 formes
        // 2. répétition 35 rocks => 53 lignes
        //
        // 1_000_000_000_000 => (1_000_000_000_000 - 15) * 53 / 35 + 25 = 1514285714263
        
        /*
line  520 !  11 11!   342
line  521 !   1 11!   343
line  522 !  1111 !   345 <==
line  523 !  1 1  !   346
line  524 ! 1111  !   346

line 3214 !   11  !  2077
line 3215 !   1   !  2078
line 3216 !   1   !  2078
line 3217 !  1111 !  2080 <==
line 3218 !  1 1  !  2081
line 3219 ! 1111  !  2081

        */
        // 
        // 3217 - 522 = 2695 lignes
        // 2080 - 345 = 1735 formes

        // 1. 521 lignes => 345 formes
        // 2. 2695 lignes => 1735 formes (répétition)

        // > (1_000_000_000_000 - 345) % 1735 = 1530 formes

        //                   1_000_000_000_000
// (1_000_000_000_000 - 345 - 1530) * 2695 / 1735 + 521 + 2373 = 1553314121019

        // const COUNT_ROCKS = 2022;
        const COUNT_ROCKS = 345 + 1735 + 1530;
        console.log(521 + 2695 + 2373);

        for (let i = 0; i < COUNT_ROCKS; i++) {
            debug && console.log("simulateRock", i);
            this.simulateRock(i);

            // this.display(this.previousTop - (KEEP_LINES - 1), this.top - this.previousTop, 1, false, i);
        }

        // this.display(this.top + 2, this.top + 2);

        return {
            part1: this.top,
            part2: 0
        };
    }

    static simulateRock(iteration: number) {

        const width = shapesWidth[this.shape];
        this.currentShape = shapes[this.shape].map(c =>  c << (7 - width) >> 2);
        this.currentShapeHeight = shapes[this.shape].length;
        this.pos = this.top + shapes[this.shape].length + 3;

        do {
            debug && this.display();
            this.simulateJet()
            debug && this.display();

        }
        while (this.fallDown());

        debug && this.display();
        this.save(iteration);
        debug && this.display();

        // this.detectPattern(30);
        
        if (iteration % 100 == 0) {
            this.cleanOld(KEEP_LINES);
        }

        this.shape = (this.shape + 1) % shapes.length; // next shape
    }

    static detectPattern(keepLength: number) {

        // pattern matching
        if (this.top > keepLength) {

            if (this.pattern.last == 0) {
                this.pattern.last = keepLength;
            }

            for (let y = this.previousTop; y <= this.top; y++) {
    
                this.pattern.number += this.tower.get(y).line;
                this.pattern.length++;
    
                if (this.pattern.length == this.maxPatternLength) {
                    console.log("pattern", this.pattern.number, this.pattern.start, this.pattern.length);
                    this.pattern = {
                        number: 0,
                        last: this.top,
                        length: 0,
                        start: y+1
                    }
                }

            }
        }

    }

    static cleanOld(keepLength: number) {

        // cleanup
        for (const [ y, item ] of this.tower.entries()) {
            if (y < this.top - keepLength) {
                this.tower.delete(y);
            }
        }
    }

    static simulateJet() {
        const jet = this.jets[this.jet];
        this.jet = (this.jet + 1) % this.jets.length;

        // console.log();
        debug && console.log("jet", jet);

        for (let y = 0; y < this.currentShapeHeight; y++) {

            const touchesBorder = this.currentShape[y] & ((jet == "<") ? 0b1000000 : 0b0000001);
            if (touchesBorder) {
                return false;
            }

            const shifted = (jet == "<") ?
                this.currentShape[y] << 1 :
                this.currentShape[y] >> 1;
            if (shifted & this.tower.get(this.pos - y)?.line) {
                return false;
            }
        }

        for (let y = 0; y < this.currentShapeHeight; y++) {
            this.currentShape[y] = (jet == "<") ? this.currentShape[y] << 1 : this.currentShape[y] >> 1; 
        }
    }

    static fallDown(): boolean {

        debug && console.log("falldown");

        if (this.pos - this.currentShapeHeight == 0) // at bottom
        {
            return false;
        }

        for (let y = 0; y < this.currentShapeHeight; y++) {
            if ((this.tower.get(this.pos - y - 1)?.line & this.currentShape[y]) != 0) {
                return false;
            }
        }

        this.pos--;
        return true;
    }

    static save(iteration: number) {
        this.previousTop = this.top;
        this.top = Math.max(this.top, this.pos);

        for (let y = 0; y < this.currentShapeHeight; y++) {
            // this.tower.get(this.pos - y).line = this.tower.get(this.pos - y).line | this.currentShape[y];
            const level = this.tower.get(this.pos - y);
            this.tower.set(this.pos - y, {
                line: (level?.line ?? 0) | this.currentShape[y],
                iteration: level?.iteration ?? iteration
            });
        }

        this.pos = null;
    }

    static display(y?: number, height?: number, direction: number = -1, detail?: boolean, iteration?: number): void {

        if (y == undefined) {
            y = this.top + 2;
        }
        if (height == undefined) {
            height = 20;//this.pos + 2;
        }

        const shape = shapes[this.shape];
        const shapeHeight = shape.length;
        
        if (detail) {
            console.log();
            console.log("pos", this.pos);
            console.log("top", this.top)
            console.log("shape", this.shape, {height: shapeHeight});
        }

        for (; height > 0; height--, y += direction) {
            let line = "!";
            const level = this.tower.get(y);
            const occupied = level?.line ?? 0;

            let temporary = 0;
            if (this.pos && y <= this.pos && y > this.pos - this.currentShapeHeight) {
                temporary = this.currentShape[this.pos - y];
            }

            line += (occupied | temporary).toString(2).padStart(7).replace(/0/g, " ");
            line += "!"
            console.log(
                "line",
                y.toString().padStart(4, " "),
                line,
                (level?.iteration ?? -1).toString().padStart(5)
                );
        }
    }

    static parse(lines: string[]): void {

        this.jets = lines[0].split("");
        this.maxPatternLength = this.jets.length;
        console.log("jets count", this.jets.length);
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}
