const maxLines = 5;

export class Log {
    static logLines = [];
    static logVersion: number = 0;
    static updateVersion: number = 0;

    public static setTitle(text: string) {
        const title = document.getElementById("simulation-title");
        if (!title) {
            throw new Error("Missing simulation title element.");
        }
        title.textContent = text;
    }

    public static log(text: string) {
        this.logVersion = performance.now();
        this.logLines.push(text);
        if (this.logLines.length > maxLines) {
            this.logLines.shift();
        }
    }

    public static update() {
        if (this.updateVersion < this.logVersion) {
            const traces = document.getElementById("simulation-traces");
            if (!traces) {
                throw new Error("Missing simulation traces element.");
            }
            traces.textContent = this.logLines.join("\n");
            this.updateVersion = performance.now();
        }
    }
}
