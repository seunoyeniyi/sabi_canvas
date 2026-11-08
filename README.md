# Sabi Canvas

A powerful, open-source canvas design editor framework built with React and Konva. Sabi Canvas gives developers a full-featured graphic design editor , shapes, images, text, fonts, templates, layers, undo/redo, export to PDF/PNG , ready to embed in any React application.

## Features

- **Konva-powered canvas** , high-performance 2D rendering
- **Rich text editing** , multiple fonts, sizes, colors, alignment
- **Image management** , upload, crop, background removal, drag-drop
- **Shape library** , rectangles, circles, polygons, custom SVG shapes
- **Design templates** , the free Sabi Canvas templates library out of the box, with live filters; plug in your own templates API or panel
- **Layer management** , reorder, group, lock, hide layers
- **Undo/Redo** , full history management
- **Export** , PDF and PNG export with configurable DPI
- **Auto-save** , project persistence via localStorage
- **Dark/Light mode** , full theme support
- **AI writing** , AI-powered text assistant (OpenAI, Gemini, Claude, Deepseek, Grok)
- **Photo search** , Unsplash integration
- **Graphics search** , Pixabay transparent illustrations
- **Background removal** , Cloudinary-powered
- **Google Fonts** , dynamic font catalog via Google Fonts API
- **Mobile responsive** , works on desktop and mobile

---

## Installation

```bash
npm install sabi-canvas
```

### Peer Dependencies

```bash
npm install react react-dom konva@10.9.1 react-konva@19.2.7 framer-motion lucide-react react-router-dom @tanstack/react-query
```

Use the same `konva` / `react-konva` versions as the other apps that embed the editor, so every app renders and
exports designs identically. `react-konva` 19.2.x needs React 19.2; `react-konva` 19.3+ needs React 19.3 or later.

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

Features like photo search, AI writing, and background removal require external API keys. Because sabi-canvas is a **pre-built npm package**, it cannot read your `.env` file directly , Vite evaluates `import.meta.env` at _your_ project's build time, not the package's.

### How it works

Pass your API keys to `<EditorLayout>` via the `config` prop. Vite resolves `import.meta.env.*` from your project's environment at your build time, and the values are injected into the editor at runtime.

```tsx
import { EditorLayout } from 'sabi-canvas';

const editorConfig = {
  sabiCanvasApiKey:        import.meta.env.VITE_SABI_CANVAS_API_KEY, // optional: unlocks paid templates
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
        {/* EditorLayout will automatically pick up the config */}
        <Routes>...</Routes>
      </Router>
    </SabiCanvasProvider>
  );
}
```

### Backend Proxy / API Gateway (Recommended for Production)

To protect your 3rd-party API keys (Unsplash, Pixabay, Gemini, etc.) and avoid exposing them in public browser bundles, you can route requests through your own backend API gateway using the `proxy` config:

```tsx
import { EditorLayout } from 'sabi-canvas';

const editorConfig = {
  // Route Unsplash, Pixabay, and AI through your backend proxy
  proxy: {
    baseUrl: 'https://api.yourdomain.com/api/canvas/proxy',
    // Or specify individual custom endpoints:
    // unsplashUrl:    'https://api.yourdomain.com/api/canvas/proxy/unsplash/photos',
    // pixabayUrl:     'https://api.yourdomain.com/api/canvas/proxy/pixabay',
    // aiUrl:               'https://api.yourdomain.com/api/canvas/proxy/ai/generate-text',
    // googleFontsUrl:      'https://api.yourdomain.com/api/canvas/proxy/google-fonts',
    // removeBackgroundUrl: 'https://api.yourdomain.com/api/canvas/proxy/remove-background',
  },
};
```

When `proxy` is provided, the editor routes requests to your backend endpoints instead of calling 3rd-party APIs directly. If direct keys (`unsplashAccessKey`, `pixabayApiKey`, `googleFontsApiKey`, `cloudinaryCloudName/uploadPreset`, `ai.*.apiKey`) are also provided, they serve as fallback. If neither is provided, `sabi-canvas` gracefully falls back to its built-in offline font catalog and local file handling.

#### Backend Proxy Contract (Framework-Agnostic)

