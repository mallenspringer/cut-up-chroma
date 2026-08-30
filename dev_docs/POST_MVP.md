# CutUp Chroma — Post-MVP Roadmap & Future Architecture (POST_MVP.md)

---

## 1. Advanced Physical Material & Texture Simulation Engine

CutUp Chroma simulates tactile physical craft cardstock in the 3D Composite viewport. While V1.0 ships with procedural SVG filter shaders (*Hot-Press Bristol* and *Cold-Press Watercolor Rag*), the engine is structured to support rich physical materials and dynamic animated specialty foils post-MVP.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Layer Vector Cut Sheet (SVG <path> / Mask)                                │
│   ├── Level 1: Procedural SVG Filters (V1: Bristol / Cold-Press)          │
│   ├── Level 2: Alpha-Mask Micro Textures (Post-MVP: Woodgrain, Felt)      │
│   └── Level 3: GPU-Composited Animated Shaders (Post-MVP: Holographic)    │
└───────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Alpha-Mask Micro Textures (Woodgrain, Felt, Linen, Recycled Chipboard)
* **Architecture:** High-resolution seamless alpha-channel heightmaps / normal masks loaded as lightweight WebP micro-tiles.
* **Compositing:** Uses SVG `<pattern>` with SVG `<feComposite operator="in">` or CSS `mask-image` combined with `mix-blend-mode: multiply` and `mix-blend-mode: overlay`.
* **Layer Seed Shuffling:** Each layer receives a deterministic pseudo-random offset seed and rotation so adjacent sheets of the same material don't show repetitive grain alignment.
* **Target Materials:**
  - *Natural Woodgrain & Intarsia Veneer* (Birch, Walnut, Maple, Cherry)
  - *Pressed Wool Felt* (Fibrous micro-texture with soft edge diffusion)
  - *Linen & Bookcloth* (Orthogonal cross-hatch fiber weave)
  - *Speckled Kraft / Chipboard* (Organic recycled fiber specks)

---

