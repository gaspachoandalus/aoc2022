import { Vector } from './vector.js';

enum Index {
    northeast = 0,
    northwest = 1,
    southwest = 2,
    southeast = 3,
}

export class Point {
    constructor(public x: number, public y: number) { }
}

export class Rectangle {
    constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number
    ) { }

    // Check if a point is within the rectangle
    contains(Rectangle: Rectangle): boolean;
    contains(point: Point): boolean;
    contains(item: Point | Rectangle): boolean {
        if (item instanceof Point) {
            const point = item;
            return (
                point.x >= this.x &&
                point.x < this.x + this.width &&
                point.y >= this.y &&
                point.y < this.y + this.height
            );
        }
        else if (item instanceof Rectangle) {
            const rectangle = item;
            return (
                rectangle.x >= this.x &&
                rectangle.x + rectangle.width <= this.x + this.width &&
                rectangle.y >= this.y &&
                rectangle.y + rectangle.height <= this.y + this.height
            );
        }
    }

    overlaps(rectangle: Rectangle): boolean {

        const l1 = new Point(this.x, this.y);
        const r1 = new Point(this.x + this.width, this.y + this.height);

        const l2 = new Point(rectangle.x, rectangle.y);
        const r2 = new Point(rectangle.x + rectangle.width, rectangle.y + rectangle.height);

        // if rectangle has area 0, no overlap
        if (l1.x == r1.x || l1.y == r1.y || r2.x == l2.x || l2.y == r2.y)
            return false;

        // If one rectangle is on left side of other
        if (l1.x > r2.x || l2.x > r1.x)
            return false;

        // If one rectangle is above other
        if (r1.y < l2.y || r2.y < l1.y)
            return false;

        return true;
    }

    toString() {
        return `${this.x},${this.y},${this.width},${this.height}`;
    }
}

/**
 * a node of the Quadtree, as yielded by overlappingNodes()
 */
export interface QuadtreeNode {
    bounds: Rectangle;
    /** every cell of the node is covered by objects */
    filled: boolean;
}

/**
 * QuadTree class
 *
 * example
 * 
 * const quadtree = Quadtree.create<Point>(new Rectangle(0, 0, 800, 600));
 * quadtree.insert(new Rectangle(10, 10, 20, 20), new Point(10, 10));
 * quadtree.insert(new Rectangle(50, 50, 20, 20), new Point(50, 50));
 * const objectsInArea = quadtree.retrieve(new Rectangle(0, 0, 30, 30));
 * console.log(objectsInArea);
 */
export class Quadtree<T extends object> {
    private static MAX_OBJECTS = 10;
    private static MAX_LEAF_SIZE = 8;
    // side of the root created around the first inserted rectangle, it grows when needed
    private static ROOT_SIZE = 64;

    /** objects of this node */
    private objects: Array<{
        rectangle: Rectangle,
        object: T
    }> = [];
    private nodes: Quadtree<T>[] = [];
    // null until the first insert when the tree is created without bounds
    private bounds: Rectangle | null = null;
    private filled: boolean = false;

    /**
     * Create QuadTree
     * The bounds should be a square with a power of 2 side (e.g. 2048) so every split keeps integer leaves.
     * Without bounds, the root is created at the first insert, on the ROOT_SIZE grid cell containing the top left corner of its rectangle.
     * The root grows when an item is inserted outside of it.
     */
    public static create<T extends object>(bounds?: Rectangle): Quadtree<T> {

        return new Quadtree<T>(bounds ?? null);

    }

