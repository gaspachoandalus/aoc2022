# Design system

## Visual direction

The browser entry page is a winter field-survey ledger for Advent of Code solutions. A mineral-green chart surface, fine coordinate grid, and contour lines frame a ruled solution index; deep teal carries the input workspace, orange marks the launch action, and lichen lime marks the selected solution.

## Palette

| Role | Value | Use |
| --- | --- | --- |
| Field | `#e8efec` | Page background |
| Paper | `#f7f8f1` | Solution cells and input surface |
| Ink | `#18373b` | Primary text and input panel |
| Supporting ink | `#405d60` | Secondary copy and placeholders |
| Survey blue | `#2f7183` | Year and solution identifiers |
| Signal orange | `#df603d` | Primary launch action |
| Lichen lime | `#dce96b` | Selected solution and ready state |

## Typography and composition

Use the system sans stack for interface copy and the system monospace stack only for solution IDs and puzzle input. Keep the title prominent, the solution list as a ruled index of day groups rather than generic cards, and the input panel visually distinct from the field surface. Each day group shows its name, solution count/coverage, and one selectable button per module with an explicit part label.

The desktop layout places the solution index beside the input panel. Each day reserves a two-row solution area: part-specific algorithms stack at full width, while a single algorithm spans the full area. At narrower widths, stack the index and input panel and scroll the input panel into view after a solution is selected. The day grid reduces from four to three, two, then one column as space narrows.

## Interaction

Solution selection uses keyboard-operable buttons with pressed state. Part labels distinguish combined solutions from separate or overlapping part-specific algorithms. The input field stays disabled until a solution is selected, and launch remains disabled until non-empty input is present. Narrow layouts bring the input panel into view after selection. Show a link to the selected day's Advent of Code input page, explain that users must copy and paste the input and may need to sign in, and clarify that the same input is shared by both parts and saved in the current browser tab after a run. Saved input is indicated and can be cleared for the whole puzzle day. Keep focus indicators visible and honor reduced-motion preferences.

The day index shows solutions with 2D or 3D animations by default; its show-all control reveals the remaining solutions. Visual solutions can show compact WebP loops using synthetic fixtures, stop animating while offscreen, and switch to a still poster when reduced motion is preferred. The visualization modes retain their own rendering and trace overlay, with a named simulation heading separated from padded, scrollable trace lines. Align the overlay row to the left on wide viewports, place the optional FPS panel to the right of the traces, and keep it hidden by default in both modes. In the 2D lil-gui, group the FPS and quadtree visibility controls under Debug. On compact viewports, move the overlay row above the bottom simulation controls and constrain the lil-gui root to a scrollable panel so it does not cover the trace or FPS content.

Both visualization modes expose mode-specific guidance in a compact, keyboard-accessible disclosure that stays out of the canvas and is omitted from preview captures. Keep 2D guidance bottom-right and 3D guidance bottom-left to clear lil-gui. The 2D guide includes touch gestures; the 3D guide documents pointer-locked mouse look, wheel-driven field-of-view adjustment, keyboard navigation, and its touch limitation. Show the live FOV in the 3D lil-gui, with a default of 50° and a 25°–100° range.

Every 2D simulation sets an initial view: fit bounded content or frame a compact starting region for camera-follow animations. Center once, zooming out only when needed, and preserve manual navigation and explicit camera-follow behavior.

The 3D canvas uses a horizonless studio background in a muted teal gradient rather than a photographic skybox. Keep only a muted grid, anchored once to the initial content bounds and aligned with the world axes; it must not follow the camera. Expand it only when rendered content exceeds its current coverage, keeping the anchor and line spacing unchanged. Omit the large ground plane, fog, and Day 24's white bounding box to reduce rendering cost and visual clutter. Preserve the grid material when puzzle geometry is shown in wireframe. Show the coordinate axes by default, with the Debug toggle available to hide them.
Use matte voxel materials with a soft, low-contrast edge treatment on each exposed cube face to separate neighboring blocks while preserving group colors.
