import {Input } from "./Input.js";
import { Display2D } from "./utils/Display2D.js";
import { Display3D } from "./utils/Display3D.js";
import { Log } from "./utils/Log.js";

let display2D: Display2D = null;
let display3D: Display3D = null;

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

    if (moduleName) {
        await loadAndRunModule(moduleName);
    }
    else {
        console.error("no module name");
    }
}

/**
 * loads a js module
 * @param {string} moduleName js module to load (without extension)
 */
async function loadAndRunModule(moduleName) {
    console.info(`loading module ${moduleName}`);

    const module = await import(`./${moduleName}.js`);
    if (module) {
        let problemClass;
        if (isWeb()) {
            problemClass = module.Problem ?? module.AOC;
            if (module.config?.type == "3D" && !display3D) {
                display3D = new (await import("./utils/DisplayWeb3D.js")).WebDisplay3D;
                display3D.init();
            }
            if ((!module.config?.type || module.config?.type == "2D") && !display2D) {
                display2D = new (await import("./utils/DisplayWeb2D.js")).DisplayWeb2D;
                display2D.init();
            }
        }
        else {
            display2D = new (await import("./utils/DisplayTerminal2D.js")).Terminal;
        }
        const lines = await Input.ReadLines(moduleName);
        const problem = new problemClass(display2D ?? display3D);
        const status = await problem.Run(lines);
        for (const key of Object.keys(status)) {
            Log.log(`Result ${key}: ${status[key]}`);
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