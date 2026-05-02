# Sabi Canvas

A powerful, open-source canvas design editor framework built with React and Konva. Sabi Canvas gives developers a full-featured graphic design editor — shapes, images, text, fonts, templates, layers, undo/redo, export to PDF/PNG — ready to embed in any React application.

## Features

- **Konva-powered canvas** — high-performance 2D rendering
- **Rich text editing** — multiple fonts, sizes, colors, alignment
- **Image management** — upload, crop, background removal, drag-drop
- **Shape library** — rectangles, circles, polygons, custom SVG shapes
- **Design templates** — pre-built templates with full customization
- **Layer management** — reorder, group, lock, hide layers
- **Undo/Redo** — full history management
- **Export** — PDF and PNG export with configurable DPI
- **Auto-save** — project persistence via localStorage
- **Dark/Light mode** — full theme support
- **AI writing** — AI-powered text assistant (OpenAI, Gemini, Claude, Deepseek, Grok)
- **Photo search** — Unsplash integration
- **Graphics search** — Pixabay transparent illustrations
- **Background removal** — Cloudinary-powered
- **Google Fonts** — dynamic font catalog via Google Fonts API
- **Mobile responsive** — works on desktop and mobile

---

## Installation

```bash
npm install sabi-canvas
```

### Peer Dependencies

```bash
npm install react react-dom react-konva konva framer-motion lucide-react react-router-dom @tanstack/react-query
```

---

## Quick Start

```tsx
import { EditorLayout } from 'sabi-canvas';
import 'sabi-canvas/styles';

function DesignEditorPage() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorLayout isBlank />
    </div>
  );
}
```

---

## CSS Setup

