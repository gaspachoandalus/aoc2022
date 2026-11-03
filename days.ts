// Hardcoded manifest: a static web page cannot discover solution files.
export type PuzzlePart = 1 | 2;

export type PuzzleSolution = {
    id: string;
    parts: PuzzlePart[];
    preview?: boolean;
};

export type PuzzleDay = {
    day: number;
    label?: string;
    solutions: PuzzleSolution[];
};

export const DAYS: PuzzleDay[] = [
    { day: 1, label: "Count the calories by elf", solutions: [{ id: "01", parts: [1, 2] }] },
    { day: 2, label: "Rock, paper, scissors", solutions: [{ id: "02", parts: [1, 2] }] },
    { day: 3, solutions: [{ id: "03.1", parts: [1] }, { id: "03.2", parts: [2] }] },
    { day: 4, solutions: [{ id: "04.1", parts: [1] }, { id: "4.2", parts: [2] }] },
    { day: 5, solutions: [{ id: "5.1", parts: [1] }, { id: "5.2", parts: [2] }] },
    { day: 6, solutions: [{ id: "6.1", parts: [1] }, { id: "6.2", parts: [2] }] },
    { day: 7, solutions: [{ id: "7.1", parts: [1] }, { id: "7.2", parts: [2] }] },
    { day: 8, solutions: [{ id: "8.1", parts: [1] }, { id: "8.2", parts: [2] }] },
    { day: 9, label: "Rope Bridge", solutions: [{ id: "09", parts: [1, 2], preview: true }] },
    { day: 10, label: "Cathode-Ray Tube", solutions: [{ id: "10.1", parts: [1] }, { id: "10", parts: [2], preview: true }] },
    { day: 11, solutions: [{ id: "11.1", parts: [1] }, { id: "11.2", parts: [2] }] },
    { day: 12, label: "Hill Climbing Algorithm", solutions: [{ id: "12", parts: [1, 2], preview: true }] },
    { day: 13, solutions: [{ id: "13.1", parts: [1] }, { id: "13.2", parts: [2] }] },
    { day: 14, label: "Regolith Reservoir", solutions: [{ id: "14", parts: [1, 2], preview: true }] },
    { day: 15, solutions: [{ id: "15", parts: [1, 2] }, { id: "15.1", parts: [1] }] },
    { day: 16, solutions: [{ id: "16.1", parts: [1] }, { id: "16.2", parts: [2] }] },
    { day: 17, label: "Pyroclastic Flow", solutions: [{ id: "17.1", parts: [1], preview: true }, { id: "17.2", parts: [2] }] },
    { day: 18, label: "Boiling boulders", solutions: [{ id: "18", parts: [1, 2], preview: true }] },
    { day: 19, solutions: [{ id: "19.1", parts: [1] }, { id: "19.2", parts: [2] }] },
    { day: 20, solutions: [{ id: "20.1", parts: [1] }, { id: "20.2", parts: [2] }] },
    { day: 21, solutions: [{ id: "21.1", parts: [1] }, { id: "21.2", parts: [2] }] },
    { day: 22, label: "Moving around the cube", solutions: [{ id: "22.1", parts: [1] }, { id: "22", parts: [2], preview: true }] },
    { day: 23, label: "Unstable Diffusion", solutions: [{ id: "23", parts: [1, 2], preview: true }] },
    { day: 24, label: "Blizzards", solutions: [{ id: "24", parts: [1, 2], preview: true }] },
    { day: 25, label: "SNAFU (brute force)", solutions: [{ id: "25", parts: [1] }] },
];
