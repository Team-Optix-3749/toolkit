# UI/UX design workflow

Apply this workflow to the existing application; do not replace working functionality or the design system without an explicit request.

## Principles

- Minimal, not empty; modern, not trend-driven; professional, not sterile. Make complex work feel simple without hiding useful controls.
- Preserve useful information density and predictable, fast workflows. Reuse existing components, tokens, interaction patterns, and content where practical.
- Use clear typography and hierarchy, restrained color, subtle borders, shadows, and radii. Avoid unnecessary cards, ornamental effects, decorative animation, and generic AI-generated layouts.
- Design for accessibility and responsive layouts, including keyboard and focus behavior, reduced motion, and loading, empty, error, and interactive states.

## Process

1. Inspect the relevant routes, components, Tailwind tokens in `src/styles.css`, existing behavior and rendered screens. Capture a baseline at desktop, tablet, and mobile sizes; identify user goals and constraints.
2. Run Impeccable (`/skill:impeccable critique` or `audit`) against the target. Use `distill` to simplify and `polish` for finishing when appropriate. Follow its reference workflows; its automatic editing hook is not verified active. Run the skill's manual detector when required.
3. Use `/skill:ui-ux-pro-max` to search its local design and accessibility resources for relevant product patterns, typography, color, and React guidance. Adapt results to this application and these principles, not a generated aesthetic by default.
4. Use `/skill:frontend-design` to guide implementation: intentional hierarchy, typography, spacing, and restrained visual decisions specific to the task. Reuse and improve current components rather than introducing a competing library.
5. Exercise the rendered result in OMP's browser: navigate and interact, inspect keyboard/focus and relevant states, and compare screenshots at desktop, tablet, and mobile. Save PNG baselines for `diffScreenshot`. Avoid changing real data during review.
6. Run `/skill:web-design-guidelines` on changed UI files; fetch its current upstream guidelines, then address accessibility and usability findings. Validate actual interaction, not just source patterns.
7. Iterate until cohesive, functional, accessible, responsive, and visually polished; report verification, remaining issues, and any untested states.

## Local tooling notes

- UI UX Pro Max examples refer to `CLAUDE_PLUGIN_ROOT`, which OMP need not set. Run its search directly from the project: `python3 .omp/skills/ui-ux-pro-max/scripts/search.py "accessible focus" --domain ux`. The project skill symlink resolves into OMP's plugin cache; reinstall the marketplace plugin if the cache is removed or the project is moved to another machine.
- Treat generated design systems as suggestions: the tested analytics-dashboard query returned a marketing-oriented layout. Check domain-specific results against the actual application before applying them.
- Project stack: React 19, TanStack Start/Router, Vite, Tailwind CSS 4, npm lockfile, and custom components. The README specifies Node 22 and local Supabase; do not reset databases containing real data. During toolkit setup the installed Node 26/npm process failed, while `bun --bun run dev -- --host 127.0.0.1` served the app on port 5176. Check the current environment before choosing a runtime.
- OMP's default browser-panel launch failed during setup. The native `browser.open` worked with `app.path` set to the existing Chrome for Testing executable reported by Playwright's `chromium.executablePath()`; use this workaround if needed. Browser paths are machine-specific. Close tabs and stop temporary servers after verification.
- The official UI UX Pro Max marketplace plugin is selected by the project `.omp/skills/ui-ux-pro-max` symlink; the pre-existing `omp-designer` plugin remains disabled. Restart OMP or reload plugins after changes to discovery. Installed slash commands are `/skill:impeccable`, `/skill:frontend-design`, `/skill:ui-ux-pro-max`, and `/skill:web-design-guidelines`.
- The official shadcn MCP is configured in `.omp/mcp.json` for component and example discovery. Use it when a shadcn component fits the task; integrate it deliberately with existing tokens and interactions instead of replacing the design system wholesale. The project has no `components.json` yet, so initialize shadcn only when adopting components, and review initialization changes before applying them. No 21st.dev MCP is configured; it requires an API key and some operations are paid.
