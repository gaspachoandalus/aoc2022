/** Build-only renderer for the animated solution preview assets. */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(projectDirectory, "dist");
const previewsDirectory = join(projectDirectory, "previews");
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const frameCount = 12;
const captureFramesPerSecond = 8;
const outputSize = { width: 288, height: 162 };
const viewport = { width: 800, height: 450 };

function createCpuProgram() {
    const font = {
        A: ["111", "101", "111", "101", "101"],
        O: ["111", "101", "101", "101", "111"],
        C: ["111", "100", "100", "100", "111"]
    };
    const glyphs = ["A", "O", "C"];
    const targets = [];

    for (let row = 0; row < 6; row++) {
        const pixels = [];
        for (const [index, glyph] of glyphs.entries()) {
            const glyphRow = font[glyph][row] ?? "000";
            pixels.push(...[...glyphRow].map((pixel) => pixel === "1"));
            if (index < glyphs.length - 1) {
                pixels.push(false);
            }
        }
        while (pixels.length < 20) {
            pixels.push(false);
        }

        for (let pair = 0; pair < 20; pair++) {
            targets.push(pixels[pair] ? pair * 2 + 1 : pair * 2 + 4);
        }
    }

    return targets.map((target, index) => {
        const nextTarget = targets[index + 1] ?? target;
        return `addx ${nextTarget - target}`;
    }).join("\n");
}

function createLavaDroplet() {
    const cubes = [];
    const size = 5;
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                if (x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1) {
                    cubes.push(`${x},${y},${z}`);
                }
            }
        }
    }
    return cubes.join("\n");
}

function createCubeMap() {
    const rows = [];
    for (let y = 0; y < 200; y++) {
        if (y < 50) {
            rows.push(`${" ".repeat(50)}${".".repeat(100)}`);
        } else if (y < 100) {
            rows.push(`${" ".repeat(50)}${".".repeat(50)}`);
        } else if (y < 150) {
            rows.push(".".repeat(100));
        } else {
            rows.push(".".repeat(50));
        }
    }
    return `${rows.join("\n")}\n\n50R48L12`;
}

function createElfField() {
    const width = 13;
    const height = 11;
    return Array.from({ length: height }, (_, y) => {
        return Array.from({ length: width }, (_, x) => {
            const inside = x >= 2 && x <= 10 && y >= 2 && y <= 8;
            return inside && ((x * 13 + y * 7 + x * y) % 5 !== 0) ? "#" : ".";
        }).join("");
    }).join("\n");
}

const previews = [
    {
        id: "09",
        day: 9,
        zoom: 4,
        playbackFramesPerSecond: 3,
        input: "R 5\nU 3\nL 4\nD 2\nR 6\nU 2\nL 3\nD 5"
    },
    {
        id: "10",
        day: 10,
        zoom: 4,
        iterationsPerSecond: 240,
        playbackFramesPerSecond: 3,
        input: createCpuProgram()
    },
    {
        id: "12",
        day: 12,
        zoom: 4,
        center: true,
        playbackFramesPerSecond: 3,
        input: "Sabqponm\nabcryxxl\naccszExk\nacctuvwj\nabdefghi"
    },
    {
        id: "14",
        day: 14,
        zoom: 3.4,
        center: true,
        input: "498,4 -> 498,6 -> 496,6\n503,4 -> 502,4 -> 502,9 -> 494,9"
    },
    {
        id: "17.1",
        day: 17,
        zoom: 2,
        playbackFramesPerSecond: 3,
        input: "<><>>><<<>><<>>><<<>>><>"
    },
    {
        id: "18",
        day: 18,
        zoom: 1.2,
        iterationsPerSecond: 30,
        captureDelayMilliseconds: 10_000,
        playbackFramesPerSecond: 3,
        input: createLavaDroplet()
    },
    {
        id: "22",
        day: 22,
        zoom: 1.1,
        input: createCubeMap()
    },
    {
        id: "23",
        day: 23,
        zoom: 2.7,
        playbackFramesPerSecond: 3,
        input: createElfField()
    },
    {
        id: "24",
        day: 24,
        zoom: 1.1,
        iterationsPerSecond: 12,
        playbackFramesPerSecond: 4,
        input: "#.#####\n#..>..#\n#.....#\n#..v..#\n#...<.#\n#####.#"
    }
];

