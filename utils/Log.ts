const maxLines = 5;

export class Log {
    static logLines = [];
    static logVersion: number = 0;
    static updateVersion: number = 0;

    public static log(text: string) {
        this.logVersion = performance.now();
        this.logLines.push(text);
        if (this.logLines.length > maxLines) {
            this.logLines.shift();
        }
    }

    public static update() {
        if (this.updateVersion < this.logVersion) {
            const info = document.getElementById("info");
            info.innerText = this.logLines.join("\n");
            this.updateVersion = performance.now();
        }
    }
}
