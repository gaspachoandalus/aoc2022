export type Status = {
    part1: number;
    part2: number;
}

interface Vector {
    x: number,
    y: number
}

const moves: Array<Vector> = [
    { x:  1, y:  0 },
    { x: -1, y:  0 },
    { x:  0, y:  1 },
    { x:  0, y: -1 }
];

type RecursiveArray = Array<number|RecursiveArray>;
    
export class Problem {

    static Run(lines: string[]): Status | undefined {

        const content = lines.join("\n");
        const packets: Array<RecursiveArray[]> = content.split("\n\n")
            .map(_2lines => {
                return _2lines.split("\n").map(line => eval(line))
            });

        // packets.forEach((pairs, i) => {
        //     const compare = this.compareArrays(pairs[0], pairs[1]);
        //     console.log(`pair ${i+1} (${JSON.stringify(pairs[0])};${JSON.stringify(pairs[1])}): ${compare}`);
        // });

        const part1 = packets.reduce((p, pairs, i) => {
            const ordered = this.compareArrays(pairs[0], pairs[1]);
            console.log(`pair ${i+1} (${JSON.stringify(pairs[0])};${JSON.stringify(pairs[1])}): ${ordered}`);

            return ordered ? p + (i + 1) : p;
        }, 0);

        return {
            part1,
            part2: 0
        };
    }

    static compareArrays(leftArray: RecursiveArray, rightArray: RecursiveArray) {

        for (let i = 0; i < leftArray.length; i++)
        {
            let left = leftArray[i];
            let right = rightArray[i];
            let ordered = null;

            // If the right list runs out of items first, the inputs are not in the right order
            if (right == null) {
                return false;
            }

            if (typeof left == "number" && typeof right == "number") {
                if (left < right) {
                    return true;
                }
                else if (left > right) {
                    return false;
                }
                // else continue comparison
            }
            else 
            {
                if (typeof left == "number") {
                    left = [ left ];
                }
                if (typeof right == "number") {
                    right = [ right ]
                }
                ordered = this.compareArrays(left, right);
            }

            if (ordered != undefined) return ordered;
        }

        // If the left list runs out of items first, the inputs are in the right order.
        if (leftArray.length < rightArray.length) return true;

        // If the lists are the same length and no comparison makes a decision about the order, continue checking the next part of the input.
    }

    static parse(lines: string[]): void {

        // TODO
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}