const contentTypes = {
    ".bmp": "image/bmp",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp"
};

function hasErrorCode(error, code) {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function serveFile(request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405);
        response.end("Method not allowed");
        return;
    }

    let requestedPath;
    try {
        requestedPath = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    } catch (error) {
        if (error instanceof URIError) {
            response.writeHead(400);
            response.end("Bad request");
            return;
        }
        throw error;
    }

    const filePath = resolve(distDirectory, `.${requestedPath}`);
    if (filePath !== distDirectory && !filePath.startsWith(`${distDirectory}${sep}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    try {
        const fileStats = await stat(filePath);
        if (!fileStats.isFile()) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }

        const data = await readFile(filePath);
        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Length": data.length,
            "Content-Type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream"
        });
        response.end(request.method === "HEAD" ? undefined : data);
    } catch (error) {
        if (hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR")) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }
        throw error;
    }
}

function startStaticServer() {
    const server = createServer((request, response) => {
        void serveFile(request, response).catch((error) => {
            console.error("Preview asset server failed:", error);
            if (!response.headersSent) {
                response.writeHead(500);
            }
            response.end("Internal server error");
        });
    });

    return new Promise((resolveServer, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (address === null || typeof address === "string") {
                reject(new Error("Could not determine the local preview server address."));
                return;
            }
            resolveServer({
                server,
                url: `http://127.0.0.1:${address.port}`
            });
        });
    });
}

function closeServer(server) {
    if (!server?.listening) {
        return Promise.resolve();
    }
    return new Promise((resolveClose, reject) => {
        server.close((error) => error ? reject(error) : resolveClose());
    });
}

function verifyFfmpegEncoder() {
    const result = spawnSync(ffmpegPath, ["-hide_banner", "-encoders"], { encoding: "utf8" });
    if (result.error) {
        throw new Error(`Could not run FFmpeg at "${ffmpegPath}". Install FFmpeg or set FFMPEG_PATH.`, {
            cause: result.error
        });
    }
    if (result.status !== 0 || !`${result.stdout}\n${result.stderr}`.includes("libwebp_anim")) {
        throw new Error(`FFmpeg at "${ffmpegPath}" must include the libwebp_anim encoder.`);
    }
}

function runCommand(executable, args) {
    return new Promise((resolveRun, reject) => {
        const child = spawn(executable, args, { stdio: "inherit" });
        child.once("error", reject);
        child.once("close", (code, signal) => {
            if (code === 0) {
                resolveRun();
                return;
            }
            reject(new Error(`${executable} exited with code ${code ?? signal}.`));
        });
    });
}

