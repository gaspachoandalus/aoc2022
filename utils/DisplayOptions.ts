export const MAX_PREVIEW_ITERATIONS_PER_SECOND = 1000;

export function resolvePreviewIterationsPerSecond(rate: number): number {
    if (!Number.isFinite(rate)) {
        return 30;
    }
    if (rate === 0) {
        return MAX_PREVIEW_ITERATIONS_PER_SECOND;
    }
    return Math.min(MAX_PREVIEW_ITERATIONS_PER_SECOND, Math.max(1, rate));
}

export function getThrottleLimit(rate: number): number {
    // Checkpoint uses -1 to skip per-step pacing while still yielding to the browser.
    return rate === 0 || rate === MAX_PREVIEW_ITERATIONS_PER_SECOND ? -1 : rate;
}

export type CameraFollowOptions = {
    distanceMultiplier?: number;
    positionDirection?: readonly [number, number, number];
    snapToInitialTarget?: boolean;
};

export type DisplayOptions = {
    preview?: boolean;
    previewIterationsPerSecond?: number;
    previewZoom?: number;
    previewCenter?: boolean;
    cameraFollow?: CameraFollowOptions;
};
