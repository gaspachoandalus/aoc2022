/** Build-only copier for the static assets served with the compiled app. */
import { cp, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(projectDirectory, "dist");

async function shouldCopy(source, destination) {
    const sourceStats = await stat(source);
    if (!sourceStats.isFile()) {
        return true;
    }

    let destinationStats;
    try {
        destinationStats = await stat(destination);
    } catch (error) {
        if (error?.code === "ENOENT") {
            return true;
        }
        throw error;
    }

    if (!destinationStats.isFile() || sourceStats.size !== destinationStats.size) {
        return true;
    }
    // Avoid replacing unchanged assets that a local preview server may have open on Windows.
    if (sourceStats.mtimeMs === destinationStats.mtimeMs) {
        return false;
    }

    const [sourceContents, destinationContents] = await Promise.all([
        readFile(source),
        readFile(destination)
    ]);
    return !sourceContents.equals(destinationContents);
}

async function copyDirectoryIfPresent(directoryName) {
    const source = join(projectDirectory, directoryName);
    let sourceStats;

    try {
        sourceStats = await stat(source);
    } catch (error) {
        if (error?.code === "ENOENT") {
            return;
        }
        throw error;
    }

    if (!sourceStats.isDirectory()) {
        throw new Error(`Expected "${source}" to be a directory.`);
    }
    await cp(source, join(distDirectory, directoryName), { recursive: true, filter: shouldCopy });
}

await copyDirectoryIfPresent("static");
await copyDirectoryIfPresent("previews");
