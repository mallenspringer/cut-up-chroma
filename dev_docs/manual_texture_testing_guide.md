# CutUp Chroma: Negative-Space Pattern Engine Manual Testing Guide

This document provides a systematic manual testing protocol for verifying, evaluating, and refining all four negative-space pattern engines and their parameter controls in CutUp Chroma.

---

## 1. Test Targets & Ideal Test Images

To accurately judge the geometric and physical effects of each parameter, test using the **built-in Chroma Calibration Target & Gradient Suite** (loaded directly in the application via the sample target button or dropdown), complemented by specific real-world test images.

### Built-in Multi-Zone Calibration Target Suite
The built-in target is divided into four distinct test zones, each tailored to specific parameter behaviors:

```
+------------------------------------------------------------------------------------+
|  ZONE 1: Continuous Horizontal Gradient Ramp                                       |
|  [ Highlight Sand  ->  Warm Yellow  ->  Mid Orange  ->  Crimson  ->  Shadow Navy ] |
+--------------------------------------------------+---------------------------------+
|  ZONE 2: 5-Tier Stepped Value Blocks             |  ZONE 3: Concentric Radial      |
|  [ Flat Tier 1 | Tier 2 | Tier 3 | Tier 4 | 5 ]  |          Gradient Disc          |
+--------------------------------------------------+---------------------------------+
|  ZONE 4: Graduated Kerf & Bridge Line Gauge (0.2 mm to 4.0 mm calibrated lines)   |
+------------------------------------------------------------------------------------+
```

* **Zone 1 (Continuous Horizontal Ramp):**
  * **Primary Use:** Evaluating **Full-Field Mode** and continuous tone modulation.
  * **What to observe:** Look for smooth dilation of slots/dots from hairline apertures (highlights) to maximum cutouts (near lower layer tone). Verify there are no sudden phase jumps, banding, or stair-stepping.
* **Zone 2 (5-Tier Stepped Value Blocks):**
  * **Primary Use:** Evaluating **Boundary Gradient Mode** (`blendReachMm`) and inter-layer feathering.
  * **What to observe:** Observe how apertures perforate inward from step perimeters, confirming that block centers remain solid paper while borders transition smoothly into the layer beneath.
* **Zone 3 (Concentric Radial Gradient Disc):**
  * **Primary Use:** Evaluating **Pattern Angle** ($0^\circ$ to $180^\circ$) and 2D aperture symmetry.
  * **What to observe:** 360° circular gradients reveal directional bias, moiré patterns, or rotational distortion across non-axis-aligned contours.
* **Zone 4 (Graduated Kerf & Bridge Line Gauge):**
  * **Primary Use:** Physical clearance validation (`bridgeWidthMm` and `slotWidthMm`).
  * **What to observe:** Gauge whether paper bridges and slot cut widths remain above the mechanical limits of your chosen cutter (e.g. $\ge 1.5\text{ mm}$ for blade drag-knives; $\ge 0.5\text{ mm}$ for lasers).

### Complementary Real-World Test Images
1. **Continuous-Tone Photographic Portrait or Landscape (with Sky Gradient):**
   * Tests organic dithering across complex multi-color separations and skin tones.
2. **High-Contrast Bold Poster / Graphic Art (Large Flat Color Fields):**
   * Tests boundary feathering along organic curves and silhouettes without creating weak detached paper islands.

---

## 2. General Mechanics & Baseline Verification

Before tuning individual parameters, verify the core physical stacking rules common to all engines:

* **Layer 0 (Base Sheet):** Must remain **100% solid paper** with zero cuts (acts as the foundational canvas backing).
* **Upper Sheets (Layer 1 to Top):** Receive negative-space cuts that penetrate through to reveal the color of the sheet **immediately below** ($k-1$).
* **Underlap Backing Protection:** The underlying layer ($k-1$) must have solid paper automatically generated beneath all cut apertures of layer $k$. The bottom base layer must never accidentally show through upper layer slots unless layer $k-1$ is itself the base.
* **Layer Preview & Cut Sheet Preview:**
  * Toggle between **Composite Preview** (simulated 3D stacked paper sandwich) and individual **Layer Previews** to verify toolpaths and aperture silhouettes.

---

## 3. Four Engine Reference & Baseline Activation

