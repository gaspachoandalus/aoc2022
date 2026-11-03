type Status = {
    result: number;
}


export class Problem {
    static line = 0;
    static width = 0;
    static height = 0;
    static visible: Map<string, boolean> = new Map();
    static forest: string[] = [];

    static Run(lines: string[]): Status | undefined {

        Problem.ParseLines(lines);

        let previous: number;

        for (let x = 0; x < this.width; x++) {
            previous = -1;
            for (let y = 0; y < this.height; y++) {
                const tree = this.getTree(x, y);
                if (tree > previous) {
                    this.visible.set(`${x}_${y}`, true);
                    previous = tree;
                }
            }
            previous = -1;
            for (let y = this.height - 1; y >= 0; y--) {
                const tree = this.getTree(x, y);
                if (tree > previous) {
                    this.visible.set(`${x}_${y}`, true);
                    previous = tree;
                }
            }
        }
        for (let y = 0; y < this.height; y++) {
            previous = -1;
            for (let x = 0; x < this.width; x++) {
                const tree = this.getTree(x, y);
                if (tree > previous) {
                    this.visible.set(`${x}_${y}`, true);
                    previous = tree;
                }
            }
            previous = -1;
            for (let x = this.width - 1; x >= 0; x--) {
                const tree = this.getTree(x, y);
                if (tree > previous) {
                    this.visible.set(`${x}_${y}`, true);
                    previous = tree;
                }
            }
        }

        return {
            result: this.visible.size
        }
    }

    private static getTree(x: number, y: number): number {
        return parseInt(this.forest[y][x]);
    }

    private static ParseLines(lines: string[]) {
        Problem.forest = lines;
        Problem.width = lines[0].length;
        Problem.height = Problem.forest.length;
    }
}
