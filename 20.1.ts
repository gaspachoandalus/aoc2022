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

export class Problem {

    static list: Array<string> = [];
    static numberPosition: Map<string, number>;

    static Run(lines: string[]): Status | undefined {

        this.parse(lines);
        console.log("list", this.list);
        console.log("map", this.numberPosition);

        this.moves();

        return {
            part1: 0,
            part2: 0
        };
    }

    static moves() {

        function getNumber(s: string) {
            return parseInt(s.split("_")[0]);
        }

        const newList = [ ...this.list ];

        for (let i = 0; i < this.list.length; i++) {

            const value = this.list[i];

            const pos = newList.findIndex(c => c == value);

            const move = getNumber(newList[pos]);

            const newPos = (pos + move + newList.length) % newList.length;

            if (move != 0) {
                newList.splice(pos, 1);
    
                if (pos + move == 0) {
                    newList.splice(newList.length, 0, value); // put at end instead of start
                }
                else if (pos + move < 0) {
                    newList.splice(newPos - 1, 0, value);
                }
                else if (pos + move > this.list.length) {
                    newList.splice(newPos + 1, 0, value);
                }
                else {
                    newList.splice(newPos, 0, value);
                }
            }
        }

        console.log(newList);

        const zeroIndex = newList.findIndex(c => c == "0_0");
        const result =
            getNumber(newList[(zeroIndex + 1000) % this.list.length]) +
            getNumber(newList[(zeroIndex + 2000) % this.list.length]) +
            getNumber(newList[(zeroIndex + 3000) % this.list.length]);

            console.log(result);

        // for (let pos = 0; pos < this.list.length; pos++) {

            // const value = parseInt(this.list[pos].split("_")[0]);

            // const currentPosition = this.numberPosition.get(this.list[pos]);

            // // 5 + 3 (of 7) => 4
            // const newPosition = (currentPosition + value) % this.list.length;

            // for (const item of this.numberPosition) {
            //     if (item[1] )
            // }
            // this.numberPosition.set(this.list[pos], currentPosition + value);

            // // if (pos + value > this.list)
        // }
    }

    static parse(lines: string[]): void {

        const list = lines.map(c => parseInt(c));

        const map = new Map<string, number>();
        for (let i = 0; i < list.length; i++) {

            let subscript = 0;
            do {
                let name = `${list[i]}_${subscript}`;
                if (map.has(name)) {
                    subscript++;
                }
                else {
                    this.list.push(name);
                    map.set(name, i);
                    break;
                }
            }
            while (true);
        }

        this.numberPosition = map;
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}
