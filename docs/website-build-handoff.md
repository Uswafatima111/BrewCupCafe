# Brew Cup Café — Full Website Handoff

## Goal

Build the complete responsive Brew Cup Café website around the existing café walkthrough. The current frontend is a standalone 3D walkthrough, not a finished website. Keep the walkthrough embeddable and focused in `frontend/src/cafe-walkthrough/`; build the rest of the site around it.

Suggested public-facing areas are a home page, menu, café/interior gallery, walkthrough experience, and visit/contact information. These are a starting proposal, not confirmed business requirements. Do not invent the café’s address, opening hours, phone number, social accounts, delivery links, reservation flow, or online ordering. Ask the owner which of those are needed and use owner-supplied details.

## Repository and branch

- Repository: `https://github.com/Uswafatima111/BrewCupCafe.git`
- Working branch: `feature/cafe-3d-interior`
- Café brand in the supplied assets: **Brew Cup Café**
- Currency used by the current menu data: **INR**

The current design direction is warm and café-led. Use the supplied logo, photographs, 3D scene, and menu as the source of truth for the look and content.

## Prerequisites and local setup

- Node.js `^20.19.0` or `>=22.12.0` (required by the installed Vite version)
- npm
- Git access to the repository
- A current browser with WebGL support for the 3D walkthrough

```sh
git clone https://github.com/Uswafatima111/BrewCupCafe.git
cd BrewCupCafe
git switch --track origin/feature/cafe-3d-interior
cd frontend
npm install
npm run dev
```

The current app uses Vite 8.3.8, vanilla JavaScript, Three.js 0.187.0, and `three-mesh-bvh` 0.9.18. ESLint 10.15.0 is configured. There is no React, Vue, or other UI framework in this frontend. Build and lint with:

```sh
npm run build
npm run lint
```

## Existing frontend entry points

- `frontend/index.html` is only the local walkthrough mount for development.
- `frontend/src/cafe-walkthrough/walkthrough.js` exports `mountCafeWalkthrough(containerElement)`. Import and mount it in a future website experience section; do not turn this module into the entire website shell.
- `frontend/src/cafe-walkthrough/walkthrough.css` contains the walkthrough’s page reset.
- `frontend/public/menu.json` is the menu data source. Each `model` URL starts with `/models/`.
- `frontend/public/camera_path.json` supplies exact positions and look targets for the tour. Keep coordinates sourced from this file; the supplied mezzanine viewpoint is ground level.

The walkthrough loads only `brew-cup-cafe.glb`. Dish models are separate menu assets and are not loaded into the walkthrough.

## 3D model inventory

All listed models live in `frontend/public/models/`:

| File | Menu item | Category | Price |
| --- | --- | --- | ---: |
| `alfredo_pasta.glb` | Alfredo Pasta | pasta | ₹300 |
| `almond_praline_strawberry_dark_chocolate_cake.glb` | Almond Praline & Strawberry Dark Chocolate Cake | cake | ₹400 |
| `brew-cup-cafe.glb` | Café interior walkthrough scene | scene | — |
| `chicken_overload_pizza.glb` | Chicken Overload Pizza | pizza | ₹400 |
| `iced_cafe_mocha.glb` | Iced Cafe Mocha | coffee | ₹179 |
| `iced_french_vanilla_latte.glb` | Iced French Vanilla Latte | coffee | ₹179 |
| `london_viral_cake.glb` | London Viral Cake | cake | ₹350 |
| `nutella_bomboloni.glb` | Nutella Bomboloni | dessert | ₹130 |
| `spanish_latte.glb` | Spanish Latte | coffee | ₹199 |

Prices and labels above reflect the current menu file. Update menu content only with owner confirmation. To add a dish, add its GLB under `frontend/public/models/` and a matching entry in `frontend/public/menu.json` with `model: "/models/<id>.glb"`.

## Photography and visual assets

Existing images are in `brew-cup-assets/` at the repository root:

- Brand: `logo.jpg`
- Exterior: `facade_day.jpg`, `facade_night.jpg`
- Interior: `interior_counter.jpg`, `interior_from_mezzanine.jpg`, `interior_mural_seating.jpg`, `interior_vaulted_roof.jpg`, `mural.jpg`
- Drinks: `coffee_latte_art.jpg`, `drink_pink_slush.jpg`, `drink_shakes.jpg`
- Food: `food_chicken_toast.jpg`, `food_crispy_chicken.jpg`, `food_pasta_creamy.jpg`, `food_pasta_red.jpg`
- Pool: `pool_mosaic.png`, `pool_night.jpg`

Use the images as supplied; avoid making factual claims about ingredients, dietary needs, awards, or provenance that are not provided by the owner.

## Source assets and ownership boundaries

- `brew-cup-cafe.blend` is the editable Blender source scene.
- `brew-cup-cafe.glb` at the repository root is the source export. The frontend copy is `frontend/public/models/brew-cup-cafe.glb`.
- `brew_cup_cafe_blender.py` is the existing Blender script. Do not run or change it as part of website work without the scene owner’s approval.
- `camera_path.json` at the root is the coordinate source; the frontend public copy is loaded by the app.
- `.gitattributes` marks `.glb`, `.blend`, `.png`, and `.jpg` as binary. Git LFS is not used.

Frontend owns the website and embeds the 3D assets. The 3D owner maintains source models and tour coordinates. The asset inventory should remain separate from generated site output.

## Open decisions for the owner

Before finalizing a full website, confirm:

1. Which pages and customer actions are required (visit only, reservations, ordering, delivery, or something else)?
2. The official address, opening hours, contact details, social links, and map pin.
3. Whether the existing INR menu and prices are current and complete.
4. The preferred deployment host, domain, and who owns deployment access.
5. Whether the site needs a backend, content editor, analytics, or payment integration.
