# 🎴 Card Maker

A browser-based card designer: set a physical card size and DPI, add text and
image components, drag/resize them on a live canvas preview, and export a
print-ready PNG. Templates can be saved in the browser (IndexedDB) or
exported/imported as JSON files.

**Live app:** deployed automatically to GitHub Pages on every push to `main`.

## Development

```bash
npm install
npm run dev        # start the Vite dev server
npm test           # run the unit tests (Vitest)
npm run build      # type-check (tsc) and build to dist/
npm run preview    # serve the production build locally
```

## Architecture

The app is written in strict TypeScript with an object-oriented design:

| Area | Files | Responsibility |
| --- | --- | --- |
| Models | `src/models/` | `Card` (size/DPI/background + unit conversions), abstract `CardComponent` with `TextComponent` / `ImageComponent` subclasses (drawing, bounds, hit-testing, resize, serialization), and `CardDocument` (component list, z-order, selection, template load/save). |
| Rendering | `src/rendering/` | `CardRenderer` draws the document to the canvas; `drawUtils` holds shared drawing helpers. |
| Interaction | `src/interaction/` | `InteractionController` (mouse/keyboard: drag, resize, pan, zoom, selection) and `InlineTextEditor` (double-click text editing). |
| Storage | `src/storage/` | `TemplateStore` wraps IndexedDB for named templates and the autosave slot. |
| UI | `src/ui/` | One class per panel: card settings, background, component list, properties, and the save/load modal. |
| Entry | `src/main.ts` | `CardMakerApp` wires the pieces together. |

Component positions are stored in **inches** so a card re-renders correctly at
any DPI; conversions to canvas pixels go through the `Card` class.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: it installs
dependencies, runs the tests, builds with Vite, and deploys `dist/` to GitHub
Pages. The repository's Pages source must be set to **GitHub Actions**
(Settings → Pages → Build and deployment → Source).
