type Status = {
    result: number;
}

export class Problem {
    static line = 0;
    static width = 0;
    static height = 0;
    static visible: Map<string, boolean> = new Map();
    static maxScore = 0;
    static forest: string[] = [];

    static getScore(pos: {x, y}, direction: {x, y}): number {

        let treeSize = this.getTree(pos.x, pos.y);

        let score = 0;
        for (let x = pos.x + direction.x,
                 y = pos.y + direction.y;
             x >= 0 && y >= 0 && x < this.width && y < this.height;
             x += direction.x, y += direction.y) {
            const distantTreeSize = this.getTree(x, y);
            score++;
            if (distantTreeSize >= treeSize) break;
        }
        
        return score;
    }

    static getScenicScore(pos: {x, y}): number {

        let scores = [];

        const score = [
            {x:  0, y:  1}, // up
            {x:  0, y: -1}, // down
            {x:  1, y:  0}, // right
            {x: -1, y:  0}, // left
        ]
        .map((direction) => this.getScore(pos, direction)) // array of scores for each direction
        .reduce((p, c) => p * c, 1) // multiply scores

        console.log(`score ${pos.x},${pos.y}=${score}: ${scores}`);
        return score;
    }

    static Run(lines: string[]): Status | undefined {

        Problem.ParseLines(lines);

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++)
            {
                let score = this.getScenicScore({x, y});
                if (score > this.maxScore) {
                    this.maxScore = score;
                }
            }
        }

        return {
            result: this.maxScore
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
