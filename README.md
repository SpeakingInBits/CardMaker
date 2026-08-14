# 🎴 Card Maker

A browser-based deck designer: set a physical card size and DPI, design
multiple cards per deck — each with a front and a back face — using text and
image components on a live canvas preview. Export individual faces as PNG, or
generate a print-sheet PDF that tiles every card (× its copy count) on
Letter/A4 pages with mirrored backs pages for aligned double-sided printing.
Decks can be saved in the browser (IndexedDB) or exported/imported as JSON.

Editor features: session undo/redo (Ctrl+Z / Ctrl+Y), arrow-key nudging
(Shift for coarse steps), snap-to-center/edge alignment guides while dragging
(Ctrl disables), view zoom controls, autosave, and an unsaved-changes guard.

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
| Models | `src/models/` | `Deck` (size/DPI + unit conversions), `DeckCard` (name, copies, faces), `CardFace` (background + components), abstract `CardComponent` with `TextComponent` / `ImageComponent` subclasses (drawing, bounds, hit-testing, resize, serialization), and `CardDocument` (cards, active face, selection, template load/save with legacy-v2 migration). |
| Rendering | `src/rendering/` | `CardRenderer` draws the active face plus selection and alignment guides; `faceRenderer` renders any face (shared with print export); `drawUtils` holds shared drawing helpers. |
| Interaction | `src/interaction/` | `InteractionController` (mouse/keyboard: drag with snapping, resize, pan, zoom, nudge, undo/redo shortcuts), `snapping` (pure snap math), and `InlineTextEditor` (double-click text editing). |
| History | `src/history/` | `HistoryManager` — session undo/redo over serialized snapshots. |
| Export | `src/export/` | `printLayout` (pure page-layout math incl. duplex mirroring) and `PrintSheetExporter` (jsPDF, lazy-loaded). |
| Storage | `src/storage/` | `TemplateStore` wraps IndexedDB for named decks and the autosave slot. |
| UI | `src/ui/` | One class per panel: card settings, card list, background, component list, properties, save/load modal, print dialog, toasts, viewport zoom. |
| Entry | `src/main.ts` | `CardMakerApp` wires the pieces together. |

Component positions are stored in **inches** so a card re-renders correctly at
any DPI; conversions to canvas pixels go through the `Card` class.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: it installs
dependencies, runs the tests, builds with Vite, and deploys `dist/` to GitHub
Pages. The repository's Pages source must be set to **GitHub Actions**
(Settings → Pages → Build and deployment → Source).
