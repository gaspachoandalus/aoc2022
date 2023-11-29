
export class Input {
    static async ReadLines(moduleName: string): Promise<string[]> {
        if (typeof window === 'undefined') {
            const fs = await import("fs/promises");
            const path = await import("path");
            const url = await import("url");
            // const filename = url.fileURLToPath(import.meta.url);
            // var scriptNumber = path.basename(filename).split('.').slice(0, -1).join('.').match(/\d+/);
            const buffer = await fs.readFile(moduleName + ".in");
            return buffer.toString("utf-8").split("\n");
        }
        else {
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
                    return text.split("\n");
                });
        }
    }
}
