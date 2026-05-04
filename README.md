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

function DesignEditorPage() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorLayout isBlank />
    </div>
  );
}
```

---

## API Keys & Runtime Configuration

Features like photo search, AI writing, and background removal require external API keys. Because sabi-canvas is a **pre-built npm package**, it cannot read your `.env` file directly — Vite evaluates `import.meta.env` at _your_ project's build time, not the package's.

### How it works

Pass your API keys to `<EditorLayout>` via the `config` prop. Vite resolves `import.meta.env.*` from your project's environment at your build time, and the values are injected into the editor at runtime.

```tsx
import { EditorLayout } from 'sabi-canvas';

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

    openai?:    { apiKey?: string; model?: string };
    gemini?:    { apiKey?: string; model?: string };
    claude?:    { apiKey?: string; model?: string };
    deepseek?:  { apiKey?: string; model?: string };
    grok?:      { apiKey?: string; model?: string };
  };

  /**
   * Optional upload adapter for image uploads (toolbar upload, drag-drop,
   * replace image, background upload).
   *
   * When provided, sabi-canvas sends File objects to this callback and expects
   * a hosted URL in return. When omitted, sabi-canvas falls back to local
   * in-browser processing/data URLs for maximum backward compatibility.
   */
  uploadImageFile?: (
    file: File,
    options?: { maxSize?: number }
  ) => Promise<{
    src: string;
    width?: number;
    height?: number;
  }>;

  /**
   * Optional recent uploads adapter for Upload panel history.
   * Return most-recent items first.
   */
  listRecentUploads?: (
    options?: { limit?: number }
  ) => Promise<Array<{
    id?: string;
    src: string;
    width?: number;
    height?: number;
    createdAt?: string;
  }>>;

  /**
   * Disable localStorage for recent uploads (memory-only list).
   * Useful when your platform policy disallows local persistence.
   */
  disableRecentUploadsLocalStorage?: boolean;
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
| `projectId` | `string` | — | Backend design ID. When set, auto-save calls `onSave` instead of writing to localStorage |
| `initialProject` | `Project` | — | Pre-loaded design data to hydrate the editor (e.g. fetched from your API on open) |
| `onSave` | `(project: Project) => Promise<void>` | — | Called on every auto-save. Receives the full project object. Use to PATCH your backend |
| `externalProjects` | `Project[]` | — | External projects list for the sidebar Projects panel. When provided, replaces localStorage. Pass `[]` while loading |
| `isLoadingProjects` | `boolean` | `false` | Show a loading spinner in the Projects panel while fetching |
| `onDeleteProject` | `(id: string) => Promise<void> \| void` | — | Called when the user confirms deletion from the Projects panel. Remove the item from `externalProjects` in your handler |
| `onRefreshProjects` | `() => void` | — | Called on Projects panel mount and when the user clicks the refresh button |
| `onSelectProject` | `(project: Project) => void` | — | When provided, clicking a project calls this instead of loading it into the current canvas. Use to navigate to another design |
| `hideTitle` | `boolean` | `false` | Hide the project title in the app bar |
| `config.uploadImageFile` | `(file, options?) => Promise<{ src; width?; height?; }>` | — | Optional host upload adapter. Use your own backend/cloud provider and return a hosted image URL |
| `config.listRecentUploads` | `({ limit? }) => Promise<Array<{ src; width?; height?; ... }>>` | — | Optional adapter to load Upload panel history from your backend |
| `config.disableRecentUploadsLocalStorage` | `boolean` | `false` | Disable localStorage for recent uploads and keep the list memory-only |
| `enableJsonDevTools` | `boolean` | `false` | Show JSON inspector panel (dev only) |
| `className` | `string` | — | Extra CSS class on the root element |

---

## Projects Panel — External Data

By default the Projects panel reads from **localStorage**. To replace it with a backend-driven list, pass `externalProjects`:

```tsx
<EditorLayout
  projectId={currentDesignId}
  externalProjects={designs}          // Project[] from your API
  isLoadingProjects={isLoading}
  onRefreshProjects={loadDesigns}     // called on panel mount / refresh button
  onDeleteProject={async (id) => {
    await api.deleteDesign(id);
    await loadDesigns();              // re-fetch or remove from local state
  }}
  onSelectProject={(project) => {
    // navigate to a different design without reloading the page
    openDesign(project.id);
  }}
  onSave={handleSave}
/>
```

When `externalProjects` is provided the panel **never touches localStorage**. When it is omitted the original localStorage behaviour is preserved — so package consumers who don't use a backend are unaffected.

---

## Backend-Powered Image Uploads (Optional)

sabi-canvas is platform-agnostic by default. To route image uploads through your own backend, provide `config.uploadImageFile`.

This adapter is used by:

