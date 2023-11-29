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

Assets references
skybox interstellar: https://opengameart.org/content/interstellar-skybox
skybox sunny day: https://opengameart.org/content/sky-box-sunny-day

Todo
- [ ] User / build a menu to select a day
- [x] Perfs / 2D: identifier les grandes surfaces pour les dessiner plus vite (QuadTree?)
- [x] Bug / 2D: afficher correctement les caractères même avec de grandes chaînes (setItem{..., content: "très long blabla..."})
- [x] User / ability to pause and go step by step
- [ ] User / explain keys/mouse controls to the user
- [ ] User / auto follow en 3D (ScrollIntoView 3D)
- [x] User / display result when algorithm ends
- [ ] User / ability to zoom correctly from phone (too slow for now)
- [ ] Share / créer repo GH
- [ ] Share / build+deploy site on GH
- [ ] Share / make DisplayWeb2D/3D a library
- [ ] Share / animate all tests ?
