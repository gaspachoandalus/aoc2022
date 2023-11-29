import * as dat from "lil-gui";
import { Vector, center, distance, lerp } from "./vector.js";
import { ItemHashStore } from "./ItemHashStore.js";
import { Quadtree, Rectangle, DebugRectangle } from "./QuadTree.js";
import { Display2D, Style, Colors } from "./Display2D.js";
import { Checkpoint } from "./Checkpoint.js";
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { Pause } from "./Pause.js";
import { Log } from "./Log.js";
import { Rect } from "terminal-kit";
import { RED_GREEN_RGTC2_Format } from "three";
import { assert } from "console";

export interface VectorWithContent extends Vector {
    content?: string;
}

const max_maxIterationsPerSecond = 1000;

enum Storage {
    Hash,
    Quadtree
};

const storage: Storage = Storage.Quadtree;

type Layer = {
    itemStore: ItemHashStore;
    quadtree: Quadtree<VectorWithContent>;
    initialized: boolean; // layer initialized once ?
    config: { defaultChar?: string, style?: Style };
    visible: boolean;
    lastRender?: number;
    name?: string;
    guiFolder?: dat.GUI
};

/**
 * Web based display of a 2D matrix
 */
export class DisplayWeb2D implements Display2D {

    canvas: HTMLCanvasElement = null;
    stats1: Stats.Panel;

    scale = 1;
    scaleLevel = 1;
    scaleChange: { center: Vector, increase: number } = null;
    boundaries: Vector = { x: 0, y: 0 };
    private scrollIntoViewRunning: {
        start: Vector,
        end: Vector,
        totalDuration: number,
        currentDuration: number,
        smooth: boolean
    } = null;
    private layersGui: dat.GUI;

    readonly simulation = {
        maxIterationsPerSecond: 200,
        display: null as Display2D,
        get pause(): boolean {
            return Pause.paused();
        },
        set pause(value: boolean) {
            Pause.toggle();
        },
        stats: true,
        get boundaries() {
            return this.display.displayCoordinates(this.display.boundaries);
        },
        get size() {
            return this.display.displayCoordinates({
                x: this.display.canvas.width / this.display.scale / this.display.charSize.x,
                y: this.display.canvas.height / this.display.scale / this.display.charSize.y
            });
        },
        get scale() {
            return (this.display.scale * 100).toFixed(0) + "%";
        }
    };

    private layers: Array<Layer> = Array(4);

    public static create() {

        return new DisplayWeb2D();
    }

    public constructor() {

        this.layers = [
            {
                itemStore: storage == Storage.Hash ? new ItemHashStore() : null,
                quadtree: storage == Storage.Quadtree ? this.createQuadtree() : null,
                config: {},
                initialized: true,
                visible: true
            },
            {
                itemStore: storage == Storage.Hash ? new ItemHashStore() : null,
                quadtree: storage == Storage.Quadtree ? this.createQuadtree() : null,
                config: {},
                initialized: true,
                visible: true
            },
            {
                itemStore: storage == Storage.Hash ? new ItemHashStore() : null,
                quadtree: storage == Storage.Quadtree ? this.createQuadtree() : null,
                config: {},
                initialized: true,
                visible: true
            },
            {
                itemStore: storage == Storage.Hash ? new ItemHashStore() : null,
                quadtree: storage == Storage.Quadtree ? this.createQuadtree() : null,
                config: {},
                initialized: true,
                visible: true
            },
        ]

        // default layers style
        this.layers[0].config = { defaultChar: "#", style: { color: Colors.white, bgColor: null } };
        this.layers[1].config = { defaultChar: " ", style: { color: Colors.red, bgColor: null } };
        this.layers[2].config = { defaultChar: " ", style: { color: null, bgColor: Colors.blue } };
        this.layers[3].config = { defaultChar: " ", style: { color: null, bgColor: Colors.green } };
    }