You can build these 5 simple endpoints in any backend language or framework (Node.js/Express, Next.js API routes, FastAPI, Laravel, Go, Ruby, etc.):

| Endpoint | Method | Query / Body | Expected Response |
|---|---|---|---|
| `/unsplash/photos` | `GET` | `?query=...&page=1&per_page=20` | JSON array of Unsplash image objects (`[{ urls: { small, regular } }]`) |
| `/pixabay` | `GET` | `?q=...&page=1&per_page=20&image_type=illustration` | JSON `{ hits: [{ webformatURL, largeImageURL }], totalHits }` |
| `/google-fonts` | `GET` | `?sort=popularity` | JSON `{ items: [{ family, category, variants }] }` |
| `/remove-background` | `POST` | `{ image: "https://... or base64" }` | JSON `{ resultUrl: "https://..." }` |
| `/ai/generate-text` | `POST` | `{ prompt, provider?, model? }` | JSON `{ text: "Generated copy...", provider?, model? }` |

### Full config reference

```ts
interface SabiCanvasConfig {
  /**
   * Backend proxy configuration to route Unsplash, Pixabay, Google Fonts, background removal, and AI requests
   * through your server, keeping secret API keys hidden from client browsers.
   */
  proxy?: {
    baseUrl?: string;
    unsplashUrl?: string;
    pixabayUrl?: string;
    aiUrl?: string;
    googleFontsUrl?: string;
    removeBackgroundUrl?: string;
  };

  /**
   * Sabi Canvas API key (cpk_…) , optional. Without it every template is listed and the free ones open;
   * with it, the paid templates your plan includes open too. Ignored when `templates.source` is set.
   */
  sabiCanvasApiKey?: string;

  /** Unsplash API access key , photo search/browse panel (fallback if no proxy configured) */
  unsplashAccessKey?: string;

  /** Pixabay API key , transparent graphics/illustrations panel (fallback if no proxy configured) */
  pixabayApiKey?: string;

  /** Google Fonts API key , enables dynamic full font catalog (fallback if no proxy configured) */
  googleFontsApiKey?: string;

  /** Cloudinary cloud name , background removal feature */
  cloudinaryCloudName?: string;

  /** Cloudinary unsigned upload preset , background removal feature */
  cloudinaryUploadPreset?: string;

  /** AI writing assistant config */
  ai?: {
    /** Active provider: 'openai' | 'gemini' | 'claude' | 'deepseek' | 'grok'. Default: 'openai' */
    provider?: string;

    /** Global model override , used when a provider-specific model is not set */
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

  /**
   * Templates panel. Defaults to the free Sabi Canvas templates API (no key,
   * no env). See "Templates" below.
   */
  templates?: {
    source?: TemplateSource;                                // where templates and filters come from
    panel?: React.ComponentType<{ onClose: () => void }>;    // replaces the whole panel
    pageSize?: number;                                      // templates per request, default 20
    onLockedTemplate?: (template: TemplateSummary, error: unknown) => void; // a locked template was refused
    onTemplateApplied?: (design: TemplateDesign) => void;   // after a template lands on the canvas
  };
}
```

### `.env` variables (recommended naming)

