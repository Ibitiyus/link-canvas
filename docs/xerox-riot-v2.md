# XEROX RIOT v2

The approved HTML mockup drives the service UI: paper, ink, red, pink and occasional mint; cutout type and actions; square paper panels and xerox texture. The supplied HTML references three images that were not attached in its ZIP, so the landing collage uses existing repository assets. No remote fonts, new packages, migration or stack change is required.

## Implementation boundaries

- `styles/tokens.css` defines the palette, font families and paper primitives.
- `styles/xerox-riot.css` is the final service theme layer, after the existing layout and component styles. Paper instruments use locally scoped semantic tokens; no author content selector receives a brand palette, font, texture or transform.
- `components/ui/Cutout.tsx` composes actual pieces within a single accessible link/button. `CutoutLabel` is reused by landing, authentication, cloud save and publication actions. SVG arrows avoid missing display-font glyphs.
- Landing keeps all real routes and the interactive sandbox; adds a collage, three explicitly labelled template examples, and a final CTA. Examples link to existing templates, not fabricated users.
- Condensed Roboto supplies Cyrillic display type, IBM Plex Mono supplies labels, and system Georgia supplies italic cutouts. Existing locally bundled fonts are reused.
- Editor library, layers, properties and forms become paper instruments around a dark workspace. Destructive actions use outlined red with a filled hover state.
- The existing four mobile tools (blocks, layers, properties, publication), resizing sheets, keyboard handling, selection actions and direct movement are preserved. The theme changes their hierarchy, active state and contrast without changing tool state or gestures. While a tool sheet is open, duplicate canvas action/zoom rows collapse; their controls remain available in the canvas state and the sheet’s zoom view, leaving room for readable fields.
- Explore retains search/debounce, filters, pagination, author covers, reports and empty/error states. Author covers are not filtered or recoloured.
- All four auth modes keep their existing validation, submission, redirects and recovery behavior.

## Grid

The existing `editorGrid` model selects dark strokes on light backgrounds and light strokes on dark backgrounds, with a halo for images. Auto/manual/hidden controls remain intact. The new editor-only grid uses solid strokes with inverse canvas-scale widths, keeping lines approximately one screen pixel wide when zoomed out. Grid cells are rendered only when `editing` is true and are absent from preview and public pages. Project data is never changed to implement the grid.

## Validation

See the PR description for final command results. `tests/xerox-riot.spec.ts` covers landing/auth at 320, 390, 768 and 1440 pixels, the zoomed light grid, its visibility toggle and preservation of author styles in preview. Existing editor, responsive, explore and media suites remain in use. Existing explore-heading and reduced-motion selectors are updated for the new design; the media-request guard also recognises Vite’s local bundled-font path; the editor helper waits for the asynchronously mounted library before deciding whether mobile tools are needed.

Authenticated production publishing and real email delivery require a test account and the configured backend; this visual change does not modify Supabase, SMTP or Resend integration.
