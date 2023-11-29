import { assert } from "console";
import * as fs from "fs/promises"
import { addListener } from "process";

const INPUT = "./input.txt";
// const INPUT = "./testInput.txt";
export class Input {

    static async ReadAll(): Promise<string> {
        const buffer = await fs.readFile(INPUT);
        return buffer.toString("utf-8");
    }

    static async ReadLines(): Promise<string[]> {
        return (await this.ReadAll()).split("\n");
    }
}

export type Status = {
    part1: number;
    part2: number;
}

interface Vector {
    x: number,
    y: number
}

const moves: Array<Vector> = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
];

interface Blueprint {
    id: number,
    robots: {
        ore: {
            ore: number,
            clay: number,
            obsidian: number,
        },
        clay: {
            ore: number,
            clay: number,
            obsidian: number,
        },
        obsidian: {
            ore: number,
            clay: number,
            obsidian: number,
        },
        geode: {
            ore: number,
            clay: number,
            obsidian: number
        }
    }
};

const MINUTES = 24;

export class Problem {

    static blueprints: Array<Blueprint>;
    static iteration = 0;
    static lastIterationTime = 0;
    static best = {
        geodes: 0,
        list: []
    };
    static Run(lines: string[]): Status | undefined {

        this.parse(lines);

        // for (const id in this.blueprints) {
        //     const blueprint = this.blueprints[id];
        //     console.log("blueprint", id);
        //     console.log("  ore", blueprint.robots.ore.ore);
        //     console.log("  clay", blueprint.robots.clay.ore);
        //     console.log("  obsidian", blueprint.robots.obsidian.ore + blueprint.robots.clay.ore);
        //     console.log("  geode", blueprint.robots.geode.ore + blueprint.robots.geode.obsidian * (blueprint.robots.obsidian.ore + blueprint.robots.obsidian.clay * blueprint.robots.clay.ore));
        // }

        let quality = 0;
        for (const blueprint of this.blueprints) {
            this.iteration = 0;
            this.best = {
                geodes: 0,
                list: []
            };
            this.lastIterationTime = 0;

            this.exploreBlueprint(blueprint, 24);

            console.log("*VERY BEST*", "blueprint", blueprint.id, "iteration", this.iteration, "best", this.best);
            quality += blueprint.id * this.best.geodes;
            // break;
        }

        return {
            part1: quality,
            part2: 0
        };
    }

    static parse(lines: string[]): void {

        // Blueprint 1: Each ore robot costs 4 ore. Each clay robot costs 2 ore. Each obsidian robot costs 3 ore and 14 clay. Each geode robot costs 2 ore and 7 obsidian.
        let blueprints = lines.map(c => {
            const reMatch = c.match(/Blueprint (\d+)\: Each ore robot costs (\d+) ore. Each clay robot costs (\d+) ore. Each obsidian robot costs (\d+) ore and (\d+) clay. Each geode robot costs (\d+) ore and (\d+) obsidian./);
            return {
                id: parseInt(reMatch[1]),
                robots: {
                    ore: {
                        ore: parseInt(reMatch[2]),
                        clay: 0,
                        obsidian: 0
                    },
                    clay: {
                        ore: parseInt(reMatch[3]),
                        clay: 0,
                        obsidian: 0
                    },
                    obsidian: {
                        ore: parseInt(reMatch[4]),
                        clay: parseInt(reMatch[5]),
                        obsidian: 0
                    },
                    geode: {
                        ore: parseInt(reMatch[6]),
                        clay: 0,
                        obsidian: parseInt(reMatch[7]),
                    }
                }
            }
        });

        this.blueprints = blueprints;
        console.log("blueprints");
        console.dir(blueprints, { depth: null });
    }

    static exploreBlueprint(blueprint: Blueprint, minutesLeft: number) {
        // build
        const maxResourcesRequiredByRobot = {ore: 0, clay: 0, obsidian: 0};
        for (const type of [ "geode", "obsidian", "clay", "ore" ]) {
            const robotBlueprint = blueprint.robots[type];
            maxResourcesRequiredByRobot.ore = Math.max(maxResourcesRequiredByRobot.ore, robotBlueprint.ore ?? 0);
            maxResourcesRequiredByRobot.clay = Math.max(maxResourcesRequiredByRobot.clay, robotBlueprint.clay ?? 0);
            maxResourcesRequiredByRobot.obsidian = Math.max(maxResourcesRequiredByRobot.obsidian, robotBlueprint.obsidian ?? 0);
        }
        
        const robots = {ore: 1, clay: 0, obsidian: 0, geode: 0}; // start with one ore robot

        return this.explore(blueprint, minutesLeft, robots, {ore: 0, clay: 0, obsidian: 0, geode 
        : 0}, [ "geode", "obsidian", "clay", "ore" ], maxResourcesRequiredByRobot, []);
    }

