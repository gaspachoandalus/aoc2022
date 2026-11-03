import * as dat from "lil-gui";
import { Vector, center, distance, lerp } from "./vector.js";
import { Quadtree, Rectangle } from "./QuadTree.js";
import { Display2D, Style, Colors } from "./Display2D.js";
import { Checkpoint } from "./Checkpoint.js";
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { Pause } from "./Pause.js";
import { Log } from "./Log.js";
import { getThrottleLimit, MAX_PREVIEW_ITERATIONS_PER_SECOND } from "./DisplayOptions.js";
import type { DisplayOptions } from "./DisplayOptions.js";
import { createDisplayControlsHelp } from "./DisplayControlsHelp.js";

export interface VectorWithContent extends Vector {
    content?: string;
}

type StoredItem = VectorWithContent & { sequence: number };

// Wheel changes carry a discrete target; pinch changes stay continuous.
type ScaleChange =
    | { kind: "wheel", center: Vector, targetStepIndex: number }
    | { kind: "continuous", center: Vector, increase: number };

const MIN_SCALE_LEVEL = 0.1;
const ZOOM_STEP = 0.05;
const MIN_WHEEL_ZOOM_STEP_INDEX = Math.ceil(MIN_SCALE_LEVEL / ZOOM_STEP);
// Preserve the renderer's quadratic relationship between zoom level and scale.
const SCALE_LEVEL_EXPONENT = 2;

// rgb of the quadtree outline of each layer, the index wraps around
const quadtreeColors = ["0, 255, 255", "255, 0, 255", "255, 160, 0", "128, 255, 0"];

