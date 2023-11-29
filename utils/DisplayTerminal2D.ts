import termkit from "terminal-kit";
import { Checkpoint } from "./Checkpoint.js";
import { Pause } from "./Pause.js";
import { Vector } from "./vector.js";
import { ItemHashStore } from "./ItemHashStore.js";
import { Display2D, VectorWithContent, Style, Colors } from "./Display2D.js";

const min_iterations_per_second = 1;
const default_start_iterations_per_second = 10;
const iterations_per_second_step = 10;
const max_iterations_per_second = 5000;
const screenbuffers_to_create = 4;
const target_fps = 30;
const target_max_frame_duration_ms = 1_000/target_fps;
const follow_delay_after_user_move_ms = 3_000;

export interface Color {
    r: number;
    g: number;
    b: number;
    a?: Number;
}

/**
 * Terminal based display of a 2D matrix
 * 
 * After init() the following keys are available:
 *  - Space: pauses simulation at the next throttle(). Press space again to un-pause.
 *  - "L": increases simulation speed. forward step by step if simulation is paused.
 *  - "M": max simulation speed
 *  - "J": decreases simulation speed
 *  - arrows: moves the zone of the map displayed
 */ 
export class Terminal implements Display2D {

    private boundaries: { min: Vector, max: Vector };
    private width = 0;
    private height = 0;

    layers: Array<{
        itemStore: ItemHashStore;
        initialized: boolean; // layer initialized once ?
        config: {defaultChar?: string, style?: Style };
        visible: boolean;
        lastRender: number;
        name?: string;
    }> = Array(4);

    private scrollIntoViewPos: Vector = null;
    private scrollIntoViewSmooth: boolean = true;

    private iterationsPerSecond;
    private title: string;
    private simulationStart: number;
    private latestFramesIntervals: Array<number> = [];
    private lastFrameStart = 0;
    private lastFramePos: Vector = null;
    private lastKeyPressed = 0;

    private mouse: Vector = {x: 0, y: 0};

    private term: termkit.Terminal;
    private screenbuffers: termkit.ScreenBufferHD[] = [];
    private screenbufferTerm: termkit.ScreenBufferHD;
    private screenbufferTop: termkit.ScreenBufferHD;

    public static create() {

        return new Terminal();

    }

    public init(iterationsPerSecond?: number): Display2D {

        if (this.term) {
            return;
        }

        this.iterationsPerSecond = iterationsPerSecond ?? default_start_iterations_per_second;
        this.boundaries = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
        this.simulationStart = performance.now();

        for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
            this.layers[layerIdx] = {
                itemStore: new ItemHashStore(),
                initialized: false,
                config: null,
                visible: true,
                lastRender: 0
            };
        }
        this.layers[0].config = { defaultChar: "#", style: { color: Colors.white, bgColor: null}};
        this.layers[1].config = { defaultChar: " ", style: { color: Colors.red, bgColor: null} };
        this.layers[2].config = { defaultChar: " ", style: { color: null, bgColor: Colors.blue} };
        this.layers[3].config = { defaultChar: " ", style: { color: null, bgColor: Colors.green} };

        this.TermkitInit();

        setImmediate(() => this.renderScreen());

