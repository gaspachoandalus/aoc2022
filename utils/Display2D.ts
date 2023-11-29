import { Vector } from "./vector.js";

export interface VectorWithContent extends Vector {
    content?: string;
}

export interface Color {
    r: number;
    g: number;
    b: number;
    a?: Number;
}

export interface Style {
    color?: Color;
    bgColor?: Color;
    bold?: boolean;
    strike?: boolean;
}

export namespace Colors {
    export const black = {
        r: 0x0,
        g: 0x0,
        b: 0x0,
        a: 0x0
    };
    export const white = {
        r: 0xff,
        g: 0xff,
        b: 0xff
    };
    export const red = {
        r: 0xff,
        g: 0x0,
        b: 0x0
    };
    export const blue = {
        r: 0x0,
        g: 0x0,
        b: 0xff,
        // a: 0xff
    };
    export const yellow = {
        r: 0xf1,
        g: 0xf7,
        b: 0x3e,
        a: 0x66
    };
    export const green = {
        r: 0x0,
        g: 0xff,
        b: 0x0,
        // a: 0xff
    };
}

/**
 * Sample usage:
 * Terminal.init(); // starts the loop, renders at 60 fps, handle keypress to move around, space to stop
 * Terminal.setItem([{x: 0, y: 0}, {x: 1, y: 1}]); // accepts an Iterable
 * Terminal.addItem([{x: 0, y: 0}, {x: 1, y: 1}]); // accepts an Iterable
 * Terminal.setTitle("my simulation");
 * Terminal.throttle() // breaks heavy operations in the simulation to let the JS engine handle events, redraw screen, pauses the simulation if requested
 */
export interface Display2D {
    init(iterationsPerSecond?: number): Display2D;
    scrollIntoView(pos: Vector, smooth: boolean): Display2D;
    end(result: Object): Display2D;
    log(text: string): Display2D;
    setBoundaries(boundaries?: { min: Vector; max: Vector; }): Display2D;
    setLayer(layer: number, name: string, config?: { defaultChar?: string; style: Style; }): Display2D;
    setItems(items: Iterable<VectorWithContent>, layer?: number): Display2D;
    addItems(items: Iterable<VectorWithContent>, layer: number): Display2D;
    setTitle(title: string): Display2D;
    nextStep(text: string): Display2D;
    throttle(ratio?: number): Promise<void>;
    }