```bash
# Templates (optional: the free templates work without it)
VITE_SABI_CANVAS_API_KEY=cpk_...

# Photos
VITE_UNSPLASH_ACCESS_KEY=...

# Graphics
VITE_PIXABAY_API_KEY=...

# Fonts
VITE_GOOGLE_FONTS_API_KEY=...

# Background removal
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...

# AI writing , choose one provider
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
| `config` | `SabiCanvasConfig` | , | Runtime API keys (see above) |
| `isBlank` | `boolean` | `false` | Start with a blank canvas |
| `templateId` | `string` | , | Open a template by its id (or slug, on the Sabi Canvas API), fetched from the template source |
| `projectId` | `string` | , | Backend design ID. When set, auto-save calls `onSave` instead of writing to localStorage |
| `initialProject` | `Project` | , | Pre-loaded design data to hydrate the editor (e.g. fetched from your API on open) |
| `onSave` | `(project: Project) => Promise<void>` | , | Called on every auto-save. Receives the full project object. Use to PATCH your backend |
| `externalProjects` | `Project[]` | , | External projects list for the sidebar Projects panel. When provided, replaces localStorage. Pass `[]` while loading |
| `isLoadingProjects` | `boolean` | `false` | Show a loading spinner in the Projects panel while fetching |
| `onDeleteProject` | `(id: string) => Promise<void> \| void` | , | Called when the user confirms deletion from the Projects panel. Remove the item from `externalProjects` in your handler |
| `onRefreshProjects` | `() => void` | , | Called on Projects panel mount and when the user clicks the refresh button |
| `onSelectProject` | `(project: Project) => void` | , | When provided, clicking a project calls this instead of loading it into the current canvas. Use to navigate to another design |
| `hideTitle` | `boolean` | `false` | Hide the project title in the app bar |
| `config.uploadImageFile` | `(file, options?) => Promise<{ src; width?; height?; }>` | , | Optional host upload adapter. Use your own backend/cloud provider and return a hosted image URL |
| `config.uploadFontFile` | `(file) => Promise<{ src; publicId?; }>` | , | Optional host font upload adapter. Return a hosted URL and optional backend file id |
| `config.deleteFontFile` | `({ src?, publicId? }) => Promise<void>` | , | Optional host font delete adapter. Called when a custom font is deleted |
| `config.listRecentUploads` | `({ limit? }) => Promise<Array<{ src; width?; height?; ... }>>` | , | Optional adapter to load Upload panel history from your backend |
| `config.deleteRecentUpload` | `(upload) => Promise<void>` | , | Optional adapter used by the drawer Uploads panel to delete a backend upload by metadata (e.g. publicId/resourceType) |
| `config.disableRecentUploadsLocalStorage` | `boolean` | `false` | Disable localStorage for recent uploads and keep the list memory-only |
| `config.disableCustomFontsLocalStorage` | `boolean` | `false` | Disable localStorage for custom fonts state in sabi_canvas |
| `config.disableRecentFontsLocalStorage` | `boolean` | `false` | Disable localStorage for recent font picks in FontFamilyPicker |
| `config.sabiCanvasApiKey` | `string` | , | Optional Sabi Canvas API key. Paid templates your plan includes open too. See [Templates](#templates) |
| `config.templates.source` | `TemplateSource` | Sabi Canvas API | Where the Templates panel and `templateId` get templates, filters and designs. See [Templates](#templates) |
| `config.templates.panel` | `ComponentType<{ onClose }>` | , | Replaces the Templates panel with your own component |
| `config.templates.pageSize` | `number` | `20` | Templates per request |
| `config.templates.onLockedTemplate` | `(template, error) => void` | , | Called when a locked template (`hasAccess: false`) is refused, e.g. to offer an upgrade. Without it, a dialog says which plan it needs |
| `config.templates.onTemplateApplied` | `(design) => void` | , | Called after a template is applied to the canvas |
| `saveAction` | `AppBarSaveAction` | , | Optional custom action button rendered in the app bar before the Download button. Useful for "Save", "Publish", or any app-specific primary action. See below. |
| `enableJsonDevTools` | `boolean` | `false` | Show JSON inspector panel (dev only) |
| `className` | `string` | , | Extra CSS class on the root element |

---

## Templates

The Templates panel lists the **Sabi Canvas templates** by default, free and paid. Listing, filters and free designs are
public: there's no key, account or environment variable to set. Paid templates show with a lock (and the plan, e.g.
`Pro`); picking one asks the API, which refuses it unless your key's plan includes it. The API is documented at
[sabicanvas.sabiflow.shop/developers](https://sabicanvas.sabiflow.shop/developers).

### Paid templates: add your Sabi Canvas API key

Make a key in your account on [sabicanvas.sabiflow.shop](https://sabicanvas.sabiflow.shop) (Account → API) and pass it as
`sabiCanvasApiKey`. Nothing else changes: the editor keeps using the Sabi Canvas API, and the designs your plan includes
open. Upgrade your plan and the same key opens more templates straight away.

```tsx
<EditorLayout config={{ sabiCanvasApiKey: import.meta.env.VITE_SABI_CANVAS_API_KEY }} />
```

The key is sent from the browser in the `x-api-key` header, so anyone using your app can see it, and requests made with
it count toward your monthly limit. It can only read templates; revoke it in your account if it's misused. A key that
isn't valid stops the panel loading, and the panel shows the API's reason.

Nothing in the panel is hardcoded. It shows what the template source returns:

- **Search** goes to the source as `search`.
- **Filters** come from the source's `filters()` reply. Every group, and the sort orders, are under the Filters button;
  the first single-choice group (categories, on the Sabi Canvas API) is also offered as chips. Each option can carry a
  live `count`. No group is ever hidden: the panel also asks for the filters with nothing chosen, and keeps every group
  and option from that full set on screen, even when the current choices leave them finding nothing (count 0).
- **Page size** is chosen to start with: the panel opens filtered to the page's size (it counts on the Filters button) and
  follows the page if it's resized, until someone picks another size or "Any size". Not in customer mode, where
  templates are scaled into the print area. Sources opt in with `pageSizeFilter`.
- **Paging** follows the source's `hasMore`; the next page loads as the list scrolls.

Picking a template replaces what's on the active page with the design's first page, including its size and background
(undo brings the old objects back), and adds any further pages after it. In customer mode with a print area, the design is scaled into the print area instead.

### The default source

```tsx
import { EditorLayout, createSabiCanvasTemplateSource } from 'sabi-canvas';