        return this;
    }

    /**
     * request the engine to move to a specific point in 2D space
     * @param pos 
     * @param smooth 
     * @returns 
     */
    public scrollIntoView(pos: Vector, smooth: boolean = true): Display2D {
        this.scrollIntoViewPos = {...pos};
        this.scrollIntoViewSmooth = smooth;
        return this;
    }

    public end(result: Object): Display2D {
        this.title = JSON.stringify(result);
        return this;
    }

    public setBoundaries(boundaries: { min: Vector, max: Vector }): Display2D {
        this.boundaries = boundaries;
        if (this.boundaries.max.x - this.boundaries.min.x > this.screenbuffers[0].width) {
            this.boundaries.max.x = this.screenbuffers[0].width + this.boundaries.min.x;
        }
        // if (this.boundaries.max.y - this.boundaries.min.y > DisplayImpl.screen.height) {
        //     this.boundaries.max.y = DisplayImpl.screen.width + this.boundaries.min.y;
        // }
        return this;
    }

    public setLayer(layer: number, name: string, config: {defaultChar?: string, style: Style }): Display2D {

        // add layer if needed
        this.layers[layer] = this.layers[layer] ?? {
            itemStore: new ItemHashStore(),
            initialized: false,
            config: null,
            visible: true,
            lastRender: 0
        };

        // add screenbuffer if needed
        this.screenbuffers[layer] = this.screenbuffers[layer] ?? new termkit.ScreenBufferHD({ dst: this.screenbufferTerm, width: this.width, height: this.height - 1, noFill: true });

        this.layers[layer].config = {defaultChar: config.defaultChar, style: {...config.style}};

        this.layers[layer].name = name;

        return this;
    }
    
    public setItems(items: Iterable<VectorWithContent>, layer: number = 0): Display2D {

        this.layers[layer].itemStore.setItems(items);
        return this;
    }

    public addItems(items: Iterable<VectorWithContent>, layer: number = 0): Display2D {

        this.layers[layer].itemStore.addItems(items);
        return this;
    }

    public setTitle(title: string): Display2D {
        this.title = title;
        return this;
    }

    public log(text: string): Display2D {
        // TODO
        return this;
    }
    
    private TermkitInit() {

        termkit.getDetectedTerminal( function( error , term ) {
            term.cyan( 'Terminal name: %s\n' , term.appName ) ;
            term.cyan( 'Terminal app: %s\n' , term.app ) ;
            term.cyan( 'Terminal generic: %s\n' , term.generic ) ;
            term.cyan( 'Config file: %s\n' , term.termconfigFile ) ;
        } ) ;

        this.term = termkit.terminal;
        this.width = this.term.width ?? 200;
        this.height = this.term.height ?? 100;

        this.screenbufferTerm = new termkit.ScreenBufferHD({ dst: this.term, x: 0, y: 0, width: this.width, height: this.height });
        this.screenbufferTop = new termkit.ScreenBufferHD({ dst: this.screenbufferTerm, width: this.width, height: 1, noFill: true });
        for (let i = 0; i < screenbuffers_to_create; i++) {
            this.screenbuffers.push(new termkit.ScreenBufferHD({ dst: this.screenbufferTerm, width: this.width, height: this.height - 1, noFill: true }));
        }
        this.term.fullscreen({
            noAlternate: false
        });

        this.term.saveCursor();
        this.term.hideCursor();
        this.term.grabInput({
            mouse: "motion"
        });

        this.term.on('key', (name: string, matches, data) => {
            if (name === 'CTRL_C' || name == "ESC" || name == "q") {
                this.term.grabInput(false);
                this.term.hideCursor(false);
                process.exit();
            }
            else if (name == "1" || name == "2" || name == "3" || name == "4" || name == "5" || name == "6" || name == "7"|| name == "8"|| name == "9") {
                const layerIdx = parseInt(name) - 1;
                this.layers[layerIdx].visible = !this.layers[layerIdx].visible;
            }
            else if (name == "END") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.x += this.width;
            }
            else if (name == "HOME") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.x -= this.width;
            }
            else if (name == "RIGHT") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.x += 10;
            }
            else if (name == "LEFT") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.x -= 10;
            }
            else if (name == "PAGE_UP") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.y -= this.height;
            }
            else if (name == "PAGE_DOWN") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.y += this.height;
            }
            else if (name == "UP") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.y -= 5;
            }
            else if (name == "DOWN") {
                this.lastKeyPressed = Date.now();
                this.boundaries.min.y += 5;
            }
            else if (name == " ") {

                Pause.toggle();

            }
            else if (name.toUpperCase() == "M") {
                this.iterationsPerSecond = max_iterations_per_second;
            }
            else if (name.toUpperCase() == "J") {
                this.iterationsPerSecond = Math.max(this.iterationsPerSecond - (name == "j" ? iterations_per_second_step : 100), min_iterations_per_second);
            }
            else if (name.toUpperCase() == "L") {

                if (Pause.paused()) {
                    Pause.step();
                }
                else {

                    this.iterationsPerSecond = Math.min(this.iterationsPerSecond + (name == "l" ? iterations_per_second_step : 100), max_iterations_per_second);
                }
            }
        });

        this.term.on("resize", (width: number, height: number) => {
            this.width = width;
            this.height = height;
    
            this.screenbufferTerm.resize({x: 0, y: 0, width, height});
            this.screenbufferTop.resize({x: 0, y: 0, width, height: 1});
            for (let i = 0; i < this.screenbuffers.length; i++) {
                this.screenbuffers[i].resize({x: 0, y: 1, width, height: height - 1});
            }
        });

        this.term.on('terminal', (name, data) => {
            // console.log("'terminal' event:", name, data);
        });

        this.term.on('mouse', (name, data) => {
            // console.log("'mouse' event:", name, data);
            if (name == "MOUSE_MOTION") {
                this.mouse = {x: data.x, y: data.y};
            }
            else if (name == "MOUSE_DRAG") {
                this.boundaries.min.x += data.x - data.xFrom;
                this.boundaries.min.y += data.y - data.yFrom;
                this.lastKeyPressed = Date.now();
            }
        });
    }

    public nextStep(text: string): Display2D {
        return this;
    }

    async throttle(ratio: number = 1): Promise<void> {

        const maxPerSeconds =
            this.iterationsPerSecond == max_iterations_per_second
                ? -1
                : this.iterationsPerSecond; 
        await Checkpoint.throttle(maxPerSeconds, ratio);
        
    }

    private IsInBoundary(pos: VectorWithContent) {
        return (
            pos.x >= this.boundaries.min.x - (pos.content?.length ?? 0) &&
            pos.x <= this.boundaries.min.x + this.width &&
            pos.y >= this.boundaries.min.y &&
            pos.y <= this.boundaries.min.y + this.height
        );
    }

    private renderLayer(layerIdx: number, moved: boolean): boolean {

        const layer = this.layers[layerIdx];

        const mustClearScreenBuffer = 
            moved ||
            !layer.initialized ||
            layer.lastRender < layer.itemStore.getLastSetTime();

        if (mustClearScreenBuffer) {
        
            layer.initialized = true;

            // clear screen buffer
            this.screenbuffers[layerIdx].fill({
                attr: {
                    color: {
                        r: 0x0,
                        g: 0x0,
                        b: 0x0,
                        // a: 0x0
                    } as any,
                    bgColor: {
                        r: 0x0,
                        g: 0x0,
                        b: 0x0,
                        // a: 0x0
                    } as any,
                    charTransparency: true,
                    fgTransparency: true,
                    styleTransparency: true,
                    bgTransparency: true
                },
                char: " "
            });
        }

        if (!layer.visible) {
            return;
        }

        let items: VectorWithContent[];
        if (mustClearScreenBuffer) {

            // get items to display
            items = layer.itemStore.getVisibleItems(this.boundaries.min.x, this.boundaries.min.y, this.width, this.height, v => this.IsInBoundary(v));    
    
        }
        else {

            // get items to display
            items = layer.itemStore.getNewItems(this.boundaries.min.x, this.boundaries.min.y, this.width, this.height, v => this.IsInBoundary(v));

        }

        // display items on the screen buffer
        for (const item of items) {
            this.renderItem(item, item.content ?? layer.config.defaultChar ?? " ", layerIdx, layer.config.style);
        }

        layer.lastRender = performance.now();

        // draw layer on main screen buffer
        this.screenbuffers[layerIdx].draw({
            blending: {
                // fn: (termkit.ScreenBufferHD as any).blendFn.overlay,
                // fn: (termkit.ScreenBufferHD as any).blendFn.multiply,
                fn: (termkit.ScreenBufferHD as any).blendFn.screen,
                // opacity: 1,
                charTransparency: true,
                styleTransparency: true,
                fgTransparency: true,
                bgTransparency: true
            } as any,
            delta: true,
            x: 0,
            y: 1
        });
    }

    private renderScreen() {

        const frameStart = performance.now();

        // center display and disable following if on the good spot
        if (this.scrollIntoViewPos && (Date.now() - this.lastKeyPressed) > follow_delay_after_user_move_ms) {
            if (!this.scrollIntoViewStep()) {
                this.scrollIntoViewPos = null;
            }
        }

        // if position has moved since la redraw, we must redraw all screen
        const moved = (this.lastFramePos == null) || (this.lastFramePos.x != this.boundaries.min.x || this.lastFramePos.y != this.boundaries.min.y);

        this.screenbufferTerm.fill();
        for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
            this.renderLayer(layerIdx, moved);
        }

        // Top bar
        this.screenbufferTop.fill({
            attr: {
                bgColor: "005000",
                color: "FFFFFF",
            }
        });

        this.screenbufferTop.put({
            x: 0,
            y: 0,
            attr: {
                bgColor: "005000",
                color: "FFFFFF",
            }
        } as any,
            "%ss %s/s %s/s %s %s %s mem:%sMB fps:%s %s",
            ((frameStart - this.simulationStart) / 1000).toFixed(1).padStart(7),
            `speed:${Math.round(this.iterationsPerSecond).toString().padStart(3)}`,
            `(${Math.round(Checkpoint.countPerSecond).toString().padStart(3)})`,
            `bounds:(${this.boundaries.min.x},${this.boundaries.min.y}),(${this.screenbuffers[0].width},${this.screenbuffers[0].height})`.padStart(25),
            "layers:[" + this.layers.map((v, i) => v.visible ? (i+1) : " ").join("") + "]",
            `mouse:(${this.mouse.x - 1 + this.boundaries.min.x},${this.mouse.y - 1 + this.boundaries.min.y - 1})`.padStart(15),
            (process.memoryUsage().heapTotal / 1_000_000).toFixed(2).padStart(6),
            this.latestFramesIntervals.length > 0 ?
                Math.round(1000 / Math.round(this.latestFramesIntervals.reduce((p,c) => p+c, 0) / this.latestFramesIntervals.length)).toString().padStart(3) :
                "  0",
            this.title ?? "");

        this.screenbufferTop.draw({
            blending: true,
            x: 0,
            y: 1
        });

        // Draw to screen
        this.screenbufferTerm.draw({
            delta: true,
            blending: false,
            x: 1,
            y: 0
        });

        // save interval with previous frame
        if (this.lastFrameStart > 0) {
            this.latestFramesIntervals.push(frameStart - this.lastFrameStart);
            this.latestFramesIntervals.splice(0, this.latestFramesIntervals.length - 10); // keep 10 elements max
        }
        this.lastFrameStart = frameStart;
        this.lastFramePos = {...this.boundaries.min};

        // request next frame
        setTimeout(() => this.renderScreen(), Math.max(target_max_frame_duration_ms - (performance.now() - frameStart), 0));

        return true;
    }

    /**
     * moves display to the spot designed in {@link scrollIntoView}.
     * @returns `true` if a move has been done, false if no move is needed
     */
    private scrollIntoViewStep(): boolean {
        let moved = false;

        const percent = 0.1;

        const min = {
            x: this.boundaries.min.x + Math.round(this.screenbuffers[0].width * percent),
            y: this.boundaries.min.y + Math.round(this.screenbuffers[0].height * percent)
        };
        const max = {
            x: this.boundaries.min.x + Math.round(this.screenbuffers[0].width * (1 - percent)),
            y: this.boundaries.min.y + Math.round(this.screenbuffers[0].height * (1 - percent))
        };

        const smoothSpeed = 3;

        if (this.scrollIntoViewPos.x < min.x) {
            if (this.scrollIntoViewSmooth) {
                this.boundaries.min.x -= smoothSpeed;
            }
            else {
                this.boundaries.min.x = this.scrollIntoViewPos.x - Math.round(this.screenbuffers[0].width * 0.3);
            }
            moved = true;
        }
        else if (this.scrollIntoViewPos.x > max.x) {
            if (this.scrollIntoViewSmooth) {
                this.boundaries.min.x += smoothSpeed;
            }
            else {
                this.boundaries.min.x = this.scrollIntoViewPos.x - Math.round(this.screenbuffers[0].width * 0.7);
            }
            moved = true;
        }

        if (this.scrollIntoViewPos.y < min.y) {
            if (this.scrollIntoViewSmooth) {
                this.boundaries.min.y -= smoothSpeed;
            }
            else {
                this.boundaries.min.y = this.scrollIntoViewPos.y - Math.round(this.screenbuffers[0].height * 0.3);
            }
            moved = true;
        }
        else if (this.scrollIntoViewPos.y > max.y) {
            if (this.scrollIntoViewSmooth) {
                this.boundaries.min.y += smoothSpeed;
            }
            else {
                this.boundaries.min.y = this.scrollIntoViewPos.y - Math.round(this.screenbuffers[0].height * 0.7);
            }
        }

        return moved;
    }

    private renderItem(pos: Vector, content: string, layer: number, style: Style) {

        const screenbufferOffset = {
            x: pos.x - this.boundaries.min.x,
            y: pos.y - this.boundaries.min.y + 1,
        };

        // is content starts before beginning of screenbuffer
        if (screenbufferOffset.x < 0) {
            content = content.slice(-screenbufferOffset.x)
            screenbufferOffset.x = 0;
        }

        const attr = {
            color: style.color ? {...style.color} : {...Colors.white},
            bgColor: style.bgColor ? {...style.bgColor} : {...Colors.black},
            bold: style.bold,
            strike: style.strike,
            // fgTransparency: layer > 0,
            styleTransparency: layer > 0,
            charTransparency: layer > 0,
            // bgTransparency: layer > 0
        }

        this.screenbuffers[layer].put({
            ...screenbufferOffset,
            markup: false,
            attr,
            wrap: false,
            dx: undefined,
            dy: undefined,
        } as any, "%s", content /* cell?.char == " " ? content : cell?.char */);
    }
}
