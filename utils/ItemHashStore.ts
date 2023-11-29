import { Vector, vectorAsString } from "./vector.js";
import { VectorWithContent } from "./Display2D.js";

/**
 * Stores items with their 2D position to easily retrieve items in a specific rectangle
 */
export class ItemHashStore {

    private itemsBuffer: Array<VectorWithContent>; // temporary buffer for recently added items
    private blocksHashMap: Map<string, Map<string, VectorWithContent>>; // all items
    private lastAddTime: number;
    private lastSetTime: number;
    private readonly blocWidth = 40;
    private readonly blocHeight = 20;

    public constructor() {
        this.blocksHashMap = new Map<string, Map<string, VectorWithContent>>();
        this.itemsBuffer = [];
    }

    public getLastAddTime() {
        return this.lastAddTime;
    }

    public getLastSetTime() {
        return this.lastSetTime;
    }

    /**
     * returns new items since last call to getNewItems or getVisibleItems
     * @param predicate item filter
     * @returns array of items
     */
    public getNewItems(x: number, y: number, width: number, height: number, predicate: (value: Vector) => boolean): Array<VectorWithContent> {

        const items = [];
        for (const item of this.itemsBuffer) {
            items.push({...item});
        }
        this.flushItemsBuffer();
        return items.filter(predicate);

    }

    /**
     * returns all items in the specified rectangle
     * @param x rectangle x
     * @param y rectangle y
     * @param width rectangle width
     * @param height rectangle height
     * @param predicate item filter
     * @returns array of items
     */
    public getVisibleItems(x: number, y: number, width: number, height: number, predicate: (value: Vector) => boolean): Array<VectorWithContent> {

        const items: Array<Vector> = [];

        this.flushItemsBuffer();

        // get items from each visible or partially visible bloc
        for (let bloc_iy = 0; bloc_iy <= Math.ceil(height / this.blocHeight); bloc_iy++) {
            for (let bloc_ix = 0; bloc_ix <= Math.ceil(width / this.blocWidth); bloc_ix++) {
                const blocHash = this.getBlockHashKey(x + bloc_ix * this.blocWidth, y + bloc_iy * this.blocHeight);
                let itemsMap = this.blocksHashMap?.get(blocHash);
                if (itemsMap) {
                    items.push(...[...itemsMap.values()].filter(predicate));
                }
            }
        }

        return items;
    }

    /**
     * returns all items in the specified rectangle
     * @param x rectangle x
     * @param y rectangle y
     * @param width rectangle width
     * @param height rectangle height
     */
    public *getVisibleItemsGenerator(x: number, y: number, width: number, height: number): Generator<VectorWithContent, void, undefined> {

        this.flushItemsBuffer();

        // get items from each visible or partially visible bloc
        for (let bloc_iy = 0; bloc_iy <= Math.ceil(height / this.blocHeight); bloc_iy++) {
            for (let bloc_ix = 0; bloc_ix <= Math.ceil(width / this.blocWidth); bloc_ix++) {
                const blocHash = this.getBlockHashKey(x + bloc_ix * this.blocWidth, y + bloc_iy * this.blocHeight);
                let itemsMap = this.blocksHashMap?.get(blocHash);
                if (itemsMap) {
                    yield* itemsMap.values();
                }
            }
        }
    }

    /**
     * replace all items in this set
     */
    public setItems(items: Iterable<VectorWithContent>) {

        this.itemsBuffer = [];
        this.blocksHashMap.clear();

        for (const item of items) {
            this.addItem(item);
        }

        this.lastSetTime = performance.now();

    }

    /**
     * add items to the set
     */
    public addItems(items: Iterable<VectorWithContent>) {

        for (const item of items) {
            this.itemsBuffer.push({...item});
        }
        this.lastAddTime = performance.now();

    }

    private getBlockHashKey(x: number, y: number) {
        const vhash: Vector = {
            x: Math.floor(x / this.blocWidth),
            y: Math.floor(y / this.blocHeight)
        };
        return vectorAsString(vhash);
    }

    private flushItemsBuffer() {

        for (const item of this.itemsBuffer) {
            this.addItem(item);
        }
        this.itemsBuffer = [];

    }

    private addItem(item: VectorWithContent) {

        const hash = this.getBlockHashKey(item.x, item.y);
        let itemsMap = this.blocksHashMap.get(hash);
        if (!itemsMap) {
            itemsMap = new Map<string, Vector>();
            this.blocksHashMap.set(hash, itemsMap);
        }
        itemsMap.set(vectorAsString(item), { ...item });

    }
}
