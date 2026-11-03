import type { Display2D, Style as Style2D, VectorWithContent } from "./Display2D.js";
import type { Display3D, Style as Style3D } from "./Display3D.js";
import type { Vector } from "./vector.js";

export class HeadlessDisplay implements Display2D, Display3D {
    init(_iterationsPerSecond?: number): Display2D {
        return this;
    }

    scrollIntoView(_pos: Vector, _smooth: boolean): Display2D {
        return this;
    }

    end(_result: Object): Display2D {
        return this;
    }

    log(_text: string): Display2D {
        return this;
    }

    fitBounds(_bounds?: { min: Vector; max: Vector }): Display2D {
        return this;
    }

    setLayer(_layer: number, _name: string, _config?: { defaultChar?: string; style: Style2D }): Display2D {
        return this;
    }

    setItems(_items: Iterable<VectorWithContent>, _layer?: number): Display2D {
        return this;
    }

    addItems(_items: Iterable<VectorWithContent>, _layer: number): Display2D {
        return this;
    }

    setTitle(_title: string): Display2D {
        return this;
    }

    nextStep(_text: string): Display2D {
        return this;
    }

    async checkpoint(): Promise<void> {
    }

    setStyle(_group: number, _style: Style3D): void {
    }

    start(): void {
    }

    addBlock(_x: number, _y: number, _z: number, _group: number): void {
    }

    move(_sourceGroup: number, _targetGroup: number): void {
    }

    fadeOut(_group: number, _opacity: number): void {
    }

    clear(_group: number): void {
    }

    async pause(): Promise<void> {
    }

    center(_groupOrX: number, _y?: number, _z?: number): void {
    }
}