| Engine | Visual Style | Structural Mechanism | Best Use Case |
| :--- | :--- | :--- | :--- |
| **Continuous Ribbons** (`ribbons`) | Parallel linear slats | Slat apertures widen with tone; staggered transverse tabs prevent ribbon separation | Woodcut, linocut, retro lithograph shading |
| **Webbed Halftone** (`webbed_halftone`) | Hexagonal dot matrix | Circular cutouts expand with tone; interconnected 6-way tensile web | Continuous photo portraits, pop art, organic tone maps |
| **Stippled Slits** (`slits`) | Staggered capsule slots | Capsule length elongates along slat axis; fixed kerf width | Technical drafting, engraving, hatching |
| **Crosshatch Slats** (`crosshatch`) | Perpendicular brick-bond grating | Slats with staggered transverse ribs | High-contrast architectural, dark shadow relief |

---

## 4. Parameter Test Matrix (Expected Effects)

### Parameter 1: Pattern Pitch / Spacing (`frequencyMm`)
* **Range:** `1.0 mm` to `12.0 mm` (Step: `0.2 mm`, Default: `4.0 mm`)
* **Applies to:** All 4 engines.
* **Ideal Test Zone:** Zone 1 (Continuous Ramp) and Zone 3 (Radial Disc).

| Action | Visual Effect | Physical / Cutter Effect |
| :--- | :--- | :--- |
| **Increase** (e.g. $4.0 \rightarrow 8.0 \rightarrow 12.0\text{ mm}$) | Coarser, bolder texture. Distance between cut lines/dots widens. Fewer individual apertures across each layer. More stylized graphic poster look. | Significantly faster cutting time. Highest structural rigidity and tear resistance. Very safe for thick cardstock and duller blades. |
| **Decrease** (e.g. $4.0 \rightarrow 2.5 \rightarrow 1.2\text{ mm}$) | Finer, denser, photo-like gradient. Apertures become smaller and packed closely together. Subtle tonal transitions. | Exponentially increases cut path count and job time. Paper strips become delicate. On blade cutters, pitch below $2.0\text{ mm}$ may cause blade-drag tearing. |

---

### Parameter 2: Structural Bridge Width (`bridgeWidthMm`)
* **Range:** `0.2 mm` to `4.0 mm` (Step: `0.1 mm`, Default: `1.5 mm`)
* **Applies to:** All 4 engines (controls paper web between halftone dots, transverse ribbon tabs, slit ends, and crosshatch ribs).
* **Ideal Test Zone:** Zone 4 (Kerf & Bridge Gauge) and Zone 1 (Continuous Ramp).

| Action | Visual Effect | Physical / Cutter Effect |
| :--- | :--- | :--- |
| **Increase** (e.g. $1.5 \rightarrow 2.5 \rightarrow 3.5\text{ mm}$) | Paper bridges between cutouts become visibly thicker and more dominant. Maximum cut aperture size is constrained. Overall appearance is lighter/more solid with less underlying color exposed. | Maximum paper tensile strength. Zero risk of paper strips tearing or lifting during blade weeding or mat removal. |
| **Decrease** (e.g. $1.5 \rightarrow 0.8 \rightarrow 0.3\text{ mm}$) | Paper bridges shrink to thin threads. Apertures open much wider, allowing greater reveal of the underlying sheet. Gradients achieve darker, richer deep tones. | Higher risk of paper tearing on drag-knives. If set below the cutter preset's safe minimum ($1.5\text{ mm}$ for Blade), the UI displays a `Below rec.` advisory badge. Recommended only for laser cutters. |

---

### Parameter 3: Slot Cut Width / Kerf (`slotWidthMm`)
* **Range:** `0.2 mm` to `3.0 mm` (Step: `0.1 mm`, Default: `0.8 mm`)
* **Applies to:** Continuous Ribbons, Stippled Slits, Crosshatch Slats (hidden for Webbed Halftone).
* **Ideal Test Zone:** Zone 1 (Continuous Ramp) and Zone 4 (Line Gauge).

| Action | Visual Effect | Physical / Cutter Effect |
| :--- | :--- | :--- |
| **Increase** (e.g. $0.8 \rightarrow 1.6 \rightarrow 2.8\text{ mm}$) | Minimum cut slots become noticeably wider capsules. Even in faint highlight regions, slots open distinctly, creating strong initial contrast. | Ensures cut slots are physically weedable. Prevents the cutter blade from merely scoring a single slit without removing a paper chad. |
| **Decrease** (e.g. $0.8 \rightarrow 0.4 \rightarrow 0.2\text{ mm}$) | Cuts taper down to hairline slits. In light tone areas, cuts become nearly microscopic hairline incisions. | On blade cutters, slots narrower than $0.5\text{ mm}$ may not release paper chads cleanly. Excellent for laser cutters ($0.2\text{ mm}$ kerf) or film transparency printing. |