// Nothing to configure: this is what the editor uses already.
<EditorLayout isBlank />

// Only to show another Canvas Pro business's templates instead:
const source = createSabiCanvasTemplateSource({
  baseUrl: 'https://api.sabiflow.com/api/canvas-pro/api/v1/<business-slug>',
  apiKey: 'cpk_...', // optional, a key from that business's website
});

<EditorLayout config={{ templates: { source } }} />
```

### Your own templates API

Implement `TemplateSource` and pass it as `config.templates.source`. The filters your backend returns are the filters
the panel shows; whatever is chosen comes back to `list()` and `filters()` as `state.filters`, keyed by group `key`.

```tsx
import type { TemplateSource } from 'sabi-canvas';

const myTemplates: TemplateSource = {
  // Names this source in the editor's cache. Make it unique per set of templates.
  id: `my-api:${workspaceId}`,

  async list({ page, limit, search, filters, sort }, { signal } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
    Object.entries(filters).forEach(([key, values]) => values.length && params.set(key, values.join(',')));
    if (sort) params.set('sort', sort);
    const res = await fetch(`/api/templates?${params}`, { signal }).then((r) => r.json());
    return {
      items: res.data.map((t) => ({ id: t.id, name: t.name, thumbnail: t.thumb, width: t.w, height: t.h })),
      hasMore: res.page < res.totalPages,
      total: res.total,
    };
  },

  // Optional. Leave it out to offer search only.
  async filters({ search, filters }, { signal } = {}) {
    return fetch(`/api/templates/filters?...`, { signal }).then((r) => r.json());
    // → {
    //     groups: [
    //       { key: 'category', label: 'Categories', type: 'single', allLabel: 'All templates',
    //         options: [{ value: 'instagram', label: 'Instagram', count: 5 }] },
    //       { key: 'tags', label: 'Topics', type: 'multi', options: [{ value: 'promo', label: 'promo', count: 2 }] },
    //     ],
    //     sort: { default: 'popular', options: [{ value: 'popular', label: 'Most popular' }, { value: 'newest', label: 'Newest' }] },
    //   }
  },

  // Optional. Start the panel filtered to the page's size: the group key and the value for a size.
  pageSizeFilter: ({ width, height }) => ({ key: 'size', value: `${width}x${height}` }),

  // The design to apply, by the id from list() or the editor's templateId prop.
  async getDesign(id, { signal } = {}) {
    const t = await fetch(`/api/templates/${id}`, { signal }).then((r) => r.json());
    return {
      id: t.id, name: t.name, width: t.w, height: t.h,
      content: {
        // Each page: { size: { width, height }, objects: CanvasObject[], background?, name? }
        pages: t.pages,
        customFonts: t.customFonts, // optional, uploaded fonts the design uses
      },
    };
  },
};

