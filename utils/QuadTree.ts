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

export class DebugRectangle {
    bounds: Rectangle;
}

/**
 * QuadTree class
 *
 * example
 * 
 * const quadtree = new Quadtree<Point>(0, new Rectangle(0, 0, 800, 600));
 * quadtree.insert(new Rectangle(10, 10, 20, 20), new Point(10, 10));
 * quadtree.insert(new Rectangle(50, 50, 20, 20), new Point(50, 50));
 * const objectsInArea = quadtree.retrieve(new Rectangle(0, 0, 30, 30));
 * console.log(objectsInArea);
 */
export class Quadtree<T> {
    private static MAX_OBJECTS = 10;
    private static MAX_LEVELS = 8;
    private static debug = false;

    /** objects of this node */
    private objects: Array<{
        rectangle: Rectangle,
        object: T
    }> = [];
    private nodes: Quadtree<T>[] = [];
    private level: number;
    private bounds: Rectangle;
    private filled: boolean = false;

    /**
     * Create QuadTree
     */
    public static create<T>(bounds: Rectangle): Quadtree<T> {

        return new Quadtree<T>(0, bounds);

    }

    /**
     * Constructor to initialize the Quadtree node with a specific level and bounding rectangle
     * @param level 
     * @param bounds 
     */
    private constructor(level: number, bounds: Rectangle) {
        this.level = level;
        this.bounds = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
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
            this.level + 1,
            new Rectangle(x + subWidth, y, subWidth, subHeight)
        );
        this.nodes[Index.northwest] = new Quadtree<T>(
            this.level + 1,
            new Rectangle(x, y, subWidth, subHeight)
        );
        this.nodes[Index.southwest] = new Quadtree<T>(
            this.level + 1,
            new Rectangle(x, y + subHeight, subWidth, subHeight)
        );
        this.nodes[Index.southeast] = new Quadtree<T>(
            this.level + 1,
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
     * Insert an object with its bounding rectangle into the Quadtree
     * @param rectangle 
     * @param object 
     * @returns 
     */
    insert(rectangle: Rectangle, object: T): void {

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
        if (!existingObject) {
            this.objects.push({
                rectangle: new Rectangle(rectangle.x, rectangle.y, rectangle.width, rectangle.height),
                object: {...object}
            });
        }

        // If the node has exceeded the maximum number of objects and hasn't reached the maximum depth,
        // split the node and redistribute the objects to child nodes   
        if (this.objects.length > Quadtree.MAX_OBJECTS && this.level < Quadtree.MAX_LEVELS) {

            if (Quadtree.debug) {
                console.log(`${this.bounds.toString()}:${this.level} splitting ${this.objects.length} objects`);
            }

            if (!this.isSplitted()) {
                this.split();
            }

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

            if (Quadtree.debug) {
                console.log(`${this.bounds.toString()}:${this.level} left ${this.objects.length} after redistribution`);
            }
        }

        if (Quadtree.debug) {
            if (this.objects.length > Quadtree.MAX_OBJECTS * 2) {
                console.warn(`${this.objects.length} objects in ${this.bounds.toString()} at level ${this.level}`);
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
            if (this.bounds.width <= 8 && this.bounds.height <= 8) {
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

    getBounds(bounds?: { min: Vector, max: Vector }): { min: Vector, max: Vector } {

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
    *retrieve(queryRect: Rectangle): Generator<T | Rectangle | DebugRectangle, void, T | Rectangle | DebugRectangle> {

        if (Quadtree.debug) {
            yield {
                bounds: this.bounds
            } as DebugRectangle
        }

        // if this node is filled, return the whole node
        if (this.filled) {
            yield this.bounds;
            return;
        }

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
     * Clear the Quadtree by removing all objects and child nodes
     */
    clear(): void {
        this.objects = [];
        // for (const node of this.nodes) {
        //     if (node) {
        //         node.clear();
        //     }
        // }
        this.nodes = [];
    }
}