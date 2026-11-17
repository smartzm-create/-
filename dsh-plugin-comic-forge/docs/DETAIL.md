# Comic workbench (漫画工作台)

A comic-production pipeline that lives in the DSH left sidebar. It gives you one
place to take a story from a one-line idea to an exported comic, while keeping
characters consistent across every panel.

## Where it shows up

- **Left sidebar entry** — a "Comics" (漫画台) row in the sidebar's plugin list.
  Clicking it opens the workbench as a full page in the main area.

## The pipeline

The workbench tracks six stages for the current episode and shows where it is
in the pipeline:

1. **Outline** — a one-line logline plus a three-act structure.
2. **Characters** — character sheets with locked reference art (turnarounds) so
   faces, hair and costumes stay consistent from panel to panel.
3. **Storyboard** — the episode broken into panels, each with a camera note, a
   scene description and its dialogue lines.
4. **Batch render** — every panel is generated as an image. A character lock and
   a consistency-strength control keep the art on-model; a drift check flags any
   panel whose character strays from the reference art.
5. **Layout** — panels are arranged into pages and speech bubbles are placed.
6. **Export** — the finished episode as a print-ready PDF, a vertical long strip,
   or per-page images.

## Current status

This first version ships the pipeline **dashboard**: it renders the six-stage
overview for a sample episode ("Night Train, Ep. 1") so you can see the whole
flow and where each stage stands.

The stage cards, render queue (including the character-drift warning) and
consistency controls are displayed from sample data. Wiring the render stage to a
live image backend (dsh-image-gen / ComfyUI) and persisting per-project state is
the next step; the slot wiring (sidebar entry + main page) is already live.

## Notes

- The plugin registers two client slots: `sidebar.panellist` (the entry) and
  `main` keyed to the same panel id (the page). This mirrors how the built-in
  plugin manager wires its own sidebar entry.
- All text goes through the locale service (`locale/en.json`, `locale/zh.json`).
- Colors, radii and fonts follow the host theme, including dark mode.
