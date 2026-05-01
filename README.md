# Sabi Canvas
Hello from sabiprint2

A powerful, open-source canvas design editor framework built with React and Konva. Sabi Canvas gives developers a full-featured graphic design editor — shapes, images, text, fonts, templates, layers, undo/redo, export to PDF/PNG — ready to embed in any React application.

## Features

- **Konva-powered canvas** — high-performance 2D rendering
- **Rich text editing** — multiple fonts, sizes, colors, alignment
- **Image management** — upload, crop, background removal (AI), drag-drop
- **Shape library** — rectangles, circles, polygons, custom SVG shapes
- **Design templates** — pre-built templates with full customization
- **Layer management** — reorder, group, lock, hide layers
- **Undo/Redo** — full history management
- **Export** — PDF and PNG export with configurable DPI
- **Auto-save** — project persistence via localStorage
- **Dark/Light mode** — full theme support
- **AI features** — AI text writing, background removal
- **Mobile responsive** — works on desktop and mobile

## Installation

```bash
npm install sabi-canvas
```

### Peer Dependencies

```bash
npm install react react-dom react-konva konva framer-motion lucide-react react-router-dom @tanstack/react-query
```

## Quick Start

```tsx
import { EditorLayout } from 'sabi-canvas';
import 'sabi-canvas/styles'; // Import CSS

function DesignEditorPage() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorLayout isBlank />
    </div>
  );
}
```

## CSS Setup

### Option A — Import pre-built CSS (recommended)
```tsx
// In your app's entry point (e.g., main.tsx)
import 'sabi-canvas/styles';
```

### Option B — Tailwind CSS scanning
If your project uses Tailwind, add sabi-canvas source to your `tailwind.config.ts` content:
```ts
content: [
  './src/**/*.{ts,tsx}',
  './node_modules/sabi-canvas/src/**/*.{ts,tsx}',
]
```

## Usage

### Basic Editor

```tsx
import { EditorLayout } from 'sabi-canvas';

<EditorLayout
  isBlank            // Start with blank canvas
  templateId="..."   // Or load a template
/>
```

### With Contexts (advanced)

```tsx
import {
  EditorProvider,
  CanvasObjectsProvider,
  CustomFontsProvider,
  useEditor,
  useCanvasObjects,
} from 'sabi-canvas';
```

## AI Features Configuration

The editor supports AI-powered text writing and background removal. Configure your API keys via environment variables:

```bash
VITE_AI_API_KEY=your_key_here
VITE_REMOVE_BG_API_KEY=your_key_here
VITE_PIXABAY_API_KEY=your_key_here
```

## Development

This package lives as a Git submodule inside [sabiprint](https://github.com/seunoyeniyi/sabiprint).

```bash
# Clone with submodule
git clone --recurse-submodules https://github.com/seunoyeniyi/sabiprint.git

# Update submodule to latest
git submodule update --remote sabi_canvas

# Build the library
cd sabi_canvas
npm install
npm run build
```

## Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
