import { Vector, vectorAsString } from "./utils/vector.js";
import { Display2D } from "./utils/Display2D.js";

export type Status = {
    part1: number;
    part2: number;
}

// y positive is south
const _8directions = [
    { x: 1, y: 0 }, // E
    { x: 1, y: 1 }, // SE
    { x: 0, y: 1 }, // S
    { x: -1, y: 1 }, // SW
    { x: -1, y: 0 }, // W
    { x: -1, y: -1 }, // NW
    { x: 0, y: -1 },  // N
    { x: 1, y: -1 }  // NE
];

const _4directions = [
    { x: 0, y: -1 }, // N
    { x: 0, y: 1 }, // S
    { x: -1, y: 0 }, // W
    { x: 1, y: 0 } // E
];

export class AOC {

    display: Display2D;
    elves: Map<string, Vector>;

    constructor(display: Display2D) {
        this.display = display;
    }

    async Run(lines: string[]): Promise<Status | undefined> {

        this.parse(lines);

        this.display
            .setBoundaries({ min: { x: -5, y: -5 }, max: { x: 200, y: 100 } })

        let emptyTilesAtRound10;
        let round;
        let moves;
        for (round = 0, moves = Infinity; moves > 0; round++) {
            await this.display
                .setItems(this.elves.values())
                .setItems([], 2)
                .setTitle(`Round ${round}`)
                .throttle();
            moves = await this.makeMoves(round);

            if (round == 9) {
                const boundaries = [...this.elves.values()].reduce((p, c) => {

                    p.xmin = Math.min(p.xmin, c.x);
                    p.xmax = Math.max(p.xmax, c.x);
                    p.ymin = Math.min(p.ymin, c.y);
                    p.ymax = Math.max(p.ymax, c.y);
                    return p;

                }, { xmin: Infinity, ymin: Infinity, xmax: 0, ymax: 0 });

                const surface = (boundaries.xmax - boundaries.xmin + 1) * (boundaries.ymax - boundaries.ymin + 1);
                emptyTilesAtRound10 = surface - this.elves.size;
            }
        }

        return {
            part1: emptyTilesAtRound10,
            part2: round
        };
    }

    /**
     * @returns number of elves that actually moved
     */
    async makeMoves(round: number): Promise<number> {

        const movesByElf = new Map<string /* start position */, {start: Vector, destination: Vector}>();
        const movesCountByDestination = new Map<string, number>();

        // first half
        // During the first half of each round, each Elf...
        for (const [_, pos] of this.elves) {

            // ...considers the eight positions adjacent to themself. If no other Elves are in one of those eight positions, the Elf does not do anything during this round
            const around = _8directions.map(v => ({ x: pos.x + v.x, y: pos.y + v.y }));
            const noOneAround = around.every(v => !this.elves.has(vectorAsString(v)));
            // await DisplayImpl.setLookup(around).render();
            if (noOneAround)
                continue;

            // Otherwise, the Elf looks in each of four directions in the following order and proposes moving one step in the first valid direction:
            let direction: Vector;
            for (let directionIdx = 0; directionIdx < _4directions.length; directionIdx++) {
                const toCheck = _4directions[(directionIdx + round) % _4directions.length];

                const around = _8directions
                    .filter(v => (toCheck.x && v.x == toCheck.x) || (toCheck.y && v.y == toCheck.y))
                    .map(v => ({ x: pos.x + v.x, y: pos.y + v.y }))
                const noOneAround = around.every(v => !this.elves.has(vectorAsString(v)));
                // await DisplayImpl.setLookup(around).render();
                if (noOneAround) {
                    direction = toCheck;
                    break;
                }
            }

            if (direction) {
                const destination = { x: pos.x + direction.x, y: pos.y + direction.y };
                movesByElf.set(vectorAsString(pos), { start: { ...pos }, destination: { ...destination } });
                movesCountByDestination.set(vectorAsString(destination), (movesCountByDestination.get(vectorAsString(destination)) ?? 0) + 1);
            }
        }


        // second half => each Elf moves to their proposed destination tile if they were the only Elf to propose moving to that position
        let moves = 0;

        // // display all moves
        await this.display
            .setItems([...movesByElf.values()].filter(v => movesCountByDestination.get(vectorAsString(v.destination)) == 1).map(v => v.start), 1)
            .throttle(); // display all moves
    
        for (const [ id, move ] of movesByElf) {
            if (movesCountByDestination.get(vectorAsString(move.destination)) == 1) {
                this.elves.delete(id);
                this.elves.set(vectorAsString(move.destination), { ...move.destination });
                moves++;
            }
        }

        // Finally, at the end of the round, the first direction the Elves considered is moved to the end of the list of directions. For example, during the second round, the Elves would try proposing a move to the south first, then west, then east, then north. On the third round, the Elves would first consider west, then east, then north, then south.
        // => round will be incremented

        return moves;
    }

    parse(lines: string[]): void {

        this.elves = lines.reduce((p, c, y) => {
            for (let x = 0; x < c.length; x++) {
                if (c[x] == "#") {
                    p.set(vectorAsString({ x, y }), { x, y });
                }
            }
            return p;
        }, new Map<string, Vector>());
    }
}
