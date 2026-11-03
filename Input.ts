
import { readPuzzleInput } from "./utils/PuzzleInput.js";

function splitInputLines(text: string): string[] {
    const lines = text.split(/\r\n|\n/);
    if (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

export class Input {
    static async ReadLines(moduleName: string): Promise<string[]> {
        if (typeof window === 'undefined') {
            const fs = await import("fs/promises");
            const path = await import("path");
            const url = await import("url");
            // const filename = url.fileURLToPath(import.meta.url);
            // var scriptNumber = path.basename(filename).split('.').slice(0, -1).join('.').match(/\d+/);
            const buffer = await fs.readFile(moduleName + ".in");
            return splitInputLines(buffer.toString("utf-8"));
        }
        else {
            const savedInput = readPuzzleInput(moduleName);
            if (savedInput !== null) {
                return splitInputLines(savedInput);
            }

            return fetch(`./${moduleName}.in`)
                .catch((reason: any) => {
                    console.error("");
                    return new Response("");
                })
                .then(async (value: Response) => {
                    if (!value.ok) {
                        return [];
                    }
                    const text = await value.text();
                    return splitInputLines(text);
                });
        }
    }
}
