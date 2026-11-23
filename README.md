# Brew Cup Café

Brew Cup Café is a capstone project for an interactive café website. The current frontend is a small Vite and Three.js application where visitors can walk through the supplied café interior, look around, and follow the camera path. Food models remain separate assets for the menu and are not loaded into the walkthrough.

## Project map

| Path | Contents | Owner |
| --- | --- | --- |
| `frontend/` | Vite app, walkthrough module, menu data, and browser assets | Frontend owner |
| `frontend/src/cafe-walkthrough/` | Embeddable café viewer and its interaction styles | Frontend owner |
| `frontend/public/models/` | Café interior and individual dish GLB files | 3D asset owner; frontend consumes them |
| `brew-cup-assets/` | Existing café photography and image assets | Visual asset owner |
| `brew-cup-cafe.blend` and `brew-cup-cafe.glb` | Source scene and exported café model | Blender/3D owner |
| `brew_cup_cafe_blender.py` | Existing Blender automation script | Blender/automation owner |
| `blender/` | Blender workflow notes | Blender/3D owner |
| `automation/` | Automation workflow notes | Automation owner |
| `docs/` | Project and implementation documentation | Project maintainers |
| `camera_path.json` | Camera positions and look targets for the café tour | 3D owner provides coordinates; frontend consumes them |

## Run the walkthrough

From `frontend/`, install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

The app uses keyboard or joystick movement, mouse or touch look, and the supplied camera path for its optional tour. To produce a production build or run lint:

```sh
npm run build
npm run lint
```

The viewer is exported as `mountCafeWalkthrough(containerElement)` from `frontend/src/cafe-walkthrough/walkthrough.js`, so another frontend can mount it into a container.

## Add a dish

1. Put the dish GLB in `frontend/public/models/` and name it with its stable menu id, such as `spanish_latte.glb`.
2. Add one entry to `frontend/public/menu.json` with a unique `id`, display `name`, `price`, `currency`, and `category`.
3. Set `model` to `/models/<id>.glb` and verify the named file exists. Keep dish models separate from the café walkthrough.

Do not rename the café source files or run Blender export automation as part of ordinary menu updates.

## Asset and ownership notes

- The frontend owner maintains `frontend/`, its menu schema, viewer controls, and loading behavior.
- The Blender/3D owner maintains the café source scene, exported café model, dish models, and camera coordinates.
- The automation owner maintains automation workflows and the existing Blender script.
- Project maintainers own shared documentation and repository conventions.

The root `.gitattributes` marks the project’s GLB, Blender, PNG, and JPG files as binary. Git LFS is not used.
