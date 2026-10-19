---
version: alpha
name: "MediTrace"
description: "A calm, high-clarity prescription review workspace built around the visual language of a pharmacy review sheet."
colors:
  ink: "#15202B"
  primary: "#1646C8"
  primary-strong: "#0D349E"
  accent: "#E65745"
  surface: "#FFFDF8"
  canvas: "#F2F4F8"
  border: "#D8DEE8"
  muted: "#667085"
  success: "#157A5A"
  warning: "#A65A15"
  danger: "#B42318"
typography:
  display:
    fontFamily: "'Space Grotesk', Arial, sans-serif"
  body:
    fontFamily: "'Manrope', Arial, sans-serif"
  mono:
    fontFamily: "'IBM Plex Mono', Consolas, monospace"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.25rem"
spacing:
  page-max: "76rem"
  section-gap: "5.5rem"
components:
  button: {}
  card: {}
  upload-zone: {}
---

# MediTrace Design System

## Overview

### Creative North Star

MediTrace uses the order and confidence of a pharmacist's annotated review sheet: crisp information blocks, a visible document trail, and one blue action colour that directs attention to the next safe step.

### Product context and register

- **Audience and primary job:** Pharmacists and care teams reviewing a prescription image before acting on it.
- **Target market and language:** English coursework prototype; copy must remain plain and clinically cautious.
- **Usage scene:** Desktop-first review work, with mobile upload support. Users may be interrupted, so status and the original OCR text remain visible.
- **Register:** Hybrid. The landing route introduces the product; the upload route is a focused product workflow.
- **Memorable signature:** The vertical cobalt review rail and compact review-status labels echo a paper prescription file without imitating a hospital dashboard.
- **Restraint:** Result data, warnings, and controls remain simple and quiet. No decorative medical illustrations or excessive motion.
- **Anti-references:** Avoid neon “AI health” dashboards, generic rounded-card SaaS layouts, and any visual treatment implying automatic clinical approval.
- **Token ownership/runtime mapping:** `frontend/src/styles.css` is the canonical runtime token source. This document mirrors its root CSS variables and explains their use.

## Colors

`primary` is reserved for the next action, active links, and keyboard focus. `accent` marks sequence labels only. `success`, `warning`, and `danger` are semantic states, never the only way information is communicated. Surfaces remain warm-white against a cool grey canvas; dark mode is not currently implemented.

## Typography

Space Grotesk is used only for prominent headings and product identity. Manrope carries interface copy. IBM Plex Mono labels structured review metadata, OCR text, and file details. Use sentence case in controls; avoid all-caps except compact metadata labels.

## Layout

The page uses a maximum width of `76rem`. The product workflow places upload controls beside stable results on desktop and stacks them on narrow screens. Controls never move when the request is loading; result regions reserve space for loading, error, and empty states.

## Elevation & Depth

Borders and tonal contrast establish hierarchy. Only the primary review panel has a subtle shadow. Static informational cards stay flat.

## Shapes

Controls use `rounded.sm` to feel precise; larger document and feature panels use `rounded.lg`. Dashed borders are reserved for the upload target only.

## Components

### Foundational visual states

Buttons have visible hover, pressed, focus-visible, disabled, and busy states. Errors stay inline with correction guidance. The upload panel uses a stable spinner during OCR so its dimensions do not jump.

### Buttons and actions

Solid cobalt is the primary action. Quiet text buttons handle secondary actions such as removing a selected file. Danger styling is reserved for true destructive actions, which are not currently present.

### Forms and overlays

The upload zone supports file browsing, keyboard activation, drag-and-drop, client validation, and inline errors. The server remains the final validation layer.

### Motion

Use a short opacity/transform transition for hover and entry. Respect `prefers-reduced-motion` by disabling nonessential animation.

## Do's and Don'ts

- **Do:** Keep raw OCR text visible beside structured results so a person can verify it.
- **Do:** Use explicit language such as “Review before use” instead of promising safety or accuracy.
- **Don't:** Present an OCR result as an approved prescription.
- **Don't:** Use visual clutter that competes with warnings or patient/medicine details.
