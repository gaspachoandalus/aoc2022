import { Pause } from './Pause.js';
import { sleep } from './vector.js';

export class Checkpoint {

    private static maxPerSeconds = 0;
    private static items = [];
    private static lastCheckPoint = 0;
    private static _countPerSecond = 0;
    private static lastSleep = 0;
    
    static get countPerSecond(): number {

        return this._countPerSecond;

    }

    static init(maxPerSeconds:number) {
        this.maxPerSeconds = maxPerSeconds;
    }

    static async throttle(maxPerSeconds:number, ratio: number = 1): Promise<void> {

        if (Pause.paused()) {
            return await Pause.wait();
        }
        else {
            const maxRatePerSecond = maxPerSeconds ?? this.maxPerSeconds;
            const minDelayMs = (1 / maxRatePerSecond) * 1000;
            const now = performance.now();
            const deltaTime = this.lastCheckPoint ? now - this.lastCheckPoint : 0;
            this.items.push(now);
            if (this.items.length > 100) {
                this.items.shift();
            }

            this._countPerSecond = this.items.length / (this.items[this.items.length - 1] - this.items[0]) * 1000;

            if (this.items.length > 1) {
                const meanDelay = (this.items[this.items.length - 1] - this.items[0]) / this.items.length;
                if (now - this.lastSleep > 1000/30) {
                    this.lastSleep = now;
                    await sleep(0);
                }
                else if (maxPerSeconds != -1 && meanDelay < minDelayMs) {
                    this.lastSleep = now;
                    await sleep(minDelayMs - deltaTime);
                }
            }

            this.lastCheckPoint = performance.now();
        }
    }
}
