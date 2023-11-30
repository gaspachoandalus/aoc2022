import { Colors, Display2D } from "./utils/Display2D.js";
import { Vector, sleep } from "./utils/vector.js";

enum Test {
    basicText,
    fill,
    random,
    scrollIntoView
};

const test: Test = Test.basicText;

export class AOC {

    display: Display2D;

    constructor(display: Display2D) {
        this.display = display;
    }

    public async Run() {

        this.display.setBoundaries({ min: { x: 0, y: -4}, max: null });

        switch (test) {
            case Test.basicText:
                let y = 0;
                const sampleText = "the little brown fox jumps over the lazy dog";

                for (let layer of [0, 1, 2, 3]) {

                    this.display.addItems([{ x: 0, y, content: sampleText }], layer);
                    this.display.addItems([{ x: sampleText.length + 10, y, content: layer.toString() }], 0);
                    y++;
                    await this.display.throttle();
                }
                break;

            case Test.fill:
                // fill a region
                for (let x = 0; x < 8; x++) {
                    for (let y = 0; y < 8; y++) {
                        this.display.addItems([{
                            x,
                            y
                        }],
                            3);
                        await this.display.throttle();
                    }
                }
                break;

            case Test.random:
                this.randomFill(10000, async () => await this.display.throttle());
                break;

            case Test.scrollIntoView:
                // randomly fill the region
                this.randomFill(1000);
                await sleep(1000);

                let position: Vector = { x: 0, y: 0 };
                for (let i = 0; i < 100; i++) {
                    position = {
                        x: position.x + (Math.random() * 200 - 100),
                        y: position.y + (Math.random() * 200 - 100)
                    };
                    this.display.setItems([{...position}], 2);
                    this.display.log(`moving to ${JSON.stringify(position)}`);
                    this.display.scrollIntoView(position, true);
                    await sleep(3000);
                    this.display.addItems([{...position}], 3);
                }
                break;
        }
    }

    private randomFill(count: number, cb: Function = null) {
        for (let i = 0; i < count; i++) {

            this.display.addItems([{
                ...this.getRandomPoint(),
                content: i.toString()
            }],
                0);
            if (cb) {
                cb();
            }
        }
    }

    private getRandomPoint(): Vector {
        return {
            x: Math.trunc(-300 + Math.random() * 600),
            y: Math.trunc(-300 + Math.random() * 600),
        };
    }
}
