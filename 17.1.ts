import { Vector, vectorAsString } from "./utils/vector.js";
import { Display2D, Colors } from "./utils/Display2D.js";

export type Status = {
    part1?: number;
    part2?: number;
}

export const config = {
    type: "2D"
};

const shapes = [

    [
        "####"
    ],

    [
        ".#.",
        "###",
        ".#."
    ],

    [
        "..#",
        "..#",
        "###"
    ],

    [
        "#",
        "#",
        "#",
        "#"
    ],

    [
        "##",
        "##"
    ]
];

export class AOC {

    display: Display2D;
    jets: Array<string>;
    shape = 0;
    top = 0;
    jet = 0;
    occupied = new Map<string, Vector>();
    pos: Vector;

    constructor(display: Display2D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        this.parse(lines);

        this.display
            .init(95)
            .setLayer(0, "Horizontal bar", { style: { bgColor: Colors.yellow } })
            .setLayer(1, "Plus", { style: { bgColor: Colors.blue } })
            .setLayer(2, "Reverse L", { style: { bgColor: Colors.green } })
            .setLayer(3, "Vertical bar", { style: { bgColor: Colors.white } })
            .setLayer(4, "Square", { style: { bgColor: Colors.red } })
        this.display.fitBounds({ min: { x: 0, y: 0 }, max: { x: 7, y: 10 } });

        for (let i = 0; i < 2022; i++) {
            // console.log("simulateRock", i);
            await this.simulateRock();
        }

        return {
            part1: this.top
        };
    }

    async simulateRock() {

        this.pos = { 
            x: 2,
            y: this.top + shapes[this.shape].length + 3
        };

        do {
            // this.display(10, 10);
            this.simulateJet()
            // this.display(10, 10);
        }
        while (this.fallDown());

        await this.display.checkpoint();
        // this.display(10, 10);
        this.save();
        // this.display(this.top + 2, 25);

        this.shape = (this.shape + 1) % shapes.length; // next shape
    }

    simulateJet() {
        const jet = this.jets[this.jet];
        this.jet = (this.jet + 1) % this.jets.length;

        const shape = shapes[this.shape];

        // console.log();
        // console.log("jet", jet);

        if (jet == "<") {

            if (this.pos.x == 0) {
                return false;
            }
            
            if (!this.checkCollision({x: -1, y: 0})) {
                this.pos.x--;
                return true;
            }
        }
        else if (jet == ">") {
            const shapeWidth = shape[0].length;

            if (this.pos.x + shapeWidth == 7) {
                return false;
            }

            if (!this.checkCollision({x: +1, y: 0})) {
                this.pos.x++;
                return true;
            }
        }
    }

    fallDown(): boolean {
        const shape = shapes[this.shape];
        const shapeWidth = shape[0].length;
        const shapeHeight = shape.length;

        // console.log("falldown");

        if (this.pos.y - shapeHeight != 0) // not at bottom
        {
            if (!this.checkCollision({x: 0, y: +1})) {
                this.pos.y--;
                return true;
            }
        }

        return false;
    }

    checkCollision(direction: Vector): boolean {

        const shape = shapes[this.shape];
        const shapeWidth = shape[0].length;
        const shapeHeight = shape.length;

        for (let y = 0; y < shapeHeight; y++) {
            for (let x = 0; x < shapeWidth; x++) {

                if (shape[y][x] == "#") {
                    if (this.occupied.has(vectorAsString({x: this.pos.x + direction.x + x, y: this.pos.y - direction.y - y}))) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    save() {
        const shape = shapes[this.shape];
        const shapeWidth = shape[0].length;
        const shapeHeight = shape.length;

        this.top = Math.max(this.top, this.pos.y);

        for (let y = 0; y < shapeHeight; y++) {
            for (let x = 0; x < shapeWidth; x++) {
                if (shape[y][x] == "#") {
                    const occupiedPos = {x: this.pos.x + x, y: this.pos.y - y};
                    this.occupied.set(vectorAsString(occupiedPos), occupiedPos);
                    this.display.addItems([occupiedPos], this.shape % 5);
                }
            }
        }

        this.display.scrollIntoView({x: 0, y: this.top - 5}, false);

        this.pos = null;
    }

    parse(lines: string[]): void {

        this.jets = lines[0].split("");
    }
}