    public init(iterationsPerSecond?: number): Display2D {

        this.simulation.maxIterationsPerSecond = iterationsPerSecond ?? 100;

        if (this.canvas) {
            return this;
        }

        // canvas

        this.canvas = document.createElement("canvas");
        this.canvas.id = "canvas";
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;

        document.body.appendChild(this.canvas);

        window.requestAnimationFrame(this.animate.bind(this));

        // stats

        this.stats1 = new (Stats as any)();
        this.stats1.dom.id = "stats";
        document.body.appendChild(this.stats1.dom);

        // dat.gui
        const gui = new dat.GUI();
        const simulationFolder = gui.addFolder('Simulation');
        this.simulation.display = this;
        simulationFolder.add(this.simulation, "pause").name("paused").listen().onChange(value => {
            value ? Pause.pause() : Pause.continue();
        });
        simulationFolder.add(this.simulation, "stats").name("show stats").listen().onChange(value => {
            value ? this.stats1.dom.classList.remove("hidden") : this.stats1.dom.classList.add("hidden");
        });;;
        simulationFolder.add(this.simulation, 'maxIterationsPerSecond', 0, max_maxIterationsPerSecond, 1).name("max iterations/s");
        simulationFolder.add(this.simulation, 'boundaries').name("top left corner").disable().listen();
        simulationFolder.add(this.simulation, 'size').name("size in chars").disable().listen().decimals(2);
        simulationFolder.add(this.simulation, 'scale').name("scale").disable().listen().decimals(2);
        simulationFolder.open()

        this.layersGui = gui.addFolder("layers");

        // events

        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        this.canvas.addEventListener('pointerdown', (event: PointerEvent) => this.onTouchStart({ touches: [{ clientX: event.clientX, clientY: event.clientY }] } as any));
        this.canvas.addEventListener('pointerup', (event: PointerEvent) => this.onTouchEnd({ touches: [{ clientX: event.clientX, clientY: event.clientY }] } as any));
        this.canvas.addEventListener('pointermove', (event: PointerEvent) => this.onTouchMove({ touches: [{ clientX: event.clientX, clientY: event.clientY }] } as any));

        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });

        return this;
    }

    /**
     * request the engine to move to a specific point in 2D space
     * @param pos 
     * @param smooth 
     * @returns 
     */
    public scrollIntoView(pos: Vector, smooth: boolean = true): Display2D {

        // don't abort previous animation
        // if (this.scrollIntoViewRunning) {
        //     return this;
        // }

        const animationDuration = 1;
        const now = performance.now();

        const newBoundaries = this.scrollIntoViewChange(
            new Rectangle(
                this.boundaries.x,
                this.boundaries.y,
                this.canvas.width / this.scale / this.charSize.x,
                this.canvas.height / this.scale / this.charSize.y
            ),
            pos);

        this.scrollIntoViewRunning = {
            start: {...this.boundaries},
            end: { ...newBoundaries },
            currentDuration: 0,
            totalDuration: this.scrollIntoViewRunning
                ? Math.max(this.scrollIntoViewRunning.totalDuration - this.scrollIntoViewRunning.currentDuration, .1)
                : animationDuration,
            smooth
        }

        return this;
    }

    public end(result: Object): Display2D {
        return this;
    }

    public setBoundaries(boundaries?: { min: Vector, max: Vector }): Display2D {

        if (!boundaries) {
            // TODO: merge all layers
            const bounds = this.layers[0].quadtree.getBounds();
            this.boundaries = bounds.min;
            console.log(`boundaries: ${JSON.stringify(bounds)}`);
            // TODO: determine zoom level required to fit max
        }
        else {
            this.boundaries = boundaries.min;
        }

        return this;
    }

    private createQuadtree() {
        return Quadtree.create<VectorWithContent>(new Rectangle(-1024, -1024, 2048, 2048))
    }

    private createLayer(layer: number) {
        if (!this.layers[layer]) {
            this.layers[layer] = {
                initialized: true,
                config: null,
                lastRender: null,
                visible: true,
                name: layer.toString(),
                itemStore: storage == Storage.Hash ? new ItemHashStore() : null,
                quadtree: storage == Storage.Quadtree ? this.createQuadtree() : null,
            }
        }
    }

    public setLayer(layerId: number, name: string, config?: { defaultChar?: string, style: Style }): Display2D {
        this.createLayer(layerId);
        if (config) {
            this.layers[layerId].config = { ...config };
        }
        if (name) {
            this.layers[layerId].name = name;
        }
        this.addLayerGui(layerId);

        const layerObj = this.layers[layerId];
        const groupName = layerObj.name ? `${layerObj.name} (${layerId})` : `${layerId}`;
        return this;
    }

    private addLayerGui(layerId: number) {
        const layer = this.layers[layerId];
        if (!layer.guiFolder) {
            const name = layer.name ?? `${layerId}`;

            layer.guiFolder = this.layersGui.addFolder(name);

            if (layer.config?.style?.color) {
                layer.guiFolder.addColor(layer.config.style, "color", 255).name("text color");
            }
            if (layer.config?.style?.bgColor) {
                layer.guiFolder.addColor(layer.config.style, "bgColor", 255).name("background");
            }
        }
    }

    public setItems(items: Iterable<VectorWithContent>, layerId: number = 0): Display2D {
        this.createLayer(layerId);
        this.addLayerGui(layerId);

        if (storage == Storage.Hash) {
            this.layers[layerId].itemStore.setItems(items);
        }
        else {
            this.layers[layerId].quadtree.clear();
            for (const item of items) {
                this.layers[layerId].quadtree.insert(new Rectangle(item.x, item.y, item.content?.length ?? 1, 1), { ...item });
            }
        }
        return this;
    }

    public addItems(items: Iterable<VectorWithContent>, layerId: number = 0): Display2D {
        this.createLayer(layerId);
        this.addLayerGui(layerId);

        if (storage == Storage.Hash) {
            this.layers[layerId].itemStore.addItems(items);
        }
        else {
            for (const item of items) {
                this.layers[layerId].quadtree.insert(new Rectangle(item.x, item.y, item.content?.length ?? 1, 1), { ...item });
            }
        }
        return this;
    }

    public setTitle(title: string): Display2D {
        return this;
    }

    public nextStep(text?: string): Display2D {
        this.log(text);
        return this;
    }

    public throttle(ratio?: number): Promise<void> {

        return Checkpoint.throttle(
            this.simulation.maxIterationsPerSecond == max_maxIterationsPerSecond
                ? -1
                : this.simulation.maxIterationsPerSecond
        );
    }

    public log(text: string): Display2D {

        Log.log(text);
        return this;

    }

    private charSize: Vector = { x: 0, y: 0 };

    private previous = performance.now();

    private animate() {

        const now = performance.now();
        const delta = (now - this.previous) / 1000; // delta in seconds

        // move viewport

        if (this.scrollIntoViewRunning) {

            this.scrollIntoViewRunning.currentDuration += delta;

            if (this.scrollIntoViewRunning.currentDuration >= this.scrollIntoViewRunning.totalDuration || false === this.scrollIntoViewRunning.smooth) {
                this.boundaries = { ...this.scrollIntoViewRunning.end };
                this.scrollIntoViewRunning = null;
            }
            else {
                let animationDelta = this.scrollIntoViewRunning.currentDuration / this.scrollIntoViewRunning.totalDuration;
                animationDelta = animationDelta * animationDelta * animationDelta * (animationDelta * (6.0 * animationDelta - 15.0) + 10.0); // smooth lerp, see https://chicounity3d.wordpress.com/2014/05/23/how-to-lerp-like-a-pro/
                console.assert(animationDelta >= 0 && animationDelta <= 1);
                this.boundaries = lerp(this.scrollIntoViewRunning.start, this.scrollIntoViewRunning.end, animationDelta);
            }
        }

        // prepare drawing context

        const ctx = this.canvas.getContext("2d");

        // update scale

        if (this.scaleChange) {

            const zoomCharPos = this.mouseCoordinatesToCharCoordinates(this.scaleChange.center);

            this.scaleLevel += this.scaleChange.increase;
            this.scaleLevel = Math.max(this.scaleLevel, .1);

            this.scale = Math.pow(this.scaleLevel, 2);
            ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

            // set boundary so zoom point doesn't move
            this.boundaries = {
                x: zoomCharPos.x - (this.scaleChange.center.x / this.scale / this.charSize.x),
                y: zoomCharPos.y - (this.scaleChange.center.y / this.scale / this.charSize.y)
            }

            this.scaleChange = null;
        }

        // draw

        this.draw(ctx);

        // console.log(`retrieved items`, countByLayer);

        // update log
        Log.update();

        // update stats

        this.stats1.update(undefined, undefined);

        // request next frame

        this.previous = performance.now();
        window.requestAnimationFrame(this.animate.bind(this));
    }

    private draw(ctx: CanvasRenderingContext2D) {

        // clear drawing context

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.canvas.width / this.scale, this.canvas.height / this.scale);
        // ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.font = "normal 15px courier new";
        ctx.textAlign = "left";

        // measures

        const metrics = ctx.measureText("#");
        this.charSize = {
            x: Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight),
            y: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
        };

        let countByLayer = {};

        const width = this.canvas.width / this.scale / this.charSize.x;
        const height = this.canvas.height / this.scale / this.charSize.y;
        const viewportRect = new Rectangle(this.boundaries.x, this.boundaries.y, width, height);

        for (const [index, layer] of Object.entries(this.layers)) {
            if (!layer)
                continue;

            const items = storage == Storage.Quadtree
                ? layer.quadtree.retrieve(viewportRect)
                : layer.itemStore.getVisibleItemsGenerator(this.boundaries.x, this.boundaries.y, width, height);

            for (const item of items) {

                let content: string;
                let rectangle: Rectangle;

                if (item instanceof DebugRectangle) {
                    ctx.strokeStyle = ["red", "blue", "grey", "green"][index];

                    const pos = this.charToCanvasCoordinates(item.bounds.x, item.bounds.y);
                    ctx.beginPath();
                    ctx.rect(pos.x, pos.y, item.bounds.width * this.charSize.x, item.bounds.height * this.charSize.y);
                    ctx.stroke();
                    continue;
                }
                else if (item instanceof Rectangle) {
                    rectangle = item;
                }
                else {
                    content = item.content;
                    const stringWidth = (content ?? layer.config?.defaultChar ?? "#").length;
                    rectangle = new Rectangle(item.x, item.y, stringWidth, 1);
                }

                countByLayer[index] = (countByLayer[index] ?? 0) + 1;
                const pos = this.charToCanvasCoordinates(item.x, item.y);

                ctx.globalAlpha = parseInt(index) == 0 ? 1 : 0.5;

                if (layer.config?.style?.bgColor) {
                    ctx.fillStyle = layer.config?.style?.bgColor
                        // ? `rgba(${layer.config.style.bgColor.r},${layer.config.style.bgColor.g},${layer.config.style.bgColor.b},127)`
                        ? `rgb(${layer.config.style.bgColor.r},${layer.config.style.bgColor.g},${layer.config.style.bgColor.b})`
                        : "rgb(255, 255, 255)";

                    ctx.fillRect(pos.x, pos.y, rectangle.width * this.charSize.x, rectangle.height * this.charSize.y);
                }

                if (content ?? layer.config?.defaultChar) {
                    ctx.fillStyle = layer.config?.style?.color
                        ? `rgb(${layer.config.style.color.r},${layer.config.style.color.g},${layer.config.style.color.b})`
                        : `rgb(0, 0, 0)`;

                    ctx.fillText(content ?? layer.config?.defaultChar ?? "#", pos.x, pos.y + this.charSize.y - metrics.fontBoundingBoxDescent);
                }
            }
        }
    }

    /**
     * moves display to the spot designed
     * @param bounds current bounds
     * @param target target point to make visible
     * @param percent1 external zone
     * @param percent2 internal zone
     * @returns new viewport position
     */
    private scrollIntoViewChange(bounds: Rectangle, target: Vector, percent1: number = .3, percent2: number = .4): Vector {

        const newBounds: Vector = {
            x: bounds.x,
            y: bounds.y
        };

        const min = {
            x: bounds.x + Math.round(bounds.width * percent1),
            y: bounds.y + Math.round(bounds.height * percent1)
        };
        const max = {
            x: bounds.x + Math.round(bounds.width * (1 - percent1)),
            y: bounds.y + Math.round(bounds.height * (1 - percent1))
        };

        if (target.x < min.x) {
            newBounds.x = target.x - Math.round(bounds.width * percent2);
        }
        else if (target.x > max.x) {
            newBounds.x = target.x - Math.round(bounds.width * (1 - percent2));
        }

        if (target.y < min.y) {
            newBounds.y = target.y - Math.round(bounds.height * percent2);
        }
        else if (target.y > max.y) {
            newBounds.y = target.y - Math.round(bounds.height * (1 - percent2));
        }

        return newBounds;
    }

    private charToCanvasCoordinates(x: number, y: number): Vector {
        return {
            x: (x - this.boundaries.x) * this.charSize.x,
            y: (y - this.boundaries.y) * this.charSize.y,
        }
    }

    private onWindowResize(event: Event): any {

        // resize canvas
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;

    }


    private onKeyDown(event: KeyboardEvent): any {

        switch (event.code) {

            case "Space":
                Pause.toggle();
                break;

            case "KeyL":
                Pause.step();
                break;
        }

    }

    private beginTouch: Array<Vector>;

    private onTouchStart(event: TouchEvent): any {

        // Log.log(`touchstart ${event.touches.length}`);
        this.beginTouch = [];
        this.beginTouch.push({
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        })
        if (event.touches.length == 2) {
            this.beginTouch.push({
                x: event.touches[1].clientX,
                y: event.touches[1].clientY
            })
        }
    }

    private onTouchEnd(event: TouchEvent): any {

        this.beginTouch = null;

    }

    private onTouchMove(event: TouchEvent): any {

        // Prevent the default behavior to avoid scrolling on touch devices
        // event.preventDefault();

        if (this.beginTouch && this.beginTouch.length == 1) {

            const pixelMove = {
                x: this.beginTouch[0].x - event.touches[0].clientX,
                y: this.beginTouch[0].y - event.touches[0].clientY

            }
            const charMove = {
                x: Math.trunc(pixelMove.x / this.charSize.x / this.scale),
                y: Math.trunc(pixelMove.y / this.charSize.y / this.scale),
            }

            if (this.beginTouch && charMove.x) {
                this.boundaries.x += charMove.x;
                this.beginTouch[0].x = event.touches[0].clientX;
            }
            if (this.beginTouch && charMove.y) {
                this.boundaries.y += charMove.y;
                this.beginTouch[0].y = event.touches[0].clientY;
            }
        }
        else if (this.beginTouch && this.beginTouch.length == 2) {

            // see https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures

            const initialDistance = distance(this.beginTouch[0], this.beginTouch[1]);
            const pos0 = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }
            const pos1 = {
                x: event.touches[1].clientX,
                y: event.touches[1].clientY
            }

            const newDistance = distance(pos0, pos1);
            const scaleIncrease = (newDistance - initialDistance) / Math.max(newDistance, initialDistance) / 10;
            Log.log(`distance from ${initialDistance.toFixed(2)} to ${newDistance.toFixed(2)}: ${scaleIncrease.toFixed(2)}`);

            if (Math.abs(scaleIncrease) > .05) {
    
                this.scaleChange = {
                    center: center(this.beginTouch[0], this.beginTouch[1]),
                    increase: scaleIncrease
                };
            }
        }
    }

    private onWheel(event: WheelEvent): any {

        event.preventDefault();

        if (event.deltaY < 0) {
            this.scaleChange = {
                center: {
                    x: event.clientX,
                    y: event.clientY
                },
                increase: .05
            };
        }
        else if (event.deltaY > 0) {
            this.scaleChange = {
                center: {
                    x: event.clientX,
                    y: event.clientY
                },
                increase: -.05
            };
        }

    }

    private mouseCoordinatesToCharCoordinates(pos: Vector): Vector {
        return {
            x: this.boundaries.x + (pos.x / this.scale / this.charSize.x),
            y: this.boundaries.y + (pos.y / this.scale / this.charSize.y)
        }
    }

    public displayCoordinates(vector: Vector) {
        return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}`;
    }
}
