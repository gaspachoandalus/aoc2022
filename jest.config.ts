import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    preset: "ts-jest",
    rootDir: "utils",
    transform: {
        "^.+\\.ts?$": "ts-jest"
    },
    collectCoverage: true
};

export default config;