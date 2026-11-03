import { Quadtree, Rectangle, Point } from './QuadTree';

test('test', async () => {
  const quadtree = Quadtree.create(new Rectangle(0, 0, 800, 600));
  quadtree.insert(new Rectangle(10, 10, 20, 20), new Point(10, 10));
  quadtree.insert(new Rectangle(50, 50, 20, 20), new Point(50, 50));
  
  const generator = quadtree.retrieve(new Rectangle(0, 0, 30, 30));
  const values = Array.from(generator);

  expect(values.length).toEqual(1);
});

test('fill 8x8 yields the objects, not the node bounds', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 1024, 1024));
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      quadtree.insert(new Rectangle(x, y, 1, 1), { id: `${x},${y}` });
    }
  }

  const values = Array.from(quadtree.retrieve(new Rectangle(0, 0, 8, 8)));
  expect(values.length).toEqual(64);
  expect(values.map(v => v.id)).toContain('3,4');
});

test('retrieveObjects yields objects only, even when the area is filled', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 1024, 1024));
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      quadtree.insert(new Rectangle(x, y, 1, 1), { id: `${x},${y}` });
    }
  }

  const values = Array.from(quadtree.retrieveObjects(new Rectangle(0, 0, 8, 8)));
  expect(values.length).toEqual(64);
  expect(values.map(v => v.id)).toContain('3,4');
});

test('clear resets the filled state', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 8, 8));
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      quadtree.insert(new Rectangle(x, y, 1, 1), { id: `${x},${y}` });
    }
  }

  quadtree.clear();
  quadtree.insert(new Rectangle(0, 0, 1, 1), { id: 'a' });

  const values = Array.from(quadtree.retrieve(new Rectangle(0, 0, 8, 8)));
  expect(values).toEqual([{ id: 'a' }]);
});

test('the stored type must be an object, since insert copies it', async () => {
  // @ts-expect-error insert copies the object with a spread, so primitives are not supported
  Quadtree.create<string>(new Rectangle(0, 0, 8, 8));
});

test('retrieveObjects finds an object starting left of the query and overlapping it', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 1024, 1024));
  quadtree.insert(new Rectangle(5, 10, 20, 1), { id: 'long' });

  const values = Array.from(quadtree.retrieveObjects(new Rectangle(20, 10, 5, 1)));
  expect(values).toEqual([{ id: 'long' }]);
});

test('inserting again at the same rectangle replaces the object', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 1024, 1024));
  quadtree.insert(new Rectangle(1, 1, 1, 1), { id: 'first' });
  quadtree.insert(new Rectangle(1, 1, 1, 1), { id: 'second' });

  const values = Array.from(quadtree.retrieveObjects(new Rectangle(0, 0, 4, 4)));
  expect(values).toEqual([{ id: 'second' }]);
});

test('retrieveObjects matches a brute force search', async () => {
  let seed = 42;
  const random = (min: number, max: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return min + Math.floor((seed / 0x80000000) * (max - min + 1));
  };

  // objects partly or fully outside the root bounds are included on purpose
  const quadtree = Quadtree.create<{ index: number }>(new Rectangle(-64, -64, 128, 128));
  const rectangles: Rectangle[] = [];
  for (let i = 0; i < 500; i++) {
    const rectangle = new Rectangle(random(-100, 100), random(-100, 100), random(1, 12), random(1, 3));
    if (rectangles.some(r => r.toString() === rectangle.toString())) {
      continue;
    }
    quadtree.insert(rectangle, { index: rectangles.length });
    rectangles.push(rectangle);
  }

  for (let q = 0; q < 200; q++) {
    const query = new Rectangle(random(-100, 100), random(-100, 100), random(1, 40), random(1, 10));
    const expected = rectangles.map((r, i) => query.overlaps(r) ? i : -1).filter(i => i >= 0);
    const actual = Array.from(quadtree.retrieveObjects(query)).map(o => o.index).sort((a, b) => a - b);
    expect(actual).toEqual(expected);
  }
});

test('items outside the root are found after the root grows in every direction', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));
  const items: [Rectangle, string][] = [
    [new Rectangle(10, 10, 2, 2), 'inside'],
    [new Rectangle(500, 10, 1, 1), 'east'],
    [new Rectangle(-300, 10, 1, 1), 'west'],
    [new Rectangle(10, -200, 1, 1), 'north'],
    [new Rectangle(10, 900, 1, 1), 'south'],
    [new Rectangle(-300, -200, 1, 1), 'north-west'],
    [new Rectangle(900, 900, 1, 1), 'south-east'],
  ];
  for (const [rectangle, id] of items) {
    quadtree.insert(rectangle, { id });
  }

  for (const [rectangle, id] of items) {
    expect(Array.from(quadtree.retrieveObjects(rectangle))).toEqual([{ id }]);
  }
});