type Layer = {
    quadtree: Quadtree<StoredItem>;
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
    stats1?: Stats.Panel;

    scale = 1;
    scaleLevel = 1;
    scaleChange: ScaleChange = null;
    boundaries: Vector = { x: 0, y: 0 };
    private wheelZoomStepIndex: number | null = null;
    private scrollIntoViewRunning: {
        start: Vector,
        end: Vector,
        totalDuration: number,
        currentDuration: number,
        smooth: boolean
    } = null;
    private layersGui?: dat.GUI;
    private readonly options: DisplayOptions;

    readonly simulation = {
        maxIterationsPerSecond: 200,
        display: null as DisplayWeb2D,
        get pause(): boolean {
            return Pause.paused();
        },
        set pause(value: boolean) {
            Pause.toggle();
        },
        stats: false,
        showQuadtree: false,
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

    // write order of the items, the newest one is drawn on top
    private itemSequence = 0;

    public static create() {

        return new DisplayWeb2D();
    }

    public constructor(options: DisplayOptions = {}) {

        this.options = options;
        if (options.preview) {
            this.scale = options.previewZoom ?? 1;
            this.scaleLevel = Math.pow(this.scale, 1 / SCALE_LEVEL_EXPONENT);
        }
        this.layers = [
            {
                quadtree: this.createQuadtree(),
                config: {},
                initialized: true,
                visible: true
            },
            {
                quadtree: this.createQuadtree(),
                config: {},
                initialized: true,
                visible: true
            },
            {
                quadtree: this.createQuadtree(),
                config: {},
                initialized: true,
                visible: true
            },
            {
                quadtree: this.createQuadtree(),
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

        const requestedRate = iterationsPerSecond ?? 100;
        this.simulation.maxIterationsPerSecond = this.options.preview
            ? this.options.previewIterationsPerSecond ?? requestedRate
            : requestedRate;

        if (this.canvas) {
            return this;
        }

        // canvas

        this.canvas = document.createElement("canvas");
        this.canvas.id = "canvas";
        this.canvas.dataset.aocRenderer = "true";
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;

        document.body.appendChild(this.canvas);
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("Unable to create a 2D canvas context");
        }
        this.updateCharSize(context);

        if (!this.options.preview) {
            document.body.appendChild(createDisplayControlsHelp("2d", [
                { label: "Mouse", description: "Drag to pan; scroll to zoom around the pointer." },
                { label: "Touch", description: "One finger to pan; pinch to zoom." },
                { label: "Space", description: "Pause or resume the simulation.", key: true },
                { label: "L", description: "Advance one step.", key: true }
            ]));
        }

        window.requestAnimationFrame(this.animate.bind(this));

        if (!this.options.preview) {
            // stats

            this.stats1 = new (Stats as any)();
            this.stats1.dom.id = "stats";
            this.stats1.dom.classList.add("hidden");
            const overlays = document.getElementById("simulation-overlays");
            if (!overlays) {
                throw new Error("Missing simulation overlays element.");
            }
            overlays.appendChild(this.stats1.dom);

            // dat.gui
            const gui = new dat.GUI();
            const simulationFolder = gui.addFolder('Simulation');
            this.simulation.display = this;
            simulationFolder.add(this.simulation, "pause").name("paused").listen().onChange(value => {
                value ? Pause.pause() : Pause.continue();
            });
            simulationFolder.add(this.simulation, 'maxIterationsPerSecond', 0, MAX_PREVIEW_ITERATIONS_PER_SECOND, 1).name("max iterations/s");
            simulationFolder.add(this.simulation, 'boundaries').name("top left corner").disable().listen();
            simulationFolder.add(this.simulation, 'size').name("size in chars").disable().listen().decimals(2);
            simulationFolder.add(this.simulation, 'scale').name("scale").disable().listen().decimals(2);
            simulationFolder.open()

            const debugFolder = gui.addFolder('Debug');
            debugFolder.add(this.simulation, "stats").name("show FPS").listen().onChange(value => {
                this.stats1.dom.classList.toggle("hidden", !value);
            });
            debugFolder.add(this.simulation, "showQuadtree").name("show quadtree").listen();

            this.layersGui = gui.addFolder("layers");
        }

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

        if (this.options.preview) {
            this.boundaries = newBoundaries;
            this.scrollIntoViewRunning = null;
            return this;
        }

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

    public fitBounds(bounds?: { min: Vector, max: Vector }): Display2D {
        const fittedBounds = bounds ?? this.getContentBounds();
        if (!fittedBounds) {
            throw new RangeError("No display content is available to fit; provide explicit bounds.");
        }

        const boundsWidth = fittedBounds.max.x - fittedBounds.min.x;
        const boundsHeight = fittedBounds.max.y - fittedBounds.min.y;
        if (
            ![
                fittedBounds.min.x,
                fittedBounds.min.y,
                fittedBounds.max.x,
                fittedBounds.max.y
            ].every(Number.isFinite)
            || boundsWidth <= 0
            || boundsHeight <= 0
        ) {
            throw new RangeError("Display bounds must be finite and have positive dimensions.");
        }
        if (!this.canvas) {
            throw new Error("Initialize the 2D display before fitting bounds.");
        }
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("Unable to create a 2D canvas context");
        }

        const fitScale = Math.min(
            this.canvas.width * 0.8 / (boundsWidth * this.charSize.x),
            this.canvas.height * 0.8 / (boundsHeight * this.charSize.y)
        );
        const maximumFitScale = Math.max(0.01, Math.min(this.scale, fitScale));
        // Snap down to a wheel stop so rounding never crops the requested bounds.
        this.wheelZoomStepIndex = Math.max(
            MIN_WHEEL_ZOOM_STEP_INDEX,
            Math.floor(
                Math.pow(maximumFitScale, 1 / SCALE_LEVEL_EXPONENT) / ZOOM_STEP + 1e-9
            )
        );
        this.scaleLevel = this.wheelZoomStepIndex * ZOOM_STEP;
        this.scale = Math.pow(this.scaleLevel, SCALE_LEVEL_EXPONENT);
        this.scaleChange = null;
        this.scrollIntoViewRunning = null;

        this.boundaries = {
            x: (fittedBounds.min.x + fittedBounds.max.x) / 2 - this.canvas.width / this.scale / this.charSize.x / 2,
            y: (fittedBounds.min.y + fittedBounds.max.y) / 2 - this.canvas.height / this.scale / this.charSize.y / 2
        };

        context.setTransform(this.scale, 0, 0, this.scale, 0, 0);

        return this;
    }

    private getContentBounds(): { min: Vector, max: Vector } | null {
        let bounds: { min: Vector, max: Vector } | null = null;
        for (const layer of this.layers) {
            const layerBounds = layer?.quadtree.getBounds();
            if (!layerBounds) {
                continue;
            }
            if (!bounds) {
                bounds = {
                    min: { ...layerBounds.min },
                    max: { ...layerBounds.max }
                };
                continue;
            }
            bounds.min.x = Math.min(bounds.min.x, layerBounds.min.x);
            bounds.min.y = Math.min(bounds.min.y, layerBounds.min.y);
            bounds.max.x = Math.max(bounds.max.x, layerBounds.max.x);
            bounds.max.y = Math.max(bounds.max.y, layerBounds.max.y);
        }
        return bounds;
    }

    private createQuadtree() {
        return Quadtree.create<StoredItem>();
    }

    private createLayer(layer: number) {
        if (!this.layers[layer]) {
            this.layers[layer] = {
                initialized: true,
                config: null,
                lastRender: null,
                visible: true,
                name: layer.toString(),
                quadtree: this.createQuadtree(),
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
        if (this.options.preview) {
            return;
        }

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

        this.layers[layerId].quadtree.clear();
        for (const item of items) {
            this.layers[layerId].quadtree.insert(new Rectangle(item.x, item.y, item.content?.length ?? 1, 1), { ...item, sequence: ++this.itemSequence });
        }
        return this;
    }

    public addItems(items: Iterable<VectorWithContent>, layerId: number = 0): Display2D {
        this.createLayer(layerId);
        this.addLayerGui(layerId);

        for (const item of items) {
            this.layers[layerId].quadtree.insert(new Rectangle(item.x, item.y, item.content?.length ?? 1, 1), { ...item, sequence: ++this.itemSequence });
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

    public checkpoint(): Promise<void> {

        return Checkpoint.checkpoint(getThrottleLimit(this.simulation.maxIterationsPerSecond));
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

        this.updateViewport(delta);

        const ctx = this.canvas.getContext("2d");
        this.applyScaleChange(ctx);
        this.draw(ctx);
        this.updateOverlays();

        this.previous = performance.now();
        window.requestAnimationFrame(this.animate.bind(this));
    }

    /** Advances the eased viewport movement requested by scrollIntoView. */
    private updateViewport(delta: number): void {
        const movement = this.scrollIntoViewRunning;
        if (!movement) {
            return;
        }

        movement.currentDuration += delta;
        if (movement.currentDuration >= movement.totalDuration || !movement.smooth) {
            this.boundaries = { ...movement.end };
            this.scrollIntoViewRunning = null;
            return;
        }

        let animationDelta = movement.currentDuration / movement.totalDuration;
        animationDelta = animationDelta * animationDelta * animationDelta
            * (animationDelta * (6.0 * animationDelta - 15.0) + 10.0);
        console.assert(animationDelta >= 0 && animationDelta <= 1);
        this.boundaries = lerp(movement.start, movement.end, animationDelta);
    }

    /** Applies pending zoom while keeping the pointer anchored to the same world point. */
    private applyScaleChange(ctx: CanvasRenderingContext2D): void {
        const change = this.scaleChange;
        if (!change) {
            return;
        }

        const zoomCharPos = this.mouseCoordinatesToCharCoordinates(change.center);
        if (change.kind === "wheel") {
            this.scaleLevel = change.targetStepIndex * ZOOM_STEP;
            this.scale = Math.pow(this.scaleLevel, SCALE_LEVEL_EXPONENT);
        } else {
            this.scaleLevel = Math.max(this.scaleLevel + change.increase, MIN_SCALE_LEVEL);
            this.scale = Math.pow(this.scaleLevel, SCALE_LEVEL_EXPONENT);
            this.resetWheelZoomStepIndex();
        }
        ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

        this.boundaries = {
            x: zoomCharPos.x - (change.center.x / this.scale / this.charSize.x),
            y: zoomCharPos.y - (change.center.y / this.scale / this.charSize.y)
        };
        this.scaleChange = null;
    }

    /** Defers wheel-step alignment until after a continuous pinch changes the scale. */
    private resetWheelZoomStepIndex(): void {
        this.wheelZoomStepIndex = null;
    }

    /** Refreshes the simulation trace and optional FPS overlay after each rendered frame. */
    private updateOverlays(): void {
        Log.update();

        if (this.simulation.stats) {
            this.stats1?.update(undefined, undefined);
        }
    }

    private draw(ctx: CanvasRenderingContext2D) {

        if (this.options.preview) {
            ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
            ctx.globalAlpha = 1;
        }

        // clear drawing context

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.canvas.width / this.scale, this.canvas.height / this.scale);
        // ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.textAlign = "left";

        // measures

        const metrics = this.updateCharSize(ctx);

        const width = this.canvas.width / this.scale / this.charSize.x;
        const height = this.canvas.height / this.scale / this.charSize.y;
        const viewportRect = new Rectangle(this.boundaries.x, this.boundaries.y, width, height);

        for (const [index, layer] of Object.entries(this.layers)) {
            if (!layer)
                continue;

            this.drawLayer(ctx, parseInt(index), layer, viewportRect, metrics);
        }

        if (this.simulation.showQuadtree) {
            this.drawQuadtreeNodes(ctx, viewportRect);
        }
    }

    /** Draws one layer in write order so later items cover earlier cells and backgrounds. */
    private drawLayer(
        ctx: CanvasRenderingContext2D,
        layerIndex: number,
        layer: Layer,
        viewportRect: Rectangle,
        metrics: TextMetrics,
    ): void {
        const items = Array.from(layer.quadtree.retrieveObjects(viewportRect))
            .sort((a, b) => a.sequence - b.sequence);
        ctx.globalAlpha = layerIndex === 0 ? 1 : 0.5;

        const bgColor = layer.config?.style?.bgColor;
        const cells = new Map<string, { x: number, y: number, char: string | null }>();
        for (const item of items) {
            const text = item.content ?? layer.config?.defaultChar;
            const length = (text ?? "#").length;

            if (bgColor) {
                const pos = this.charToCanvasCoordinates(item.x, item.y);
                ctx.fillStyle = `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`;
                ctx.fillRect(pos.x, pos.y, length * this.charSize.x, this.charSize.y);
            }

            if (!text && !bgColor) {
                continue;
            }

            for (let dx = 0; dx < length; dx++) {
                cells.set(`${item.x + dx},${item.y}`, {
                    x: item.x + dx,
                    y: item.y,
                    char: text ? text[dx] : null
                });
            }
        }

        ctx.fillStyle = layer.config?.style?.color
            ? `rgb(${layer.config.style.color.r},${layer.config.style.color.g},${layer.config.style.color.b})`
            : `rgb(0, 0, 0)`;

        for (const cell of cells.values()) {
            if (cell.char === null) {
                continue;
            }

            const pos = this.charToCanvasCoordinates(cell.x, cell.y);
            ctx.fillText(cell.char, pos.x, pos.y + this.charSize.y - metrics.fontBoundingBoxDescent);
        }
    }

    /**
     * outlines the nodes of every layer quadtree, one color per layer, filled nodes are more opaque
     * @param ctx drawing context, already scaled
     * @param viewportRect visible area in chars
     */
    private drawQuadtreeNodes(ctx: CanvasRenderingContext2D, viewportRect: Rectangle) {

        ctx.globalAlpha = 1;
        ctx.lineWidth = 1 / this.scale;

        for (const [index, layer] of this.layers.entries()) {
            if (!layer)
                continue;

            const rgb = quadtreeColors[index % quadtreeColors.length];
            for (const node of layer.quadtree.overlappingNodes(viewportRect)) {
                const pos = this.charToCanvasCoordinates(node.bounds.x, node.bounds.y);
                ctx.strokeStyle = `rgba(${rgb}, ${node.filled ? 0.9 : 0.35})`;
                ctx.strokeRect(pos.x, pos.y, node.bounds.width * this.charSize.x, node.bounds.height * this.charSize.y);
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

    private updateCharSize(ctx: CanvasRenderingContext2D): TextMetrics {
        ctx.font = "normal 15px courier new";
        const metrics = ctx.measureText("#");
        this.charSize = {
            x: Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight),
            y: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
        };
        return metrics;
    }

    private onWindowResize(event: Event): any {

        // resize canvas
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;

        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("Unable to create a 2D canvas context");
        }
        context.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    }


    private onKeyDown(event: KeyboardEvent): any {
        if (event.target instanceof Element
            && event.target.closest("button, input, select, textarea, summary, [contenteditable='true']")) {
            return;
        }

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
        if (!this.beginTouch || event.touches.length < this.beginTouch.length) {
            return;
        }

        if (this.beginTouch && this.beginTouch.length == 1) {

            const pixelMove = {
                x: this.beginTouch[0].x - event.touches[0].clientX,
                y: this.beginTouch[0].y - event.touches[0].clientY

            }
            const charMove = {
                x: pixelMove.x / this.charSize.x / this.scale,
                y: pixelMove.y / this.charSize.y / this.scale,
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
                this.resetWheelZoomStepIndex();
                this.scaleChange = {
                    center: center(this.beginTouch[0], this.beginTouch[1]),
                    kind: "continuous",
                    increase: scaleIncrease
                };
            }
        }
    }

    private onWheel(event: WheelEvent): any {

        event.preventDefault();

        const direction = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0;
        if (direction === 0) {
            return;
        }

        if (this.scaleChange?.kind === "continuous") {
            this.resetWheelZoomStepIndex();
        }
        if (this.wheelZoomStepIndex === null) {
            const currentStepIndex = this.scaleLevel / ZOOM_STEP;
            this.wheelZoomStepIndex = direction > 0
                ? Math.floor(currentStepIndex + 1e-9)
                : Math.ceil(currentStepIndex - 1e-9);
        }
        this.wheelZoomStepIndex = Math.max(
            MIN_WHEEL_ZOOM_STEP_INDEX,
            this.wheelZoomStepIndex + direction
        );
        this.scaleChange = {
            center: {
                x: event.clientX,
                y: event.clientY
            },
            kind: "wheel",
            targetStepIndex: this.wheelZoomStepIndex
        };
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
