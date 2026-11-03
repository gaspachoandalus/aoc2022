type Status = {
    score: number;
}

type Assignment = {
    start: number;
    end: number;
}

class Assignments {
    static Run(lines: string[]): Status {
        return lines.reduce((status, line) => {
            const assignments = this.ParseLine(line);
            const overlaps =
                Assignments.overlap(assignments[0], assignments[1]) ||
                Assignments.overlap(assignments[1], assignments[0])

            status.score += overlaps ? 1 : 0;

            return status;
        },
            {
                score: 0
            });
    }

    static ParseLine(line: string): Assignment[] {
        return line.split(",").map(
            (value) => {
                const boundaries = value.split("-").map(value => parseInt(value));
                return {
                    start: boundaries[0],
                    end: boundaries[1]
                }
            });
    }

    static overlap(assignment1: Assignment, assignment2: Assignment): boolean {
        // either start or end of assignment1 is inside assignement2
        return (
            (assignment1.start >= assignment2.start && assignment1.start <= assignment2.end) ||
            (assignment1.end >= assignment2.start && assignment1.end <= assignment2.end)
        );
    }
}

export { Assignments as Problem };
