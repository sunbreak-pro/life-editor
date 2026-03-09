# Life Editor UI/UX Refactor Plan

## 1. Current State Analysis
The current application "Life Editor" is an Electron-based desktop app (React + Vite + Tailwind CSS v4).
It consists of several core screens:
- **Tasks** (Tree structure, drag-and-drop support)
- **Schedule** (Calendar/Timeline views)
- **Memo** (Rich text editor using TipTap)
- **Work** (Focus timer / session management)
- **Analytics** (Recharts)
- **Settings & Trash**

The layout is built around a standard desktop application structure:
- `TitleBar` (Electron drag region)
- `LeftSidebar` (Navigation between sections)
- `MainContent` (The active section view)
- `RightSidebar` (For context-sensitive properties or tools)

The visual theme currently relies heavily on Notion-like aesthetics (e.g., `--color-notion-bg`, `--color-notion-text`).

## 2. Goal
To refine and modernize the UI/UX without altering the underlying core data flow or functionality. The objective is to make the application feel more "premium" and "clean", leveraging modern UI trends (e.g., refined typography, improved whitespace, cohesive colors, smooth micro-animations) while keeping the highly productive core.

## 3. User Requirements (From Q&A)

1. **Target Aesthetic:** Minimalist and functional, deeply inspired by Obsidian and Notion. The interface should feel self-explanatory at a glance without clutter.
2. **Pain Points:** 
   - Typography inconsistencies: Text sizes vary wildly in places like the Work Right Sidebar, making the global font size setting ineffective. Needs complete normalization.
   - Tag UI (`[[]]`): Tags currently look raw. They need visual upgrades (e.g., rendering as `【】`, adding a leading hyphen/icon, or using colors for borders/backgrounds instead of raw text brackets).
3. **Animations/Transitions:** Speed is the priority. Keep transitions either zero or extremely fast (micro-interactions only) to ensure a snappy, productive feel.
4. **Color Palette:** Support a modern, monochromatic theme with a single accent color (in addition to existing options).
5. **Layout Modifications:** Keep the current `[ Left Sidebar | Main Content | Right Sidebar ]` structure, but beautifully refine it. Focus on panelizing floating elements (like Search) and matching the Command Palette to the new aesthetic.

## 4. Proposed Implementation Phases

### Phase 1: Design System & Typography Normalization
- Create a new "Modern Monochrome" theme in `index.css` alongside the existing ones.
- Introduce strict, unified typography utility classes (or redefine base text sizes) across the app to fix the scaling issues (especially in `Work/` and Sidebars).
- Ensure the global font-size setting scales all text harmoniously.

### Phase 2: Tag UI & Markdown Rendering Enhancements
- Update the TipTap editor extensions/rendering logic to transform `[[Task]]` syntax visually.
- Implement options for Tag display modes: Icon + Text, colored badges, or simple bracket replacements (e.g. `【】`).

### Phase 3: Layout Polish & Sidebar Refinement
- Polish the `LeftSidebar` and `RightSidebar` (padding, borders, hover states) to match the Obsidian/Notion clean look.
- Refactor the `RightSidebar` in the Work screen to standardize its varied font sizes and blocky layout.

### Phase 4: Panels, Command Palette, and Speed
- Refine the `CommandPalette` component to match the newly polished aesthetic.
- Panelize the search functionality if necessary, ensuring it feels integrated.
- Audit CSS for any slow transitions and ensure UI interactions are snappy (under 100ms or instant).

## 5. Verification Plan
1. **Visual QA:** Toggle all typography settings to ensure text scales consistently, particularly in the Work sidebar.
2. **Tag Interaction Test:** Create various wiki-links (`[[tag]]`) and ensure they render according to the new logic.
3. **Theme Test:** Switch between the classic theme and the new Monochrome + Accent theme.