test('a rectangle crossing the root bounds is found from either side', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));
  quadtree.insert(new Rectangle(-100, -100, 300, 300), { id: 'wide' });

  expect(Array.from(quadtree.retrieveObjects(new Rectangle(-100, -100, 1, 1)))).toEqual([{ id: 'wide' }]);
  expect(Array.from(quadtree.retrieveObjects(new Rectangle(199, 199, 1, 1)))).toEqual([{ id: 'wide' }]);
});

test('retrieve still yields every object of a filled area after the root grows', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      quadtree.insert(new Rectangle(x, y, 1, 1), { id: `${x},${y}` });
    }
  }
  quadtree.insert(new Rectangle(1000, 1000, 1, 1), { id: 'far' });

  const values = Array.from(quadtree.retrieve(new Rectangle(0, 0, 8, 8)));
  expect(values.length).toEqual(64);
  expect(values.map(v => v.id)).toContain('3,4');
});

test('overlappingNodes yields the root of an empty tree', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));

  const nodes = Array.from(quadtree.overlappingNodes(new Rectangle(0, 0, 1, 1)));
  expect(nodes).toEqual([{ bounds: new Rectangle(0, 0, 64, 64), filled: false }]);
});

test('overlappingNodes only yields nodes overlapping the query and marks filled ones', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      quadtree.insert(new Rectangle(x, y, 1, 1), { id: `${x},${y}` });
    }
  }

  const query = new Rectangle(0, 0, 8, 8);
  const nodes = Array.from(quadtree.overlappingNodes(query));
  expect(nodes.every(node => query.overlaps(node.bounds))).toBe(true);
  expect(nodes).toContainEqual({ bounds: new Rectangle(0, 0, 8, 8), filled: true });

  const emptyQuery = new Rectangle(40, 40, 1, 1);
  expect(Array.from(quadtree.overlappingNodes(emptyQuery)).some(node => node.filled)).toBe(false);
});

test('overlappingNodes starts from the grown root', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));
  quadtree.insert(new Rectangle(1000, 1000, 1, 1), { id: 'far' });

  const nodes = Array.from(quadtree.overlappingNodes(new Rectangle(1000, 1000, 1, 1)));
  expect(nodes[0].bounds.contains(new Rectangle(1000, 1000, 1, 1))).toBe(true);
  expect(nodes[0].bounds.width).toBeGreaterThan(64);
});

test('inserting a non finite rectangle throws instead of growing forever', async () => {
  const quadtree = Quadtree.create<{ id: string }>(new Rectangle(0, 0, 64, 64));

  expect(() => quadtree.insert(new Rectangle(NaN, 0, 1, 1), { id: 'nan' })).toThrow(RangeError);
  expect(() => quadtree.insert(new Rectangle(0, 0, Infinity, 1), { id: 'infinite' })).toThrow(RangeError);
});

test('a tree created without bounds is empty until the first insert', async () => {
  const quadtree = Quadtree.create<{ id: string }>();

  expect(Array.from(quadtree.retrieveObjects(new Rectangle(-10, -10, 100, 100)))).toEqual([]);
  expect(Array.from(quadtree.retrieve(new Rectangle(-10, -10, 100, 100)))).toEqual([]);
  expect(Array.from(quadtree.overlappingNodes(new Rectangle(-10, -10, 100, 100)))).toEqual([]);
  expect(quadtree.getBounds()).toBeUndefined();
});

test('the root is created on the 64 cell grid containing the first inserted rectangle', async () => {
  const quadtree = Quadtree.create<{ id: string }>();
  quadtree.insert(new Rectangle(100, 70, 1, 1), { id: 'first' });

  const nodes = Array.from(quadtree.overlappingNodes(new Rectangle(100, 70, 1, 1)));
  expect(nodes[0].bounds).toEqual(new Rectangle(64, 64, 64, 64));
  expect(Array.from(quadtree.retrieveObjects(new Rectangle(100, 70, 1, 1)))).toEqual([{ id: 'first' }]);
});

