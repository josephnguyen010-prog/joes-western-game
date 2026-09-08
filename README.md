# Nine Mile Wash

A first-person western built as a single web page. Cimarron County, No Man's Land, April 1889 — no county, no court and no sheriff between here and Texas, which is what the Prine brothers worked out before anybody else.

Everything you see is generated in code at load time. There are no image files, no model files and no audio files in this repository — the town, the terrain, the outlaws, the horses, the wanted posters and every gunshot are built from primitives, canvas drawing and the Web Audio API.

**Play it:** open `index.html` in a browser. Nothing to install.

---

## Controls

| Key | Action |
| --- | --- |
| Mouse | Look and aim |
| Right-drag | Swing the view fast (when the browser won't capture the pointer) |
| W A S D | Walk |
| Shift | Run |
| Space | Jump |
| Left click | Fire |
| R | Reload the Colt, one round at a time through the gate |
| 1 / 2 | Colt / Sharps rifle |
| Z | Look down the scope (Sharps only) |
| F | Up on the wagon seat, or down |
| Q / E, arrows | Turn |
| Esc | Pause menu — resume, full control list, or quit |

### Two aiming modes

Pointer lock is used where the browser allows it: the cursor disappears and the crosshair sits at the centre of the screen. Where it's refused — an iframe without the pointer-lock permission, or Chrome throttling a re-lock straight after Esc — the game falls back to **cursor aim**: the crosshair rides your actual mouse pointer and the shot is cast through that exact pixel, so the two can never disagree. Push the cursor toward an edge to turn. The mode in use is shown under the grit meter.

---

## What's in it

**The town.** Fourteen buildings along four hundred yards of main street, every one of which you can walk into: three saloons, a bank, a hotel, a barber, a livery, a blacksmith, a telegraph office, a doctor, an undertaker, an assay office, a milliner and a general store. Each has its own fitted interior. A church with a bell tower stands at the west end.

**The three saloons are all different.** The Occidental has a long bar down one wall, a mirrored back bar under a longhorn skull, an upright piano and a wagon-wheel chandelier. The Palace is the good room — bar across the back, a green baize faro layout, velvet drapes and gilt frames. The Bullhead is planks laid over barrels, barrel stools, a rack of rifles and straw on the floor.

**People.** Barkeeps working a rag along the counter, a piano player with both hands going, gamblers at the tables, and a priest at the altar with two of his congregation in the pews. Fire a shot within earshot and every one of them gets down and covers their head.

**Guns.** A nickel-plated Colt Single Action Army at life size — 7.5in barrel, 42mm fluted cylinder, open frame window so you can watch the cylinder turn, plow-handle grip, hammer on its own pivot. Six chambers, loaded one at a time. And a Sharps with a brass Malcolm scope, which is the 1870s answer to a sniper rifle: single shot, work the lever between rounds, one hit kills.

**The rifleman.** A man with that Sharps stands on the Occidental roof. He tracks you, and about a second before he fires the brass catches the sun — that glint is your cue to move or get inside. Put him down and his rifle stays up there; take the stairs behind the saloon and it's yours.

**A team and a buckboard.** Two horses in collar harness pulling a plank wagon with iron-tyred spoked wheels. They trot on diagonal pairs, bob their heads with the stride and swish their tails, and the hoofbeats quicken as you push them. You drive from the seat, in first person, with the reins in view.

**The world.** A bowl 176 metres across with cliffs at the edge, a dry wash running east and west across the north, saguaro, prickly pear, barrel cactus, ocotillo and yucca, tumbleweeds built from forty-six dry twigs apiece, a drifting cloud dome and a sun hanging where the light actually comes from.

Thirteen outlaws arrive in three waves. Clear the street.

---

## How it's built

Three.js r128 from a CDN, and about 3,000 lines of plain ES5 JavaScript in one page. No build tooling, no framework, no package manager.

```
index.html          the playable page — everything bundled into one file
src/
  head.html         doctype, meta and the base reset
  00-shell.html     markup, CSS and the three.js <script> tag
  01-world.js       utilities, synthesized audio, canvas textures, terrain,
                    the town and its interiors, doors, props, sky
  02-actors.js      viewmodels, effect pools, outlaws, the rifleman,
                    the wagon and the horse team
  03-game.js        input, shooting, player movement, AI, the game loop, HUD
build.sh            concatenates src/ back into index.html
build.ps1           the same, for PowerShell
```

The three JavaScript files are one IIFE split across three files for readability — `01` opens it and `03` closes it — so they are concatenated rather than loaded as separate scripts. Edit the files in `src/`, run the build script, and `index.html` is regenerated.

```bash
./build.sh          # bash / Git Bash
./build.ps1         # PowerShell
```

### Things worth knowing about the implementation

- **Terrain is one analytic height function** shared by the ground mesh, the player's feet and the wagon's wheels, so they can never disagree. A flat pad is held under the whole townsite because buildings are placed at y = 0.
- **Collision is 2D axis-aligned boxes**, but each box records how tall it is, so once you're standing on a roof the walls below stop pushing you. That's what makes the rooftop work.
- **Doorways are portals** — rectangles where collision is switched off entirely. A doorway therefore cannot be blocked by anything, including geometry added later.
- **Sound is synthesized per shot**: a filtered noise burst with an envelope for the crack, a sine sweep for the thump, and a second quieter burst for the slapback off the false fronts. Distance changes the filter, not just the volume.
- **Polished metal needs something to reflect.** A small sky-and-ground gradient is drawn to a canvas and used as an environment map, without which nickel renders nearly black.

---

## Known limitations

This is a prototype. It's one page with module-level globals rather than a system architecture, the outlaws walk straight at you with no pathfinding, and everything is built from boxes, cylinders and spheres because that's what code can make without an art pipeline. Bringing in real character models and animation is where a project like this would need artists rather than more code.