<EditorLayout config={{ templates: { source: myTemplates } }} />
```

Templates you return with `hasAccess: false` show a lock (and `badge`, e.g. `Pro`). Picking one still calls
`getDesign`, so your backend decides. If it throws, `config.templates.onLockedTemplate(template, error)` is called, so you
can offer an upgrade or sign-in; without it, a dialog says which plan the template needs. Give your errors a numeric
`status` (as `SabiCanvasApiError` does) so a refusal (4xx) isn't mistaken for a network failure.

### Your own panel

Pass any component as `config.templates.panel`. It renders inside the editor, so the same hooks the built-in panel uses
are available:

```tsx
import {
  useTemplateList, useTemplateFilters, useTemplateDesignLoader, useApplyTemplate,
  type TemplatesPanelProps,
} from 'sabi-canvas';

function MyTemplatesPanel({ onClose }: TemplatesPanelProps) {
  const [state, setState] = useState({ search: '', filters: {} });
  const { data } = useTemplateList(state);        // TanStack infinite query over config.templates.source
  const { data: filters } = useTemplateFilters(state);
  const loadDesign = useTemplateDesignLoader();    // cached fetch of a design
  const applyTemplate = useApplyTemplate();        // puts a design on the canvas

  const pick = async (id: string) => {
    const result = applyTemplate(await loadDesign(id));
    if (result.success) onClose();
  };
  // ...render your own UI
}

<EditorLayout config={{ templates: { panel: MyTemplatesPanel } }} />
```

The panel and the hooks use TanStack Query. If your app has a `QueryClientProvider`, the editor uses its client;
otherwise `<EditorLayout>` provides its own.

---

## App Bar Custom Action (`saveAction`)

The `saveAction` prop lets you inject a custom button into the editor app bar , immediately before the Download button , without modifying the package. Use it for app-level actions like "Save", "Publish", or "Submit for Review".

### `AppBarSaveAction` type

```ts
interface AppBarSaveAction {
  /** Button label text. */
  label: string;
  /** Called when the button is clicked. */
  onClick: () => void;
  /** Optional icon element (e.g. a Lucide icon). Rendered before the label. */
  icon?: React.ReactNode;
  /** Disable the button (e.g. while a save is in progress). */
  disabled?: boolean;
  /**
   * shadcn/ui button variant.
   * Default: 'outline'
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Extra CSS class applied to the button. */
  className?: string;
}
```

### Example , dynamic Save / Publish button

```tsx
import { Save } from 'lucide-react';
import { EditorLayout } from 'sabi-canvas';
import type { AppBarSaveAction } from 'sabi-canvas';

function DesignEditor({ design, onPublish, onSave }) {
  const saveAction: AppBarSaveAction = {
    label: design.status === 'published' ? 'Save' : 'Publish',
    icon: <Save className="h-3.5 w-3.5" />,
    onClick: () => {
      if (design.status === 'published') {
        onSave();
      } else {
        onPublish();
      }
    },
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorLayout
        projectId={design._id}
        initialProject={design.project}
        onSave={handleAutoSave}
        saveAction={saveAction}
      />
    </div>
  );
}
```

The button is also rendered in the mobile toolbar with the icon visible and the label hidden (screen-reader accessible via `sr-only`). No configuration required.

---

## Projects Panel , External Data

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

When `externalProjects` is provided the panel **never touches localStorage**. When it is omitted the original localStorage behaviour is preserved , so package consumers who don't use a backend are unaffected.

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

- **`projectId`** , tells the editor which backend record to update. When set, auto-save routes through `onSave` rather than localStorage.
- **`initialProject`** , hydrates the editor with existing design data fetched from your API before opening.
- **`onSave`** , called after each debounced change (1.5 s). Receives a `Project` object containing `pages`, `thumbnail`, `canvasSize`, `activePageId`, `customFonts`, and `isMockupEnabled`.

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

  // 2. Handle auto-save , called every ~1.5 s after a change
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

When you want to open a template and immediately persist it to your backend, create the backend record first, then pass both `projectId` and `templateId` (an id from your template source; the Sabi Canvas API also takes the template's slug):

```tsx
// 1. Create the backend record (empty pages at this point)
const design = await fetch('/api/canvas/designs', { method: 'POST', ... }).then(r => r.json());

// 2. Open editor with both props , the template's design is fetched and loaded,
//    and auto-save writes to the correct backend record from the first save onward.
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
// Layout component
import { EditorLayout } from 'sabi-canvas';