    static explore(blueprint: Blueprint, minutesLeft: number, robotCount: {ore: number, clay: number, obsidian: number, geode: number}, resources: {ore: number, clay: number, obsidian: number, geode: number}, robotsNeeded: Array<string>, maxResourcesRequiredByRobot: {ore: number, clay: number, obsidian: number}, list: string[]) {

        if (minutesLeft == 0) {
            const geodes = resources.geode;
            if (geodes > this.best.geodes) {
                this.best = {
                    geodes,
                    list
                };
                console.log("new best", "blueprint", blueprint.id, "iteration", this.iteration, "best", this.best);
            }
            // console.log("end", resources);
            return;
        }

        // count and display every second
        this.iteration++;
        if (Date.now() - this.lastIterationTime > 1000) {

            console.log("blueprint", blueprint.id, "iteration", this.iteration, (this.iteration/(Date.now() - this.lastIterationTime) * 1000).toFixed(0) + "/sec", "geode", resources.geode, "best", this.best);

            this.lastIterationTime = Date.now();
        }

        // build
        const robotBuildDelay = {
            ore: 0,
            clay: 0,
            obsidian: 0,
            geode: 0
        };

        for (const robotType of robotsNeeded) {

            const robotBlueprint = blueprint.robots[robotType];

            // how much time to build it ?
            for (const resourceType of [ "ore", "clay", "obsidian" ]) {
                if (robotBlueprint[resourceType] > 0) {
                    // if (resources[resourceType] < robotBlueprint[resourceType] && robotCount[resourceType] == 0) {
                    //     robotBuildDelay[robotType] = Infinity;
                    //     break;
                    // }

                    robotBuildDelay[robotType] = Math.max(robotBuildDelay[robotType], Math.ceil((robotBlueprint[resourceType] - resources[resourceType]) / robotCount[resourceType]));
                }
            }
        }

        // console.log("robotBuildDelay", robotBuildDelay);

        const buildableRobots = [...Object.keys(robotBuildDelay)].filter(v => robotBuildDelay[v] != Infinity && robotsNeeded.find(v2 => v2 == v) && robotBuildDelay[v] < minutesLeft);
        if (buildableRobots.length == 0) {
            buildableRobots.push(null);
        }

        // console.log(minutesLeft, buildableRobots);

        for (const robotType of buildableRobots) {

            let newResources = {...resources};
            let newRobotsNeeded = [...robotsNeeded];
            let futureRobotCount = robotCount;
            let newMinutesLeft = minutesLeft;
            let actions = [];
            let action = "";

            if (robotType != null) {
                // create robot and consume resources
                const robotBlueprint = blueprint.robots[robotType];
                let delay = robotBuildDelay[robotType] + 1;// ? robotBuildDelay[robotType] : 1;

                // collect resources while building robot
                while (--delay > 0) {
                    let action = newMinutesLeft.toString();

                    for (let name in robotCount) {

                        if (robotCount[name] > 0) {
                            newResources[name] += robotCount[name];
                            action += `; fetch ${robotCount[name]} ${name} (${newResources[name]})`
                        }
                    }

                    actions.push(action);
                    newMinutesLeft--;
                    assert(newMinutesLeft > 0);
                }

                // consume resources for building robot
                newResources.ore -= robotBlueprint.ore;
                newResources.clay -= robotBlueprint.clay;
                newResources.obsidian -= robotBlueprint.obsidian;
                assert(newResources.ore >= 0);
                assert(newResources.clay >= 0);
                assert(newResources.obsidian >= 0);

                // create robot
                futureRobotCount = {...robotCount};
                futureRobotCount[robotType]++;

                action = newMinutesLeft.toString();
                action += `; build ${robotType}`;

                if(robotType != "geode" && robotCount[robotType] >= maxResourcesRequiredByRobot[robotType]) {
                    const index = newRobotsNeeded.findIndex(v => v == robotType);
                    assert(index >= 0);
                    newRobotsNeeded.splice(index, 1);
                    action += `; ${robotType} not needed`;
                }
            }
            // else {
            //     // no build, only collect resources
            //     delay = 1;
            // }

            // collect resources
            for (let name in robotCount) {

                if (robotCount[name] > 0) {
                    newResources[name] += robotCount[name];
                    action += `; fetch ${robotCount[name]} ${name} (${newResources[name]})`
                }
            }
            actions.push(action);

            // next
            list.push(...actions);
            assert(newRobotsNeeded.length >= 1);
            this.explore(blueprint, newMinutesLeft - 1, futureRobotCount, newResources, newRobotsNeeded, maxResourcesRequiredByRobot, list);
            list.splice(-actions.length, actions.length);
        }
    }

    static vectorAsString(pos: Vector): string {
        return `${pos.x},${pos.y}`;
    }
}

const lines = await Input.ReadLines();
const status = Problem.Run(lines);
console.log(status);
