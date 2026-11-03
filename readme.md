# AdventOfCode 2022

| Day    | Problem                   | Link                   | Animation                                                     |
| :----- | :------------------------ | :--------------------- | ------------------------------------------------------------- |
| 01     | Count the calories by elf | [01.ts](01.ts)         |                                                               |
| 02     | Rock, paper, scissors     | [02.ts](02.ts)         |                                                               |
| 09     | Rope Bridge               | [09.ts](09.ts)         | [Web/2D](http://localhost:3000/main.html#module=09)           |
| 10     | Cathode-Ray Tube          | [10.ts](10.ts)         | [Web/2D](http://localhost:3000/main.html#module=10)           |
| 12     | Hill Climbing Algorithm   | [12.ts](12.ts)         | [Web/2D](http://localhost:3000/main.html#module=12)           |
| 14     | Regolith Reservoir        | [14.ts](14.ts)         | [Web/2D (part2)](http://localhost:3000/main.html#module=14)   |
| 17     | Pyroclastic Flow          | [17.1.ts](17.1.ts)     | [Web/2D (part1)](http://localhost:3000/main.html#module=17.1) |
| 18     | Boiling boulders          | [18.ts](18.ts)         | [Web/3D](http://localhost:3000/main.html#module=18)           |
| 22     | Moving around the cube    | [22.ts](22.ts)         | [Web/2D (part2)](http://localhost:3000/main.html#module=22)   |
| 23     | Unstable Diffusion        | [23.ts](23.ts)         | [Web/2D](http://localhost:3000/main.html#module=23)           |
| 24     | Blizzards                 | [24.ts](24.ts)         | [Web/3D](http://localhost:3000/main.html#module=24)           |
| 25     | SNAFU (brute force)       | [25.ts](25.ts)         |                                                               |
| test2D | Test2D                    | [test2D.ts](test2D.ts) | [Web/2D](http://localhost:3000/main.html#module=test2D)       |
| test3D | Test3D                    | [test3D.ts](test3D.ts) | [Web/3D](http://localhost:3000/main.html#module=test3D)       |

### 2D visualization controls

- Mouse: drag to pan; scroll to zoom around the pointer.
- Touch: one finger to pan; pinch to zoom.
- `Space`: pause or resume the simulation.
- `L`: advance one step.

### 3D visualization controls

- Mouse: click the scene to capture the pointer; move to look. Press `Esc` to release it.
- Wheel over the scene: scroll down (wheel back) to widen the field of view; scroll up (wheel forward) to narrow it.
- The `FOV (°)` lil-gui control shows the current angle and lets you adjust it from 25° to 100° (default: 50°).
- The `Debug` > `show axes` toggle is enabled by default to display the coordinate axes.
- `W`/`A`/`S`/`D`: move forward, backward, left, or right while captured; arrow keys work too.
- `R`/`F`: move up or down while captured.
- Movement speed: tap and release `Ctrl` to toggle quarter speed; tap it again for normal speed. Hold `Shift` for double speed, which temporarily overrides slow mode. The active mode appears beside the 3D controls.
- `Space`: pause or resume the simulation.
- `L`: advance one step.
- Touch: gestures are not supported; use a mouse and keyboard.

### Animated solution previews

The solution picker shows short WebP loops for modules with a 2D or 3D visualization. Previews are rendered with synthetic fixtures, not saved puzzle input. Run `npm run previews:generate` to regenerate them; this requires Playwright Chromium and an FFmpeg build that includes the `libwebp_anim` encoder. Set `FFMPEG_PATH` if FFmpeg is not on `PATH`.

The build generates the day and solution rows in `dist/main.html` from `days.ts`; edit the manifest rather than the generated HTML. Build-only scripts live in `build/`, separate from browser runtime code under `utils/`. `npm run dev` watches both the TypeScript build and the generated selector.

Todo
- [x] User / build a menu to select a day
- [x] User / ability to upload own data
- [x] Perfs / 2D: identifier les grandes surfaces pour les dessiner plus vite (QuadTree?)
- [x] Bug / 2D: afficher correctement les caractères même avec de grandes chaînes (setItem{..., content: "très long blabla..."})
- [x] User / ability to pause and go step by step
- [x] User / document the 3D visualization controls in the UI and README
- [x] User / auto follow en 3D (LookAt)
- [x] User / display result when algorithm ends
- [ ] User / ability to zoom correctly from phone (too slow for now)
- [x] Share / créer repo GH
- [ ] Share / publish as a static site on GitHub Pages (no server-side code)
- [ ] Share / make DisplayWeb2D/3D a library
