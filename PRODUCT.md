# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who want to run an Advent of Code 2022 solution in a browser with their own puzzle input.

## Product Purpose

Provide a GitHub-hosted page where developers can choose a 2022 solution, supply its required puzzle input, run it, and inspect the result.

## Positioning

The page runs this repository's day-specific solutions in the browser; supported solutions can render their output as 2D or 3D visualizations.

## Operating Context

Developers select a solution and enter its puzzle input. The site does not fetch input from Advent of Code; it links to the selected day's input page so the user can sign in, copy, and paste it. The same input is shared across both parts of a day, saved in the current browser tab after a launch, and reused by every solution for that day.

## Capabilities and Constraints

- The solution index groups a fixed manifest of this repository's Advent of Code 2022 modules by puzzle day.
- Each listed module explicitly records whether it handles Part 1, Part 2, or both; days can have separate or overlapping solutions, a shared solution, or only the part available for that puzzle.
- A puzzle input is required; saved input is associated with its puzzle day and shared by all solutions for that day in the current browser tab.
- Each solution links to its Advent of Code 2022 input page; the user must be signed in to view and copy the input.
- Solutions run in the browser and may produce text, 2D, or 3D output.
- Solutions with visualizations can show a small animated preview made from synthetic input; the user's saved puzzle input is never used to generate it.

## Evidence on Hand

The repository contains the solution modules, puzzle input files, and browser display implementations.