---

### Parameter 4: Boundary Feather Reach (`blendReachMm`)
* **Range:** `1.0 mm` to `20.0 mm` (Step: `0.5 mm`, Default: `6.0 mm`)
* **Applies to:** All 4 engines (Active only when **Application Mode** is set to **Boundary Gradient**).
* **Ideal Test Zone:** Zone 2 (5-Tier Stepped Value Blocks) and Zone 3 (Radial Disc).

| Action | Visual Effect | Physical / Cutter Effect |
| :--- | :--- | :--- |
| **Increase** (e.g. $6.0 \rightarrow 12.0 \rightarrow 20.0\text{ mm}$) | The perforated transition band extends deep into the interior of each color sheet. Broad, gradual ombre blend between neighboring color layers. Small color islands may become fully textured. | Larger cutting area across each sheet; increases cut path count. |
| **Decrease** (e.g. $6.0 \rightarrow 3.0 \rightarrow 1.0\text{ mm}$) | The perforated texture is restricted to a tight rim immediately hugging the boundary edge. The body of the color sheet remains 100% solid flat paper. | Minimizes cutting time while still softening sharp posterization stepped edges. |

---

### Parameter 5: Pattern Angle (`angleDeg`)
* **Range:** `0°` to `180°` (Slider snaps to discrete $5^\circ$ steps; text box accepts exact floats up to 2 decimal places, e.g. `33.75°`).
* **Applies to:** Continuous Ribbons, Stippled Slits, Crosshatch Slats, Webbed Halftone.
* **Ideal Test Zone:** Zone 3 (Concentric Radial Disc) and Zone 1 (Continuous Ramp).

| Angle Setting | Visual & Structural Orientation |
| :--- | :--- |
| **$0^\circ$ (Horizontal)** | Slats run strictly left-to-right. Best for landscape horizons and horizontal banding. |
| **$45^\circ$ (Diagonal - Default)** | Standard classical printmaking angle. Softens optical interference with horizontal/vertical image lines and reduces tearing along paper grain. |
| **$90^\circ$ (Vertical)** | Slats run strictly vertical. Strong architectural, rain, or fluted column feel. |
| **$135^\circ$ (Reverse Diagonal)** | Opposing diagonal angle. Useful for alternating angles between successive layers to avoid moiré pattern clashes. |
| **Direct Text Typing Test** | Click inside the angle box, type a non-discrete decimal like `22.50`, and press Enter or click away. The angle updates precisely to `22.5°` and the slider thumb snaps to the closest discrete position ($20^\circ$ or $25^\circ$). Dragging the slider subsequently snaps back to clean $5^\circ$ increments without drift. |

---

### Parameter 6: Paper Bridging Tabs (`bridgingTabsEnabled`)
* **Toggle:** Checkbox (Checked / Unchecked, Default: Checked).
* **Applies to:** Continuous Ribbons, Stippled Slits, Crosshatch Slats.
* **Ideal Test Zone:** Zone 1 (Continuous Ramp).

| State | Visual Appearance | Physical Sheet Structural Integrity |
| :--- | :--- | :--- |
| **Checked (ON)** | Transverse paper ties stagger across alternating slat rows. Breaks long continuous slots into bridged segments. | **Essential for physical paper cutting.** Prevents long ribbons from sagging, fluttering, curling, or tearing away during cutting and assembly. |
| **Unchecked (OFF)** | Slats form continuous uninterrupted through-cuts across the entire layer field. | **Paper ribbons may completely detach.** Use strictly for non-cutting workflows: laser cutting acrylic/mylar, overhead transparency masks, photopolymer plate printing, or screen printing stencils. |

---

### Parameter 7: Application Mode (`textureMode`)
* **Options:** `Full-Field Texture` vs `Boundary Gradient` (Default: `Full-Field Texture`).
* **Ideal Test Zone:** Compare Zone 1 vs Zone 2.

| Mode | Visual Distribution | Behavior |
| :--- | :--- | :--- |
| **Full-Field Texture** | Spans across the entire layer body based on source image lightness. | Creates continuous relief tone modulation. Lighter areas have smaller cuts; areas approaching the lower sheet's tone open into larger apertures. |
| **Boundary Gradient** | Confined strictly within `blendReachMm` distance of the layer perimeter. | Interior of the layer remains solid paper. The perimeter softens into a dithered edge gradient blending into the underlying sheet. |

---

