import { Quadtree, Rectangle, Point } from './QuadTree';

test('test', async () => {
  const quadtree = Quadtree.create(new Rectangle(0, 0, 800, 600));
  quadtree.insert(new Rectangle(10, 10, 20, 20), new Point(10, 10));
  quadtree.insert(new Rectangle(50, 50, 20, 20), new Point(50, 50));
  
  const generator = quadtree.retrieve(new Rectangle(0, 0, 30, 30));
  const values = Array.from(generator);

  expect(values.length).toEqual(1);
});

test('fill 8x8', async () => {
  const quadtree = Quadtree.create<string>(new Rectangle(0, 0, 1024, 1024));
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      quadtree.insert(new Rectangle(x, y, 1, 1), `${x},${y}`);
    }
  }

  const generator = quadtree.retrieve(new Rectangle(0, 0, 8, 8));
  const value = generator.next().value;
  expect(value).toBeInstanceOf(Rectangle);
  expect(value).toEqual(new Rectangle(0, 0, 8, 8));
});