async function capturePreview(browser, baseUrl, preview, temporaryDirectory) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    try {
        await page.addInitScript(({ storageKey, input }) => {
            sessionStorage.setItem(storageKey, input);
        }, {
            storageKey: `aoc-input:${preview.day}`,
            input: preview.input
        });
        const rate = preview.iterationsPerSecond ? `;rate=${preview.iterationsPerSecond}` : "";
        const center = preview.center ? ";center=1" : "";
        await page.goto(`${baseUrl}/main.html#module=${encodeURIComponent(preview.id)};preview=1;zoom=${preview.zoom}${center}${rate}`, {
            waitUntil: "load",
            timeout: 60_000
        });
        await page.waitForFunction(
            (moduleName) => window.__aocPreview?.moduleName === moduleName && window.__aocPreview.started,
            preview.id,
            { timeout: 45_000 }
        );

        const canvas = page.locator('canvas[data-aoc-renderer="true"]').last();
        await canvas.waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(250);
        if (preview.captureDelayMilliseconds) {
            await page.waitForTimeout(preview.captureDelayMilliseconds);
        }

        const frameDirectory = join(temporaryDirectory, preview.id.replace(/[^\w.-]/g, "_"));
        await mkdir(frameDirectory, { recursive: true });
        for (let frame = 0; frame < frameCount; frame++) {
            await canvas.screenshot({
                path: join(frameDirectory, `frame-${String(frame).padStart(2, "0")}.png`)
            });
            await page.waitForTimeout(1000 / captureFramesPerSecond);
        }

        if (pageErrors.length > 0) {
            throw new Error(`Preview ${preview.id} produced a browser error: ${pageErrors[0].message}`);
        }

        const animationPath = join(frameDirectory, `${preview.id}.webp`);
        const posterPath = join(frameDirectory, `${preview.id}-poster.webp`);
        const framePattern = join(frameDirectory, "frame-%02d.png");
        const posterFrame = `frame-${String(frameCount - 1).padStart(2, "0")}.png`;
        const playbackFramesPerSecond = preview.playbackFramesPerSecond ?? captureFramesPerSecond;
        const scaleFilter = `scale=${outputSize.width}:${outputSize.height}:flags=lanczos`;

        await runCommand(ffmpegPath, [
            "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", String(playbackFramesPerSecond),
            "-i", framePattern,
            "-vf", scaleFilter,
            "-an",
            "-c:v", "libwebp_anim",
            "-loop", "0",
            "-quality", "70",
            "-preset", "picture",
            animationPath
        ]);
        await runCommand(ffmpegPath, [
            "-hide_banner", "-loglevel", "error", "-y",
            "-i", join(frameDirectory, posterFrame),
            "-frames:v", "1",
            "-vf", scaleFilter,
            "-c:v", "libwebp",
            "-quality", "78",
            "-preset", "drawing",
            posterPath
        ]);

        for (const outputPath of [animationPath, posterPath]) {
            const outputStats = await stat(outputPath);
            if (outputStats.size === 0) {
                throw new Error(`FFmpeg produced an empty preview asset: ${outputPath}`);
            }
        }

        return [
            { source: animationPath, destination: join(previewsDirectory, `${preview.id}.webp`) },
            { source: posterPath, destination: join(previewsDirectory, `${preview.id}-poster.webp`) }
        ];
    } catch (error) {
        if (pageErrors.length > 0 && error?.name === "TimeoutError") {
            throw new Error(`Preview ${preview.id} failed to start: ${pageErrors[0].message}`, { cause: error });
        }
        throw error;
    } finally {
        await context.close();
    }
}

async function main() {
    const distStats = await stat(join(distDirectory, "main.html")).catch((error) => {
        if (hasErrorCode(error, "ENOENT")) {
            throw new Error("Build the site before generating previews (npm run build).", { cause: error });
        }
        throw error;
    });
    if (!distStats.isFile()) {
        throw new Error(`Expected "${join(distDirectory, "main.html")}" to be a file.`);
    }

    verifyFfmpegEncoder();
    await mkdir(previewsDirectory, { recursive: true });
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "aoc2022-previews-"));
    let server;
    let browser;

    try {
        const localServer = await startStaticServer();
        server = localServer.server;
        browser = await chromium.launch();

        const generatedAssets = [];
        for (const preview of previews) {
            console.log(`Capturing ${preview.id}...`);
            generatedAssets.push(...await capturePreview(browser, localServer.url, preview, temporaryDirectory));
        }

        for (const asset of generatedAssets) {
            await cp(asset.source, asset.destination);
        }
        console.log(`Generated ${generatedAssets.length / 2} animated previews in previews/.`);
    } finally {
        await browser?.close();
        await closeServer(server);
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

await main();