Import the pre-built stylesheet once in the file that renders the editor (not globally, to avoid polluting your app's base styles):

```tsx
// e.g. DesignEditor.tsx or ProductDetail.tsx
import 'sabi-canvas/styles';
```

---

## API Keys & Runtime Configuration

Features like photo search, AI writing, and background removal require external API keys. Because sabi-canvas is a **pre-built npm package**, it cannot read your `.env` file directly — Vite evaluates `import.meta.env` at _your_ project's build time, not the package's.

### How it works

Pass your API keys to `<EditorLayout>` via the `config` prop. Vite resolves `import.meta.env.*` from your project's environment at your build time, and the values are injected into the editor at runtime.

```tsx
import { EditorLayout } from 'sabi-canvas';
import 'sabi-canvas/styles';

const editorConfig = {
  unsplashAccessKey:       import.meta.env.VITE_UNSPLASH_ACCESS_KEY,
  pixabayApiKey:           import.meta.env.VITE_PIXABAY_API_KEY,
  googleFontsApiKey:       import.meta.env.VITE_GOOGLE_FONTS_API_KEY,
  cloudinaryCloudName:     import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  cloudinaryUploadPreset:  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
  ai: {
    provider: import.meta.env.VITE_AI_PROVIDER, // 'openai' | 'gemini' | 'claude' | 'deepseek' | 'grok'
    openai: {
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    },
    gemini: {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY,
    },
  },
};

function DesignEditorPage() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorLayout isBlank config={editorConfig} />
    </div>
  );
}
```

### Alternative: `<SabiCanvasProvider>` wrapper

If you use multiple editor components, or want to configure keys once at the app level, wrap your app (or the relevant subtree) with `SabiCanvasProvider`:

```tsx
import { SabiCanvasProvider } from 'sabi-canvas';

const config = {
  unsplashAccessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY,
  pixabayApiKey:     import.meta.env.VITE_PIXABAY_API_KEY,
  // ...
};

function App() {
  return (
    <SabiCanvasProvider config={config}>
      <Router>
        {/* EditorLayout and EditorModal will automatically pick up the config */}
        <Routes>...</Routes>
      </Router>
    </SabiCanvasProvider>
  );
}
```

### Full config reference

```ts
interface SabiCanvasConfig {
  /** Unsplash API access key — photo search/browse panel */
  unsplashAccessKey?: string;

  /** Pixabay API key — transparent graphics/illustrations panel */
  pixabayApiKey?: string;

  /** Google Fonts API key — enables dynamic full font catalog */
  googleFontsApiKey?: string;

  /** Cloudinary cloud name — background removal feature */
  cloudinaryCloudName?: string;

  /** Cloudinary unsigned upload preset — background removal feature */
  cloudinaryUploadPreset?: string;

  /** AI writing assistant config */
  ai?: {
    /** Active provider: 'openai' | 'gemini' | 'claude' | 'deepseek' | 'grok'. Default: 'openai' */
    provider?: string;

    /** Global model override — used when a provider-specific model is not set */
    model?: string;

    openai?:    { apiKey?: string; model?: string; baseUrl?: string };
    gemini?:    { apiKey?: string; model?: string; baseUrl?: string };
    claude?:    { apiKey?: string; model?: string; baseUrl?: string };
    deepseek?:  { apiKey?: string; model?: string; baseUrl?: string };
    grok?:      { apiKey?: string; model?: string; baseUrl?: string };
  };
}
```

### `.env` variables (recommended naming)

```bash
# Photos
VITE_UNSPLASH_ACCESS_KEY=...

# Graphics
VITE_PIXABAY_API_KEY=...

# Fonts
VITE_GOOGLE_FONTS_API_KEY=...

# Background removal
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...

# AI writing — choose one provider
VITE_AI_PROVIDER=openai          # openai | gemini | claude | deepseek | grok

# OpenAI
VITE_OPENAI_API_KEY=...
VITE_OPENAI_MODEL=gpt-4o-mini    # optional, default: gpt-4o-mini
VITE_OPENAI_BASE_URL=...         # optional, for custom/proxy endpoints

# Google Gemini
VITE_GEMINI_API_KEY=...
VITE_GEMINI_MODEL=...            # optional, default: gemini-2.0-flash

# Anthropic Claude
VITE_ANTHROPIC_API_KEY=...
VITE_ANTHROPIC_MODEL=...         # optional, default: claude-3-5-haiku-latest

# Deepseek
VITE_DEEPSEEK_API_KEY=...
VITE_DEEPSEEK_MODEL=...          # optional, default: deepseek-chat

# Grok
VITE_GROK_API_KEY=...
VITE_GROK_MODEL=...              # optional, default: grok-2-latest
```

> **Note:** All config keys are optional. Features that require a missing key are gracefully disabled (no crash).

---

## EditorLayout Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `config` | `SabiCanvasConfig` | — | Runtime API keys (see above) |
| `isBlank` | `boolean` | `false` | Start with a blank canvas |
| `templateId` | `string` | — | Load a built-in template by ID |
| `hideTitle` | `boolean` | `false` | Hide the project title in the app bar |
| `enableJsonDevTools` | `boolean` | `false` | Show JSON inspector panel (dev only) |
| `className` | `string` | — | Extra CSS class on the root element |

---

## Exported API

```ts
// Layout components
import { EditorLayout, EditorModal } from 'sabi-canvas';

// Config provider (app-level setup)
import { SabiCanvasProvider, useSabiCanvasConfig, getSabiCanvasConfig } from 'sabi-canvas';
import type { SabiCanvasConfig, SabiCanvasAIConfig } from 'sabi-canvas';

// Individual panels (for custom layouts)
import {
  BackgroundPanel, ElementsPanel, LayersPanel,
  MyFontsPanel, PhotosPanel, ProjectsPanel,
  ResizePanel, TemplatesPanel,
} from 'sabi-canvas';

// Contexts & hooks
import {
  EditorProvider, useEditor,
  CanvasObjectsProvider, useCanvasObjects,
  CustomFontsProvider, useCustomFonts,
} from 'sabi-canvas';

// CSS
import 'sabi-canvas/styles';
```

---

## Development

This package lives inside the [sabiprint](https://github.com/seunoyeniyi/sabiprint) monorepo as a standalone sub-package with its own Git repository.

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
