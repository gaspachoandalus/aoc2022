type Status = {
    score: number;
}

class Assignments
{
    static Run(lines: string[]): Status
    {
        let status: Status = {
            score: 0
        };
        for (const line of lines) {
            const assignments = this.ParseLine(line);
            const fullyContains = 
                Assignments.FullyContains(assignments[0], assignments[1]) ||
                Assignments.FullyContains(assignments[1], assignments[0]);

            status.score += fullyContains ? 1 : 0;
        }

        return status;
    }

    static ParseLine(line: string): number[][] {
        return line.split(",").map(
            (value) => value.split("-").map(value => parseInt(value))
        );
    }

    static FullyContains(assignment1: number[], assignment2: number[]): boolean
    {
        return (
            assignment1[0] <= assignment2[0] &&
            assignment1[1] >= assignment2[1]
        );
    }
}

export { Assignments as Problem };
