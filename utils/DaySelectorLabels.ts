/** Human-readable solution coverage shared by the runtime and build-time selector. */
import type { PuzzleDay, PuzzleSolution } from "../days.js";

/** Names the puzzle part or parts covered by one solution. */
export function solutionPartsLabel(solution: PuzzleSolution): string {
    return solution.parts.length === 2 ? "Both parts" : `Part ${solution.parts[0]}`;
}

/** Summarizes the part coverage of the solutions currently represented by a day row. */
export function daySummary(day: PuzzleDay, solutions: readonly PuzzleSolution[] = day.solutions): string {
    if (solutions.length === 1) {
        const solution = solutions[0];
        if (solution.parts.length === 2) {
            return "1 solution · both parts";
        }
        return `1 solution · ${solutionPartsLabel(solution)} only`;
    }

    const coveredParts = new Set(solutions.flatMap((solution) => solution.parts));
    const hasOneSolutionPerPart = solutions.length === 2
        && solutions.every((solution) => solution.parts.length === 1)
        && coveredParts.has(1)
        && coveredParts.has(2);

    return hasOneSolutionPerPart
        ? "2 solutions · one per part"
        : `${solutions.length} solutions`;
}
