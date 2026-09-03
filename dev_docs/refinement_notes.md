
- ~~add wand and bridge popup to composite view~~
- ~~let's do a careful audit and best practices review of the registration mark system. Make sure it's useful for some of the use cases link printmaking~~

Toolbar Styling & UX(slider functionality tweaks in separate section)
- clearance and filters: 
    - clean up copy for less AI vibe and to reduce vertical height of the overall section.
    - ~~Remove bar above underlap seam bleed section. Maybe add~~
    - consider unit toggle mm/in perhaps in settings modal rather than directly in this
- surface textures & gradiants
    - restyle copy and checkbox for enable (maybe a button instead)
    - ~~Let's use Blade/Cut(I'll figure out best langauge) instead of brandname Cricut and adjust description copy~~
    - perhaps default bridge/spacing/etc to fit to match clearance setting, but then allow manual override
    - keep discrete steps on slider for pattern angle, but allow manual entry of any value intot he degree label box
    - after other refinements, see if it's still too busy, if so consider a modal or (hopefully not) a second toolbar
- Canvas and Material Sizing
    - ~~get one source of truth for unit--should it be here or in settings or in settings but with a quick link button here? select 8.5 x 11 paper but use mm for actual drafting, etc.~~
    - restyle the toggle to match the luma reference app-
    - ~~make margin units dynamic~~ 
- Chroma Separation and tolerances
    - lose the card for no. of colors and get the label to fit in one line
    - engine titles for consistency (seems accent saliency is in reverse format from others)
    - rework engine descriptions to balance accuracy and approachability of description
    - ~~color sheet count moves depending on engine choice-- anchor that to (top?) of section~~
    - rework copy of each slider for less AI vibe and balance of accuracy/layperson readability
    - ~~remove label arrows from color separation bias or add them to other eleemnts for consistency (probably remove)~~
    - ~~tonal luma ramp dymamic range slider: values don't match labels (1.0 middle layer but 1.6 is middle slider placement value)~~
    - ~~misalignment of label and value for color sheet count too (5 in middle label vs 6 middle slider value)~~
- Physical Color Sheets
    - ~~number tag label in title is redundant with chroma sep. section's and the sub title~~
    - ~~too dynamic--bullets and path labels get moved when the reset button pops up--I think make reset persistent but grey/deactivated when not in use, rather than enforcing manual spacing~~
    - ~~not huge on the bullets as separators, maybe pipes, maybe rearrange into two label rows~~
    - not huge on the blockiness of the two-row labeles, maybe just reduce spacing between lines of area and paths. Maybe realign all so that color block is aligned with the two-line labeles and layer title is above color swatch
    - add grab and drag to layers to replace up and down arrows?
    - ~~change layer order. Base is required and should be Layer 0 (Base) with numbering starting from there, 0-indexed~~
- Advanced Channel Weights
    - tweak luma contrast descriptive copy
- export and print
    - ~~different bg color for the registration checkbox-- a muted yellow/cream that compliments the green--incorporate that for all checkboxes~~
- ~~popup bars for source, layer, composite, all need to be moved a bit so they don't obscure the view selection tabs~~


Engine parameter controls
- graphic median cut - no mode-specific fader. Is color separation sufficient, or are there other params for posterization we can tweak for good effect.

- quantized preview not showing manually changed color pallette as expected--maybe I'm misremembering our final design decisionon that feature

- heavy refinement of interlayer gradiants--also check feasibility of two modes-
    - check feasibility of using gradiant with preset pallets like cmyk for another effect


