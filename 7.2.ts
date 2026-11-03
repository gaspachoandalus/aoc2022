type Status = {
    result: number;
}

type Folder = {
    filesSize: number;
    totalSize: number;
    subFolders: Map<string, Folder>;
}

export class Problem {
    static stacks: Array<Array<string>> = [];
    static fileSystem: Folder = { filesSize: 0, totalSize: 0, subFolders: new Map() }
    static line = 0;
    static freeSpaceToFind = 0;
    static totalDiskSpace  = 70000000;
    static totalFreeSpaceNeeded = 30000000;

    static Run(lines: string[]): Status | undefined {

        Problem.ParseCommands(lines);

        // calc total size recursively
        this.findSmallest(this.fileSystem, "/", { value: 0 });
        console.log(this.fileSystem);

        Problem.calcFreeSpaceToFind();

        const current = { value: Number.MAX_SAFE_INTEGER };
        Problem.findSmallest(this.fileSystem, "/", current);

        return {
            result: current.value
        }
    }

    private static calcFreeSpaceToFind() {
        const freeSpace = this.totalDiskSpace - this.fileSystem.totalSize;
        console.log(`Freespace: ${freeSpace}`);
        this.freeSpaceToFind = this.totalFreeSpaceNeeded - freeSpace;
        console.log(`Need: ${Problem.freeSpaceToFind}`);
    }

    private static ParseCommands(lines: string[]) {
        let cwd: Array<Folder> = [];
        let currentDir = this.fileSystem;

        for (const line of lines) {
            const cd = line.match(/\$ cd (.+)/);
            if (cd) {
                if (cd[1] == "/") {
                    cwd = [this.fileSystem];
                }
                else if (cd[1] == "..") {
                    cwd.pop();
                    currentDir = cwd.slice(-1)[0];
                }
                else {
                    currentDir = currentDir.subFolders.get(cd[1]);
                    cwd.push(currentDir);
                }
                continue;
            }

            const ls = line.match(/\$ ls/);
            if (ls) {
                continue;
            }

            const dir = line.match(/dir (.+)/);
            if (dir) {
                currentDir.subFolders.set(dir[1], {
                    filesSize: 0,
                    totalSize: 0,
                    subFolders: new Map()
                });
                continue;
            }

            const file = line.match(/(\d+) (.+)/);
            if (file) {
                currentDir.filesSize += parseInt(file[1]);
                continue;
            }
        }
        return { cwd, currentDir };
    }

    static findSmallest(folder: Folder, name: string, current: {value: number}): number {

        let totalSize = folder.filesSize;
        
        for (const [ name, subFolder ] of folder.subFolders) {
            totalSize += this.findSmallest(subFolder, name, current);
        }

        if (totalSize >= this.freeSpaceToFind && totalSize < current.value) {
            console.log(`Smallest ${name} ${totalSize}`);
            current.value = totalSize;
        }

        folder.totalSize = totalSize;

        return totalSize;
    }
}