    /**
     * Constructor to initialize the Quadtree node with a bounding rectangle
     * @param bounds 
     */
    private constructor(bounds: Rectangle | null) {
        this.bounds = bounds ? new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height) : null;
    }

    /**
     * Internal method to split the node into four child nodes
     */
    private split(): void {
        const subWidth = this.bounds.width / 2;
        const subHeight = this.bounds.height / 2;
        const x = this.bounds.x;
        const y = this.bounds.y;

        this.nodes[Index.northeast] = new Quadtree<T>(
            new Rectangle(x + subWidth, y, subWidth, subHeight)
        );
        this.nodes[Index.northwest] = new Quadtree<T>(
            new Rectangle(x, y, subWidth, subHeight)
        );
        this.nodes[Index.southwest] = new Quadtree<T>(
            new Rectangle(x, y + subHeight, subWidth, subHeight)
        );
        this.nodes[Index.southeast] = new Quadtree<T>(
            new Rectangle(x + subWidth, y + subHeight, subWidth, subHeight)
        );
    }

    private findContainingNode(rectangle: Rectangle): Quadtree<T> {
        for (const node of this.nodes) {
            if (node.bounds.contains(rectangle)) {
                return node;
            }
        }
        return null;
    }

    /**
     * Double the bounds towards the side(s) where the rectangle lies.
     * The previous content becomes one quadrant of the new root,
     * and the root keeps its identity for the callers.
     * @param rectangle the rectangle that must fit in the root
     */
    private grow(rectangle: Rectangle): void {
        const { x, y, width, height } = this.bounds;
        const westward = rectangle.x < x;
        const northward = rectangle.y < y;

        const previous = new Quadtree<T>(this.bounds);
        previous.objects = this.objects;
        previous.nodes = this.nodes;
        previous.filled = this.filled;

        // the previous root sits on the opposite side of the growth
        const index = !northward
            ? (westward ? Index.northeast : Index.northwest)
            : (westward ? Index.southeast : Index.southwest);

        this.bounds = new Rectangle(westward ? x - width : x, northward ? y - height : y, 2 * width, 2 * height);
        this.objects = [];
        this.nodes = [];
        this.split();
        this.nodes[index] = previous;
        this.filled = false;
    }

    /**
     * Insert an object with its bounding rectangle into the Quadtree
     * The root grows when the rectangle lies outside of its bounds
     * @param rectangle 
     * @param object 
     * @returns 
     */
    insert(rectangle: Rectangle, object: T): void {

        // growing could never cover a non finite rectangle, so the loop below would not end
        if (![rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(Number.isFinite)) {
            throw new RangeError(`cannot insert rectangle ${rectangle.toString()}`);
        }

        if (!this.bounds) {
            // aligned on the ROOT_SIZE grid so that trees created at different points share the same lines
            const size = Quadtree.ROOT_SIZE;
            this.bounds = new Rectangle(Math.floor(rectangle.x / size) * size, Math.floor(rectangle.y / size) * size, size, size);
        }

        // only the root can receive a rectangle outside its bounds, children always contain what they get
        while (!this.bounds.contains(rectangle)) {
            this.grow(rectangle);
        }

        // insert object into quadrant
        if (this.isSplitted()) {

            const node = this.findContainingNode(rectangle);
            if (node) {
                node.insert(rectangle, object);
                this.filled = this.checkFilled();
                return;
            }
        }

        // If the node doesn't have child nodes or the object doesn't fit in any child quadrant,
        // add the object to the current node
        const existingObject = this.objects.find((value) => {
            return value.rectangle.x === rectangle.x &&
                value.rectangle.y === rectangle.y &&
                value.rectangle.width === rectangle.width &&
                value.rectangle.height === rectangle.height
        })
        // an object inserted again at the same rectangle replaces the previous one
        if (existingObject) {
            existingObject.object = {...object};
        } else {
            this.objects.push({
                rectangle: new Rectangle(rectangle.x, rectangle.y, rectangle.width, rectangle.height),
                object: {...object}
            });
        }

        // If the node has exceeded the maximum number of objects and is larger than the minimum leaf size,
        // split the node and redistribute the objects to child nodes   
        // objects that fit no child stay here, so redistribution only has to run right after the split
        if (this.objects.length > Quadtree.MAX_OBJECTS && this.isLargerThanLeaf() && !this.isSplitted()) {

            this.split();

            let i = 0;
            while (i < this.objects.length) {

                const node = this.findContainingNode(this.objects[i].rectangle);

                if (node) {
                    const object = this.objects.splice(i, 1)[0];
                    node.insert(object.rectangle, object.object);
                } else {
                    i++;
                }
            }
        }

        // Check if filled
        if (!this.filled) {
            this.filled = this.checkFilled();
        }
    }

    /**
     * check if a point is covered by one of the objects of the node
     */
    private contains(point: Point) {
        for (const object of this.objects) {
            if (object.rectangle.contains(point)) {
                return true;
            }
        }
        return false;
    }

    /**
     * tells if this node is filled
     */
    private checkFilled() {

        if (this.filled) {
            return true;
        }
    
        if (!this.isSplitted()) {
            if (!this.isLargerThanLeaf()) {
                // check if all points in bounds are inside a rectangle
                for (let dx = 0; dx < this.bounds.width; dx++) {
                    for (let dy = 0; dy < this.bounds.height; dy++) {
                        if (false == this.contains(new Point(this.bounds.x + dx, this.bounds.y + dy))) {
                            return false;
                        }
                    }
                }
                return true;
            }
            return false;
        }
        else {
            for (const node of this.nodes) {
                if (!node.filled) {
                    return false;
                }
            }
            return true;
        }
    }

    private isSplitted() {
        return this.nodes[0];
    }

    private isLargerThanLeaf() {
        return Math.max(this.bounds.width, this.bounds.height) > Quadtree.MAX_LEAF_SIZE;
    }

    getBounds(bounds?: { min: Vector, max: Vector }): { min: Vector, max: Vector } {

        // an empty tree created without bounds has no root yet
        if (!this.bounds) {
            return bounds;
        }

        // leave early this node bounds are already covered
        if (bounds &&
            bounds.min.x < this.bounds.x &&
            bounds.min.y < this.bounds.y &&
            bounds.max.x > this.bounds.x + this.bounds.width &&
            bounds.max.y > this.bounds.y + this.bounds.height) {
            return bounds;
        }

        // check all nodes not entirely conained in any sub node
        for (const object of this.objects) {

            if (!bounds) {
                bounds = {
                    min: {
                        x: object.rectangle.x,
                        y: object.rectangle.y
                    },
                    max: {
                        x: object.rectangle.x + object.rectangle.width,
                        y: object.rectangle.y + object.rectangle.height
                    }
                }
                continue;
            }

            if (object.rectangle.x < bounds.min.x) {
                bounds.min.x = object.rectangle.x;
            }
            if (object.rectangle.y < bounds.min.y) {
                bounds.min.y = object.rectangle.y;
            }
            if (object.rectangle.x + object.rectangle.width > bounds.max.x) {
                bounds.max.x = object.rectangle.x + object.rectangle.width;
            }
            if (object.rectangle.y + object.rectangle.height > bounds.max.y) {
                bounds.max.y = object.rectangle.y + object.rectangle.height;
            }
        }
        
        if (this.isSplitted()) {
            for (const node of this.nodes) {
                bounds = node.getBounds(bounds);
            }
        }

        return bounds;
    }

    /**
     * Retrieve all objects that intersect with a given rectangle
     * @param queryRect 
     * @returns 
     */
    *retrieve(queryRect: Rectangle): Generator<T, void, undefined> {

        // return this node objects
        for (const object of this.objects) {
            if (queryRect.overlaps(object.rectangle)) {
                yield object.object;
            }
        }
        
        if (this.isSplitted()) {
            for (const node of this.nodes) {
                if (queryRect.overlaps(node.bounds)) {
                    yield *node.retrieve(queryRect);
                }
            }
        }
    }

    /**
     * Retrieve all objects that intersect with a given rectangle
     * @param queryRect 
     */
    *retrieveObjects(queryRect: Rectangle): Generator<T, void, undefined> {

        for (const object of this.objects) {
            if (queryRect.overlaps(object.rectangle)) {
                yield object.object;
            }
        }

        if (this.isSplitted()) {
            for (const node of this.nodes) {
                if (queryRect.overlaps(node.bounds)) {
                    yield* node.retrieveObjects(queryRect);
                }
            }
        }
    }

    /**
     * Yield every node whose bounds overlap a given rectangle, to display the tree structure
     * @param queryRect
     */
    *overlappingNodes(queryRect: Rectangle): Generator<QuadtreeNode, void, undefined> {

        if (!this.bounds || !queryRect.overlaps(this.bounds)) {
            return;
        }

        yield { bounds: this.bounds, filled: this.filled };

        if (this.isSplitted()) {
            for (const node of this.nodes) {
                yield* node.overlappingNodes(queryRect);
            }
        }
    }

    /**
     * Clear the Quadtree by removing all objects and child nodes
     */
    clear(): void {
        this.objects = [];
        this.nodes = [];
        this.filled = false;
    }
}