### 1.2 Zero-Compute Animated Shaders (Holographic Foil, Iridescent Sheen, Fine Glitter)
* **Goal:** Provide fluid 60fps tactile preview of specialty craft materials with zero per-frame CPU rasterization overhead.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. Vector Cutout Path (<path d="..." />)                                  │
│       ▲                                                                   │
│       │ SVG <mask> / CSS clip                                             │
│ 2. Procedural Noise Grain (<feTurbulence> / Specular Mask)               │
│       ▲                                                                   │
│       │ CSS `mix-blend-mode: color-dodge` / `overlay`                     │
│ 3. GPU Keyframe Dynamic Spectrum (conic-gradient / linear-gradient)       │
│       └─► Hardware CSS @keyframes or mouse-move tilt parallax             │
└───────────────────────────────────────────────────────────────────────────┘
```

* **Implementation Strategy:**
  1. **Hardware CSS Gradient Animation:** Multi-stop spectral gradients (`conic-gradient(#ff0077, #7700ff, #00eeff, #00ff66, #ffea00, #ff0077)`) rotated via CSS hardware transforms or smooth mouse-position parallax.
  2. **Specular Grain Lighting:** An SVG `<feSpecularLighting>` filter or micro-sparkle grain mask positioned above the animated gradient with `mix-blend-mode: color-dodge`.
  3. **Zero Pipeline Invalidation:** Because shader effects exist purely in the CSS/SVG compositing layer, adjusting foil angles or toggling holographic materials requires $0\text{ ms}$ recalculation and never invalidates Potrace vector paths or $K$-Means clusters.

---

## 2. Expanded Cardstock Swatch Libraries & Direct Brand Matching

* **Manufacturer Cardstock Presets:**
  - *French Paper Co.* (Pop-Tone, Construction, Speckletone)
  - *Colorplan / G.F Smith* (55-color master paper palette with true sRGB/OKLab calibrations)
  - *Bazzill Basics & American Crafts* textured papercraft libraries
  - *Metallic & Mirror Foils* (Gold Leaf, Brushed Aluminum, Rose Gold)
* **Nearest-Cardstock Snapping:**
  - Instant 1-click snap from image $K$-Means centroids to the nearest commercially available cardstock sheet SKU based on $\Delta E_{00} / \Delta E_{\text{OKLab}}$.

---

## 3. Curated Sample Gallery & Asset Library

* **Photographic & Illustrative Calibration Gallery:**
  - Curated high-dynamic-range test photos (botanical close-ups, portraiture, multi-colored retro posters, landscape gradients).
  - Built-in library of SVG vector asset testbeds.

---

## 4. Advanced Manufacturing & CNC Tooling Extensions

* **Multi-Tool CNC / Laser Layer Marking:**
  - Automated engraving of layer assembly numbers (`#1/5`, `#2/5`) and alignment registration targets directly into scrap/void margin areas.
* **Kerf & Blade Offset Compensation Optimizer:**
  - Per-material kerf calibration presets (Laser diode vs CO2 laser vs Drag-knife Cricut fine-point blade).
* **Multi-Page Cut Sheet Tiling:**
  - Splitting oversized artwork across multiple standard physical sheets ($8.5\times 11\text{ in}$ or $12\times 12\text{ in}$) with puzzle-tab assembly joints.

---

## 5. Web Worker Pipeline Offloading, WebGL Shaders & WASM Potrace

To ensure rock-solid 60–120 FPS performance on lower-tier mobile and budget Chromebook hardware during heavy multi-layer editing:

* **Dedicated Dedicated Web Worker Pipeline (`chroma.worker.ts`):**
  - Offload pixel classification ($K$-Means / OKLab), morphological dilation, and Potrace vector tracing completely off the main UI thread via `postMessage` with `Transferable` `ArrayBuffer` payloads.
  - Zero main-thread CPU spikes or UI frame drops during heavy 10-layer edits.
* **Hardware-Accelerated WebGL / WebGPU Shader Layer:**
  - Real-time GPU raster preview using GLSL fragment shaders for color quantization, underlap dilation, and dynamic drop shadows.
* **WASM / SIMD Potrace Acceleration:**
  - Compile the native C Potrace vectorizer to WebAssembly with 128-bit SIMD vector vectorization for ~5x faster vector path conversion.

---

## 6. High-DPI Digital Mockup & Animated Showcase Exporter

Enables makers to generate commercial digital assets, product listing mockups (Etsy, Shopify), and social media video showcases directly from their layered vector projects:

```text
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ 3D Composite Stack Viewport (SVG Vectors + Shaders + Drop-Shadows)        │
 ├───────────────────────────────────────────────────────────────────────────┤
 │  ├── 1. Static High-DPI Exporter (SVG -> Canvas 300 DPI Pipeline)         │
 │  │     ├── Transparent Alpha PNG (Preserves Void Base Foundation)         │
 │  │     ├── High-Quality Print JPEG (Solid Archival Backing)               │
 │  │     └── Base64 Texture Embeddings (Felt, Woodgrain, Bristol Micro-Grains)│
 │  │                                                                        │
 │  └── 2. Animated Showcase Exporter (HTMLCanvasElement.captureStream API)   │
 │        ├── 2-Second Dynamic Foil Sweeps (0° -> 360° Rainbow Shimmer)     │
 │        ├── Mouse Parallax / 3D Tilt Recording                             │
 │        └── Zero-Server Client-Side Export: Animated WebP, GIF, MP4 Video  │
 └───────────────────────────────────────────────────────────────────────────┘
```

### 6.1 High-DPI SVG-to-Canvas Rasterization Architecture
* **Standalone Base64 Serialization:**
  - When serializing DOM SVG elements to XML strings, external texture assets (felt, woodgrain, linen tiles) are embedded as inline Base64 data URIs (`data:image/webp;base64,...`) within SVG `<defs><pattern>` blocks to bypass browser cross-origin security restrictions.
* **300 DPI Archival Output:**
  - The serialized SVG is drawn onto an offscreen HTML5 `<canvas>` scaled by $3\times \to 4\times$ the viewport dimensions, outputting crisp, anti-aliased $3300\times 2550\text{ px}$ images for physical print framing.
* **True Alpha Transparency Support:**
  - When the project base foundation is set to **Void**, the offscreen canvas background remains unpainted, producing a transparent PNG cutout ready for digital collages, website headers, and branding mockups.

### 6.2 Browser-Native Animated Mockup Recording (`MediaRecorder`)
* **Client-Side Video/Animation Generation:**
  - Uses the browser's built-in `HTMLCanvasElement.captureStream()` and `MediaRecorder` Web APIs to generate video/animation files with $0\text{ ms}$ backend latency.
* **Holographic & Specialty Foil Animation Loops:**
  - Renders a continuous 60 FPS keyframe sweep ($0^\circ \to 360^\circ$) across dynamic holographic foil gradients and specular grain masks.
  - Automatically loops the sequence into an exportable **Animated WebP**, **GIF**, or **H.264 MP4 video** optimized for Instagram Reels, Etsy listing videos, and Kickstarter campaign pages.

---

## 7. Companion Interactive Lightbox Web App (Web Component / Embed Generator)

A dedicated, standalone companion web tool designed to ingest multi-layer SVG cut files (from CutUp Chroma, CutUp Luma, or external CAD/vector editors) and compile them into standalone, interactive digital lightbox widgets for web embedding and digital art showcases:

```text
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Multi-Layer Cut SVG Import (Layer 0 .. Layer N)                           │
 ├───────────────────────────────────────────────────────────────────────────┤
 │  ├── 1. Interactive 3D Depth & Light Simulation Engine                    │
 │  │     ├── Multi-Layer Parallax Tilt (Gyroscope & Mouse Follow)           │
 │  │     ├── Virtual Edge-Lit LED & Backlight Color Temperature Tuning      │
 │  │     └── Acrylic / Cardstock Spacer Depth & Shadow Blur Simulation      │
 │  │                                                                        │
 │  └── 2. Zero-Dependency Embed & Export Target                             │
 │        ├── Standalone Custom HTML5 Web Component (<cutup-lightbox />)     │
 │        ├── 1-Click iframe / Script Embed Code for Websites & Portfolios   │
 │        └── Interactive Shader Preset Configuration                        │
 └───────────────────────────────────────────────────────────────────────────┘
```

* **Core Scope & Intent:**
  - Completely separate companion application (independent codebase/runtime) that accepts multi-layer vector SVGs and allows creators to turn their physical papercraft/shadowbox cut designs into interactive, embeddable web experiences.
  - Simulates dynamic backlighting, edge-lit acrylic glow, variable shadow diffusion between sheets, and interactive 3D mouse/gyroscope parallax.
  - Outputs standalone, zero-dependency embeddable widgets for web portfolios, digital art galleries, and interactive product showcases.