### Parameter 8: Target Cutter Preset (`cutterPreset`)
* **Options:** `Blade` (`drag_knife`), `Laser` (`laser`), `Manual` (`manual`).

| Preset | Safe Min Bridge | Safe Min Slot | Mechanical Rationale |
| :--- | :--- | :--- | :--- |
| **Blade** (Cricut / Silhouette) | $1.5\text{ mm}$ | $0.8\text{ mm}$ | Swiveling drag knives exert lateral shear force; bridges $<1.5\text{ mm}$ can bunch or tear cardstock. |
| **Laser** (CO2 / Diode) | $0.5\text{ mm}$ | $0.2\text{ mm}$ | Zero physical contact; limited only by laser kerf width and thermal burn char. |
| **Manual** (X-Acto / Scalpel) | $2.0\text{ mm}$ | $1.2\text{ mm}$ | Human hand dexterity and ruler cutting tolerances. |

*Note: In the current revision, presets serve as advisory guidelines with yellow warning badges rather than hard locks, giving full creative override.*

---

## 5. Step-by-Step Manual Test Execution Protocol

Follow these 5 test passes sequentially to validate engine health and record observations for Phase 3/4 refinement:

### Test Pass 1: Stacking Order & Underlap Reveal (Sanity Check)
1. Load the **Chroma Calibration Target & Gradient Suite**.
2. Set separation to 3 or 4 sheets.
3. Enable **Physical Textures & Gradients**.
4. Set engine to **Continuous Ribbons**, mode to **Full-Field Texture**.
5. Switch to **Composite Preview**:
   * Inspect the upper layers. Confirm the color revealed through the cut slats is the **immediately underlying color**, NOT the bottom black/navy base layer.
6. Switch through individual **Layer Previews**:
   * Confirm **Layer 0 (Base)** has no cuts.
   * Confirm Layer 1 has solid backing under all cut areas of Layer 2.

### Test Pass 2: Continuous Tone Modulation (Zone 1)
1. In Zone 1 (Continuous Ramp), observe the slot aperture progression from left to right.
2. Cycle through each engine:
   * **Ribbons:** Verify slots widen smoothly from left to right.
   * **Webbed Halftone:** Verify circular apertures expand smoothly in a hexagonal lattice.
   * **Slits:** Verify slot lengths elongate smoothly into dashed capsule pill shapes.
   * **Crosshatch:** Verify slat widths expand with transverse brick-bond ribs intact.
3. Adjust **Pattern Pitch** from $2.0\text{ mm} \rightarrow 4.0\text{ mm} \rightarrow 8.0\text{ mm}$. Note the transition from fine filigree to graphic grating.

### Test Pass 3: Boundary Feathering (Zone 2)
1. Switch **Application Mode** to **Boundary Gradient**.
2. Inspect Zone 2 (5 Stepped Value Blocks).
3. Confirm that the centers of the blocks remain solid, untextured paper.
4. Move the **Boundary Feather Reach** slider:
   * At $2.0\text{ mm}$: Notice a narrow, tight perforated border along the step seams.
   * At $15.0\text{ mm}$: Notice the perforated gradient penetrating deep into each step block.

### Test Pass 4: Pattern Angle & Rotation (Zone 3)
1. Observe Zone 3 (Radial Gradient Disc).
2. Set engine to **Continuous Ribbons** or **Stippled Slits**.
3. Drag the **Pattern Angle** slider across $0^\circ, 45^\circ, 90^\circ, 135^\circ, 180^\circ$. Verify the slat direction rotates smoothly.
4. Click the angle text field and manually type `33.33` then press Enter. Confirm the display shows `33.33°` and the angle reflects on screen.
5. Drag the slider slightly; verify that it snaps back to clean $5^\circ$ intervals ($30^\circ$ or $35^\circ$) without cumulative decimal drift.

### Test Pass 5: Paper Bridging Tabs & Kerf Safeguards
1. Set engine to **Continuous Ribbons**, Pitch to $4.0\text{ mm}$.
2. Toggle **Paper Bridging Tabs** OFF:
   * Observe that ribbon slots cut continuously across the entire field.
3. Toggle **Paper Bridging Tabs** ON:
   * Observe the appearance of staggered solid paper bridges interrupting the slots.
4. Adjust **Slot Cut Width (Kerf)** from $0.4\text{ mm}$ up to $2.5\text{ mm}$. Confirm slot thickness expands cleanly.
5. Set Bridge Width below $1.5\text{ mm}$ on the **Blade** preset:
   * Confirm the amber `Below rec.` warning badge appears next to the Target Cutter Preset.
