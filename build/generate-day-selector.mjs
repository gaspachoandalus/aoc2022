/** Build-only generator that embeds manifest-backed rows in the HTML shell. */
import { watch } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(projectDirectory, "main.html");
const outputPath = join(projectDirectory, "dist", "main.html");
const generatedRowsMarker = "<!-- GENERATED_DAY_ROWS -->";
let manifestRevision = 0;

/** Writes the manifest-backed solution index into the built HTML shell. */
async function generateDaySelector() {
    const [{ DAYS }, { daySummary, solutionPartsLabel }, { renderDayRows }] = await Promise.all([
        import(`../dist/days.js?revision=${++manifestRevision}`),
        import("../dist/utils/DaySelectorLabels.js"),
        import("./day-selector-markup.mjs"),
    ]);
    const source = await readFile(sourcePath, "utf8");
    const markerCount = source.split(generatedRowsMarker).length - 1;
    if (markerCount !== 1) {
        throw new Error(`Expected exactly one ${generatedRowsMarker} marker in main.html.`);
    }

    await writeFile(outputPath, source.replace(
        generatedRowsMarker,
        renderDayRows(DAYS, { daySummary, solutionPartsLabel })
    ));

    const obsoleteModulePath = join(projectDirectory, "dist", "utils", "DaySelectorMarkup");
    await Promise.all([".js", ".js.map"].map((extension) => {
        return rm(`${obsoleteModulePath}${extension}`, { force: true });
    }));
}

await generateDaySelector();

if (process.argv.includes("--watch")) {
    let updateTimer;
    const watcher = watch(join(projectDirectory, "dist"), (eventType, fileName) => {
        if (fileName?.toString() !== "days.js") {
            return;
        }

        clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            generateDaySelector().catch((error) => {
                console.error("Failed to regenerate the day selector from dist/days.js.", error);
            });
        }, 100);
    });
    watcher.on("error", (error) => {
        console.error("Failed to watch dist/days.js for selector updates.", error);
    });
}
