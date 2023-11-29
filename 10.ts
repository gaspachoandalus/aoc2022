import { Vector } from "./utils/vector.js";
import { Display2D } from "./utils/Display2D.js";

export type Status = {
    part1: number;
    part2: number;
}

const CRT_WIDTH = 40;

export class AOC {

    display: Display2D;
    crt: Array<string> = [];
    crtPosition = 0;
    register = 1;
    cycle = 1;

    constructor(display: Display2D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        let accumulator = 0;

        this.display.init(20);

        for (let line of lines) {

            // parse CPU operation
            // console.log(line);
            const splitted = line.split(" ");
            let operation = splitted[0];

            let cycles;
            let valueAfter;

            if (operation == "addx") {
                const value = parseInt(splitted[1]);
                cycles = 2;
                valueAfter = this.register + value;
            }
            else if (operation == "noop") {
                cycles = 1;
                valueAfter = this.register;
            }

            // simulate cycles
            for (let i = 0; i < cycles; i++, this.cycle++, this.crtPosition++) {

                // simulate CRT
                await this.Cycle();
            }

            this.register  = valueAfter;

            await this.displayCRT();
         }

        return {
            part1: 0,
            part2: accumulator
        }
    }

    private async Cycle() {

        if (Math.abs(this.crtPosition % CRT_WIDTH - this.register) < 2) {
            this.crt.push("#");
        }
        else {
            this.crt.push(" ");
        }

        await this.displayCRT();
    }

    async displayCRT() {

        const items: Array<Vector> = [];
        for (let i = 0; i < this.crt.length; i ++) {
            // const line = this.crt.slice(i, i + CRT_WIDTH).join("");
            // console.log(`CRT: ${line}`);
            if (this.crt[i] == "#") {
                items.push({x: i % CRT_WIDTH, y: Math.floor(i / CRT_WIDTH)});
            }
        }
        await this.display
            .setTitle(this.register.toString())
            .setItems([{x: this.crtPosition % CRT_WIDTH, y: Math.floor(this.crtPosition / CRT_WIDTH)}], 1)
            .setItems([{x: this.register % CRT_WIDTH, y: Math.floor(this.crtPosition / CRT_WIDTH)}], 3)
            .setItems([
                {x: (this.crtPosition - 1) % CRT_WIDTH, y: Math.floor((this.crtPosition - 1) / CRT_WIDTH)},
                {x: (this.crtPosition)     % CRT_WIDTH, y: Math.floor((this.crtPosition)     / CRT_WIDTH)},
                {x: (this.crtPosition + 1) % CRT_WIDTH, y: Math.floor((this.crtPosition + 1) / CRT_WIDTH)}
            ], 2)
            .setItems(items)
            .throttle();
    }
}
