   
export const green = 0x2bee2e;
export const blue = 0x3689ff;
export const red = 0xe62020;
export const pink = 0xfc03d7;
export const orange = 0xff8614;
export const white = 0xffffff;
export const yellow = 0xf1f73e;

export type Style = {
    name?: string,
    color?: number,
    transparent?: boolean,
    opacity?: number
};

export const enum Colors {
    green = 0x2bee2e,
    blue = 0x3689ff,
    red = 0xe62020,
    pink = 0xfc03d7,
    orange = 0xff8614,
    white = 0xffffff,
    yellow = 0xf1f73e,
}

export interface Display3D
{
    init(iterationsPerSecond?: number);
    /**
     * defines attributes of a group of voxels
     * @param group group id
     * @param style characteristics
     */
    setStyle(group: number, style: Style);
    start(): void;
    log(text: string);
    addBlock(x: number, y: number, z: number, group: number);
    move(sourceGroup: number, targetGroup: number);
    fadeOut(group: number, opacity: number);
    clear(group: number);
    pause(): Promise<void>;
    checkpoint(): Promise<void>;
    center(group: number): void;
    center(x: number, y: number, z: number): void;
    center(x: number, y?: number, z?: number): void;
}
