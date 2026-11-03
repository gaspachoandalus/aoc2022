import { DAYS } from "../days.js";

const STORAGE_PREFIX = "aoc-input:";

export function puzzleDayNumber(solutionId: string): number | null {
    const match = /^(\d{1,2})(?:\.\d+)?$/.exec(solutionId);
    if (!match) {
        return null;
    }

    const dayNumber = Number(match[1]);
    return dayNumber >= 1 && dayNumber <= 25 ? dayNumber : null;
}

function storageKey(solutionId: string): string {
    return `${STORAGE_PREFIX}${puzzleDayNumber(solutionId) ?? solutionId}`;
}

function legacyStorageKeys(solutionId: string): string[] {
    const keys = new Set<string>([`${STORAGE_PREFIX}${solutionId}`]);
    const dayNumber = puzzleDayNumber(solutionId);

    if (dayNumber !== null) {
        for (const day of DAYS) {
            if (day.day === dayNumber) {
                for (const solution of day.solutions) {
                    keys.add(`${STORAGE_PREFIX}${solution.id}`);
                }
            }
        }
    }

    keys.delete(storageKey(solutionId));
    return [...keys];
}

export function readPuzzleInput(solutionId: string): string | null {
    const key = storageKey(solutionId);
    const savedInput = sessionStorage.getItem(key);
    if (savedInput !== null) {
        return savedInput;
    }

    for (const legacyKey of legacyStorageKeys(solutionId)) {
        const legacyInput = sessionStorage.getItem(legacyKey);
        if (legacyInput !== null) {
            savePuzzleInput(solutionId, legacyInput);
            return legacyInput;
        }
    }

    return null;
}

export function hasSavedPuzzleInput(solutionId: string): boolean {
    if (sessionStorage.getItem(storageKey(solutionId)) !== null) {
        return true;
    }
    return legacyStorageKeys(solutionId).some((key) => sessionStorage.getItem(key) !== null);
}

export function savePuzzleInput(solutionId: string, input: string): void {
    sessionStorage.setItem(storageKey(solutionId), input);
    for (const legacyKey of legacyStorageKeys(solutionId)) {
        sessionStorage.removeItem(legacyKey);
    }
}

export function clearPuzzleInput(solutionId: string): void {
    sessionStorage.removeItem(storageKey(solutionId));
    for (const legacyKey of legacyStorageKeys(solutionId)) {
        sessionStorage.removeItem(legacyKey);
    }
}
