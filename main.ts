import {Input } from "./Input.js";
import { DAYS } from "./days.js";
import { Display2D } from "./utils/Display2D.js";
import { Display3D } from "./utils/Display3D.js";
import { HeadlessDisplay } from "./utils/DisplayHeadless.js";
import { resolvePreviewIterationsPerSecond } from "./utils/DisplayOptions.js";
import type { DisplayOptions } from "./utils/DisplayOptions.js";
import { Log } from "./utils/Log.js";

let display: Display2D | Display3D | null = null;

declare global {
    interface Window {
        __aocPreview?: {
            moduleName: string;
            started: boolean;
            completed: boolean;
        };
    }
}

if (isWeb()) {
    addEventListener("hashchange", async (event) => {
        window.location.reload();
    });
}

await runModule();

/**
 * loads and runs the requested module
 */
async function runModule() {
    const parameters = isWeb() ? getFramentParameters() : getParameters();
    const moduleName = parameters["module"];
    const preview = isWeb() && parameters["preview"] === "1";
    const requestedPreviewZoom = Number(parameters["zoom"]);
    const previewZoom = Number.isFinite(requestedPreviewZoom)
        ? Math.min(4, Math.max(0.5, requestedPreviewZoom))
        : 1;
    const previewCenter = parameters["center"] === "1";
    const previewIterationsPerSecond = resolvePreviewIterationsPerSecond(Number(parameters["rate"]));

    if (moduleName) {
        if (isWeb()) {
            Log.setTitle(getSimulationTitle(moduleName));
        }
        if (preview) {
            document.body.classList.add("preview-mode");
            window.__aocPreview = {
                moduleName,
                started: false,
                completed: false
            };
        }
        await loadAndRunModule(moduleName, preview, previewZoom, previewIterationsPerSecond, previewCenter);
    }
    else if (isWeb()) {
        document.body.classList.add("selector-mode");
        const container = document.getElementById("day-selector");
        if (!container) {
            throw new Error("Missing #day-selector container.");
        }
        const { render } = await import("./utils/DaySelector.js");
        render(container);
    }
    else {
        console.error("no module name");
    }
}

function getSimulationTitle(moduleName: string): string {
    const day = DAYS.find(({ solutions }) => solutions.some(({ id }) => id === moduleName));
    const solution = day?.solutions.find(({ id }) => id === moduleName);
    if (!day || !solution) {
        return moduleName;
    }

    const dayTitle = day.label ? `Day ${day.day} · ${day.label}` : `Day ${day.day}`;
    const partsTitle = solution.parts.length === 2
        ? "Both parts"
        : `Part ${solution.parts[0]}`;
    return `${dayTitle} · ${partsTitle}`;
}

/**
 * loads a js module
 * @param {string} moduleName js module to load (without extension)
 */
async function loadAndRunModule(
    moduleName: string,
    preview: boolean = false,
    previewZoom: number = 1,
    previewIterationsPerSecond: number = 30,
    previewCenter: boolean = false
) {
    console.info(`loading module ${moduleName}`);

    const module = await import(`./${moduleName}.js`);
    if (module) {
        const problemClass = module.Problem ?? module.AOC;
        if (!problemClass) {
            throw new Error(`module ${moduleName} does not export a class named Problem or AOC`);
        }
        if (isWeb()) {
            const displayOptions: DisplayOptions = {
                ...(preview ? { preview: true, previewIterationsPerSecond, previewZoom, previewCenter } : {}),
                ...(module.config?.cameraFollow ? { cameraFollow: module.config.cameraFollow } : {})
            };
            if (module.config?.type == "3D") {
                display = new (await import("./utils/DisplayWeb3D.js")).WebDisplay3D(displayOptions);
                display.init();
            }
            if (!module.config?.type || module.config?.type == "2D") {
                display = new (await import("./utils/DisplayWeb2D.js")).DisplayWeb2D(displayOptions);
                display.init();
            }
        }
        else {
            display = null;
            if (module.config?.type === "2D") {
                display = new (await import("./utils/DisplayTerminal2D.js")).Terminal;
                display.init();
            }
        }
        const lines = await Input.ReadLines(moduleName);
        if (preview && window.__aocPreview) {
            window.__aocPreview.started = true;
        }
        // some early solutions expose Run as a static method instead of an instance method
        const status = typeof problemClass.Run === "function"
            ? await problemClass.Run(lines)
            : await new problemClass(display ?? new HeadlessDisplay()).Run(lines);
        if (preview && window.__aocPreview) {
            window.__aocPreview.completed = true;
        }
        const results = Object.keys(status).map(key => `Result ${key}: ${status[key]}`);
        for (const result of results) {
            Log.log(result);
        }
        if (!display) {
            if (isWeb()) {
                Log.update();
            }
            else {
                for (const result of results) console.log(result);
            }
        }
    }
    else {
        throw new Error("failed to load module");
    }
}

/**
 * @returns boolean
 */
function isWeb() {
    return typeof window !== "undefined";
}

/**
 * @returns Record<string, string>
 */
function getParameters() {
    return {
        "module": `${process.argv[2]}`
    };
}

/**
 * @returns Record<string, string>
 */
function getFramentParameters() {
    return window.location.hash?.slice(1)?.split(";")?.reduce((previousValue, currentValue) => {
        const a = currentValue.split("=");
        previousValue[a[0]] = a[1];
        return previousValue;
    }, {});
}