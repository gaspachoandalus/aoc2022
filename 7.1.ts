type Status = {
    result: number;
}

type Folder = {
    filesSize: number;
    subFolders: Map<string, Folder>;
}

export class Problem {
    static stacks: Array<Array<string>> = [];
    static fileSystem: Folder = { filesSize: 0, subFolders: new Map() }
    static line = 0;
    static max = 100000;

    static Run(lines: string[]): Status | undefined {

        let cwd: Array<Folder> = [];
        let currentDir = this.fileSystem;
        for (const line of lines)
        {
            const cd = line.match(/\$ cd (.+)/);
            if (cd) {
                if (cd[1] == "/") {
                    cwd = [ this.fileSystem ];
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
                    "filesSize": 0,
                    "subFolders": new Map()
                });
                continue;
            }

            const file = line.match(/(\d+) (.+)/);
            if (file) {
                currentDir.filesSize += parseInt(file[1]);
                continue;
            }
        }

        console.log(this.fileSystem);

        const list = [];
        this.deepBreathe(this.fileSystem, "/", list);
        return {
            result: list.reduce((previous, current) => {
                return previous + current;
            }, 0)
        }
    }

    static deepBreathe(folder: Folder, name: string, list: Array<number>): number {

        let totalSize = folder.filesSize;

        for (const [ name, subFolder ] of folder.subFolders) {
            totalSize += this.deepBreathe(subFolder, name, list);
        }

        if (totalSize <= this.max) {
            console.log(`Adding ${name} ${totalSize}`);
            list.push(totalSize)
        }

        return totalSize;
    }
}