test('trees created at different points share the same root grid, also for negative coordinates', async () => {
  const roots = [new Rectangle(494, 4, 1, 1), new Rectangle(500, 0, 1, 1), new Rectangle(-1, -1, 1, 1)].map((rectangle) => {
    const quadtree = Quadtree.create<{ id: string }>();
    quadtree.insert(rectangle, { id: 'first' });
    return Array.from(quadtree.overlappingNodes(rectangle))[0].bounds;
  });

  expect(roots).toEqual([new Rectangle(448, 0, 64, 64), new Rectangle(448, 0, 64, 64), new Rectangle(-64, -64, 64, 64)]);
});

test('items inserted on both sides of the first one are found after the root grows', async () => {
  const quadtree = Quadtree.create<{ id: string }>();
  quadtree.insert(new Rectangle(0, 0, 1, 1), { id: 'origin' });
  quadtree.insert(new Rectangle(-500, -300, 2, 2), { id: 'left' });
  quadtree.insert(new Rectangle(900, 700, 3, 3), { id: 'right' });

  const all = Array.from(quadtree.retrieveObjects(new Rectangle(-1000, -1000, 3000, 3000))).map(o => o.id).sort();
  expect(all).toEqual(['left', 'origin', 'right']);
  expect(Array.from(quadtree.retrieveObjects(new Rectangle(-500, -300, 1, 1)))).toEqual([{ id: 'left' }]);
});

test('a first rectangle larger than the initial root size grows the root to contain it', async () => {
  const quadtree = Quadtree.create<{ id: string }>();
  quadtree.insert(new Rectangle(100, 100, 300, 10), { id: 'wide' });

  const root = Array.from(quadtree.overlappingNodes(new Rectangle(100, 100, 1, 1)))[0].bounds;
  expect(root.contains(new Rectangle(100, 100, 300, 10))).toBe(true);
  expect(Array.from(quadtree.retrieveObjects(new Rectangle(399, 105, 1, 1)))).toEqual([{ id: 'wide' }]);
});

test('a non finite first insert throws and leaves the tree without a root', async () => {
  const quadtree = Quadtree.create<{ id: string }>();

  expect(() => quadtree.insert(new Rectangle(NaN, 0, 1, 1), { id: 'nan' })).toThrow(RangeError);
  expect(quadtree.getBounds()).toBeUndefined();
  expect(Array.from(quadtree.overlappingNodes(new Rectangle(0, 0, 1, 1)))).toEqual([]);
});

test('retrieveObjects matches a brute force search for a tree created without bounds', async () => {
  let seed = 11;
  const random = (min: number, max: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return min + Math.floor((seed / 0x80000000) * (max - min + 1));
  };

  const quadtree = Quadtree.create<{ index: number }>();
  const rectangles: Rectangle[] = [];
  for (let i = 0; i < 300; i++) {
    const rectangle = new Rectangle(random(-3000, 3000), random(-3000, 3000), random(1, 40), random(1, 40));
    if (rectangles.some(r => r.toString() === rectangle.toString())) {
      continue;
    }
    quadtree.insert(rectangle, { index: rectangles.length });
    rectangles.push(rectangle);
  }

  for (let q = 0; q < 100; q++) {
    const query = new Rectangle(random(-3000, 3000), random(-3000, 3000), random(1, 400), random(1, 400));
    const expected = rectangles.map((r, i) => query.overlaps(r) ? i : -1).filter(i => i >= 0);
    const actual = Array.from(quadtree.retrieveObjects(query)).map(o => o.index).sort((a, b) => a - b);
    expect(actual).toEqual(expected);
  }
});

test('retrieveObjects matches a brute force search for items far outside the root', async () => {
  let seed = 7;
  const random = (min: number, max: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return min + Math.floor((seed / 0x80000000) * (max - min + 1));
  };

  const quadtree = Quadtree.create<{ index: number }>(new Rectangle(0, 0, 64, 64));
  const rectangles: Rectangle[] = [];
  for (let i = 0; i < 300; i++) {
    const rectangle = new Rectangle(random(-3000, 3000), random(-3000, 3000), random(1, 40), random(1, 40));
    if (rectangles.some(r => r.toString() === rectangle.toString())) {
      continue;
    }
    quadtree.insert(rectangle, { index: rectangles.length });
    rectangles.push(rectangle);
  }

  for (let q = 0; q < 100; q++) {
    const query = new Rectangle(random(-3000, 3000), random(-3000, 3000), random(1, 400), random(1, 400));
    const expected = rectangles.map((r, i) => query.overlaps(r) ? i : -1).filter(i => i >= 0);
    const actual = Array.from(quadtree.retrieveObjects(query)).map(o => o.index).sort((a, b) => a - b);
    expect(actual).toEqual(expected);
  }
});