// Config provider (app-level setup)
import { SabiCanvasProvider, useSabiCanvasConfig, getSabiCanvasConfig } from 'sabi-canvas';
import type { SabiCanvasConfig, SabiCanvasAIConfig } from 'sabi-canvas';

// App bar
import type { AppBarSaveAction } from 'sabi-canvas';

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

// Templates
import {
  createSabiCanvasTemplateSource, getDefaultTemplateSource, SABI_CANVAS_TEMPLATES_URL, SabiCanvasApiError,
  useTemplateSource, useTemplateList, useTemplateFilters, useTemplateDesignLoader, useApplyTemplate,
} from 'sabi-canvas';
import type {
  TemplateSource, TemplateSummary, TemplateDesign, TemplateFilters, TemplateFilterGroup,
  TemplateFilterState, TemplatesPanelProps, SabiCanvasTemplatesConfig,
} from 'sabi-canvas';
```

> **Removed in 0.4:** `DESIGN_TEMPLATES`, `TEMPLATE_CATEGORIES`, and the `DesignTemplate` / `TemplateCategory` /
> `TemplateCategoryItem` types. Templates now come from a template source; use `useTemplateList` and
> `useTemplateFilters` to list them in your own pages.

---

## Tailwind CSS v4 setup

Sabi Canvas ships its components as Tailwind utility classes and **requires Tailwind CSS v4** in the host app
(it uses v4 class names such as `shadow-xs`, `outline-hidden` and `bg-linear-to-r`). The package does not bundle any
Tailwind CSS: your app generates it. In your main stylesheet:

```css
@import "tailwindcss";

/* 1. Tell Tailwind to scan the canvas for class names (one of the two is enough in production). */
@source "../node_modules/sabi-canvas/dist";

/* 2. Utilities used by the dialogs, sheets, tooltips... (animate-in, fade-in-0, zoom-in-95, ...). */
@plugin "tailwindcss-animate";

/* 3. Same dark-mode switch the components were written for: a `.dark` class on an ancestor. */
@custom-variant dark (&:is(.dark *));

/* 4. Optional: the editor's own tokens (toolbar, panel, canvas-bg, tool-*, editor shadows, animations). */
@import "sabi-canvas/theme.css";
```

- **Colours come from your CSS variables.** The shadcn-style tokens (`--background`, `--primary`, `--border`, ...) and
  the editor ones (`--toolbar`, `--panel`, `--canvas-bg`, ...) are defined by the host, so branding and light/dark mode
  stay yours. `theme.css` only maps them to utilities (`bg-toolbar`, `text-tool-blue`, ...).
- **Customise freely.** Redefine any token in your own `@theme` block, or skip `theme.css` and map just the ones you want.
- **Tooltips need a provider.** Wrap the editor in your app's `TooltipProvider` (`@radix-ui/react-tooltip`).
- **Upgrading from Tailwind v3?** Move your `tailwind.config` to CSS (`npx @tailwindcss/upgrade`) and use `tailwind-merge` v3.

## Local Development & Releasing

`sabi_canvas` is its own git repository and lives **next to** the apps that use it:

```
workspaceos/
  src/ (backend)   client/   storefront/   sabi_canvas/
```

### Working on it alongside client / storefront

Nothing to configure and nothing to publish. `client` and `storefront` each have a
`scripts/sabi-canvas-dev.mjs` that checks for `../sabi_canvas/src/index.ts`:

- **Found** (your machine): `sabi-canvas` resolves to this folder's source, so edits hot-reload in the app.
  React, Konva, React Query and the other peers are pinned to the app's own copies.
- **Not found** (CI, Cloudflare, a lone clone): the published npm package is used.
- Force the published package locally with `SABI_CANVAS=published npm run dev` (in the app).

Run `npm install` here once so the canvas's own dependencies (Radix etc.) resolve.
Keep the two `sabi-canvas-dev.mjs` copies identical.

### Shipping

Push in this order, each repo as usual:

1. Backend.
2. `sabi_canvas`: `npm run release -- patch` (or `minor` / `major`). It bumps, builds, publishes,
   pushes the tag, and updates `sabi-canvas` in `../client` and `../storefront`. Add `--dry-run` to preview.
3. `client` and `storefront`: commit the dependency bump and push.

## Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