- Upload panel device uploads
- Replace-image flow
- Drag-and-drop image uploads
- Background image uploads

### Adapter example

```tsx
import { EditorLayout } from 'sabi-canvas';
import axios from 'axios';

const editorConfig = {
  uploadImageFile: async (file: File, options?: { maxSize?: number }) => {
    const formData = new FormData();
    formData.append('file', file);

    // Optional hint to your backend image optimizer
    if (options?.maxSize) {
      formData.append('width', String(options.maxSize));
    }

    const { data } = await axios.post('/api/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return {
      src: data.secure_url ?? data.url,
      width: data.width,
      height: data.height,
    };
  },

  // Optional: load recent uploads from your backend
  listRecentUploads: async ({ limit } = {}) => {
    const { data } = await axios.get('/api/upload/recent', {
      params: { limit: limit ?? 50 },
    });
    return data;
  },

  // Optional: avoid localStorage for recent uploads
  disableRecentUploadsLocalStorage: true,
};

<EditorLayout isBlank config={editorConfig} />
```

Notes:

- If `uploadImageFile` is omitted, sabi-canvas keeps its legacy local fallback behavior.
- The package does not assume Axios, Fetch, Cloudinary, NestJS, or any specific backend.
- Your backend should optimize uploaded images for canvas performance (for example width cap + good-quality compression).

---

## Backend / Cloud Save Integration

`sabi-canvas` supports saving to a backend API instead of (or in addition to) localStorage. Use the `projectId`, `initialProject`, and `onSave` props together.

### How it works

- **`projectId`** — tells the editor which backend record to update. When set, auto-save routes through `onSave` rather than localStorage.
- **`initialProject`** — hydrates the editor with existing design data fetched from your API before opening.
- **`onSave`** — called after each debounced change (1.5 s). Receives a `Project` object containing `pages`, `thumbnail`, `canvasSize`, `activePageId`, `customFonts`, and `isMockupEnabled`.

> **Important**: `onSave` is only called once `projectId` is a non-null string. If `projectId` is not yet set (e.g. while the backend record is being created), auto-save is suppressed to prevent writes with no valid target.

### Example

```tsx
import { useState, useEffect } from 'react';
import { EditorLayout } from 'sabi-canvas';
import type { Project } from 'sabi-canvas';

function DesignEditor({ designId }: { designId: string }) {
  const [initialProject, setInitialProject] = useState<Project | undefined>();

  // 1. Fetch existing design data on mount
  useEffect(() => {
    fetch(`/api/canvas/designs/${designId}`)
      .then((r) => r.json())
      .then((data) => setInitialProject(data)); // map to Project shape if needed
  }, [designId]);

  // 2. Handle auto-save — called every ~1.5 s after a change
  const handleSave = async (project: Project) => {
    await fetch(`/api/canvas/designs/${designId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          project.title,
        thumbnail:      project.thumbnail,
        canvasSize:     project.canvasSize,
        pages:          project.pages,
        activePageId:   project.activePageId,
        customFonts:    project.customFonts,
        isMockupEnabled: project.isMockupEnabled,
      }),
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorLayout
        config={editorConfig}
        projectId={designId}
        initialProject={initialProject}
        onSave={handleSave}
      />
    </div>
  );
}
```

### Opening a template with a backend record

When you want to open a built-in template and immediately persist it to your backend, create the backend record first, then pass both `projectId` and `templateId`:

```tsx
// 1. Create the backend record (empty pages at this point)
const design = await fetch('/api/canvas/designs', { method: 'POST', ... }).then(r => r.json());

// 2. Open editor with both props — template loads visually, auto-save
//    writes to the correct backend record from the first save onward.
<EditorLayout
  config={editorConfig}
  projectId={design._id}
  templateId="house-for-sale"
  onSave={handleSave}
/>
```

> **NestJS / class-transformer note**: If your backend uses `ValidationPipe` with `enableImplicitConversion: true`, the `pages` array elements (plain objects) can be coerced to `[]` by class-transformer's implicit `Array.from()` conversion. Override this in your controller by reading `pages` and `customFonts` directly from `req.body` before the DTO is used:
> ```ts
> if (Array.isArray(req.body?.pages)) dto.pages = req.body.pages;
> if (Array.isArray(req.body?.customFonts)) dto.customFonts = req.body.customFonts;
> ```

### `Project` type reference

```ts
interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;         // base64 JPEG data URL
  pages: ProjectPage[];
  activePageId: string;
  canvasSize: { width: number; height: number };
  customFonts?: CustomFont[];
  isMockupEnabled?: boolean;
}

interface ProjectPage {
  id: string;
  name: string;
  order: number;
  size?: { width: number; height: number };
  objects: CanvasObject[];
  selectedIds: string[];
  background?: Background;
}
```

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
