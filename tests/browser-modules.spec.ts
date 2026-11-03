import { test, expect } from '@playwright/test';

test('loads every manifest solution module in the browser', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const failures = await page.evaluate(async () => {
    const { DAYS } = await import('./days.js');
    const moduleNames = DAYS.flatMap(day => day.solutions.map(solution => solution.id));
    const errors: string[] = [];

    for (const moduleName of moduleNames) {
      try {
        const module = await import(`./${moduleName}.js`);
        const solution = module.Problem ?? module.AOC;
        if (typeof solution !== 'function' ||
            (typeof solution.Run !== 'function' && typeof solution.prototype?.Run !== 'function')) {
          errors.push(`${moduleName}: missing Problem/AOC Run method`);
        }
      } catch (error) {
        errors.push(`${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return errors;
  });

  expect(failures).toEqual([]);
});

test('removes only a terminal input line while preserving internal blank lines', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const lines = await page.evaluate(async () => {
    sessionStorage.setItem('aoc-input:2', 'first\n\nlast\n');
    const { Input } = await import('./Input.js');
    return Input.ReadLines('02');
  });

  await expect(lines).toEqual(['first', '', 'last']);
});

test('runs packet and tree solutions with line-array input', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const results = await page.evaluate(async () => {
    const part1Packets = await import('./13.1.js');
    const part2Packets = await import('./13.2.js');
    const visibleTrees = await import('./8.1.js');
    const scenicTrees = await import('./8.2.js');
    const forest = ['30373', '25512', '65332', '33549', '35390'];

    return [
      Boolean(part1Packets.Problem.Run(['[1]', '[2]'])),
      Boolean(part2Packets.Problem.Run(['[1]'])),
      visibleTrees.Problem.Run(forest),
      scenicTrees.Problem.Run(forest)
    ];
  });

  expect(results).toEqual([
    true,
    true,
    { result: 21 },
    { result: 8 }
  ]);
});

test('runs blueprint solutions without Node-only assertion imports', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const results = await page.evaluate(async () => {
    const blueprint = 'Blueprint 1: Each ore robot costs 100 ore. Each clay robot costs 100 ore. Each obsidian robot costs 100 ore and 100 clay. Each geode robot costs 100 ore and 100 obsidian.';
    const part1 = await import('./19.1.js');
    const part2 = await import('./19.2.js');

    return [
      part1.Problem.Run([blueprint]),
      part2.Problem.Run([
        blueprint,
        blueprint.replace('Blueprint 1:', 'Blueprint 2:'),
        blueprint.replace('Blueprint 1:', 'Blueprint 3:')
      ])
    ];
  });

  expect(results[0]).toBeTruthy();
  expect(results[1]).toBeTruthy();
});

test('keeps all three Day 24 trips as distinct colored paths', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const result = await page.evaluate(async () => {
    const { Problem } = await import('./24.js');
    const styles: Array<{ group: number; color?: number; name?: string }> = [];
    const blocks: Array<{ x: number; y: number; z: number; group: number }> = [];
    const display = {
      init(_iterationsPerSecond?: number) {},
      setStyle(
        group: number,
        style: { name?: string; color?: number; transparent?: boolean; opacity?: number }
      ) {
        styles.push({ group, ...style });
      },
      start() {},
      log(_text: string) {},
      addBlock(x: number, y: number, z: number, group: number) {
        blocks.push({ x, y, z, group });
      },
      move(_sourceGroup: number, _targetGroup: number) {},
      fadeOut(_group: number, _opacity: number) {},
      clear(group: number) {
        for (let index = blocks.length - 1; index >= 0; index--) {
          if (blocks[index].group === group) {
            blocks.splice(index, 1);
          }
        }
      },
      pause() {
        return Promise.resolve();
      },
      checkpoint() {
        return Promise.resolve();
      },
      center(_x: number, _y?: number, _z?: number) {}
    };

    const status = await new Problem(display).Run([
      '#.###',
      '#...#',
      '###.#'
    ]);

    return {
      status,
      tripStyles: styles.filter((style) => style.group >= 5),
      paths: [5, 6, 7].map((group) => {
        const path = blocks
          .filter((block) => block.group === group)
          .sort((left, right) => left.z - right.z);
        return {
          group,
          count: path.length,
          first: path.length ? [path[0].x, path[0].y, path[0].z] : null,
          last: path.length ? [path[path.length - 1].x, path[path.length - 1].y, path[path.length - 1].z] : null
        };
      })
    };
  });

  expect(result.status).toEqual({ part1: 4, part2: 12 });
  expect(result.tripStyles.map(({ group, name }) => ({ group, name }))).toEqual([
    { group: 5, name: 'Path 1: start to exit' },
    { group: 6, name: 'Path 2: exit to start' },
    { group: 7, name: 'Path 3: start to exit' }
  ]);
  expect(new Set(result.tripStyles.map(({ color }) => color)).size).toBe(3);
  expect(result.paths).toEqual([
    { group: 5, count: 5, first: [0, -1, 0], last: [2, 1, 4] },
    { group: 6, count: 5, first: [2, 1, 4], last: [0, -1, 8] },
    { group: 7, count: 5, first: [0, -1, 8], last: [2, 1, 12] }
  ]);
});
