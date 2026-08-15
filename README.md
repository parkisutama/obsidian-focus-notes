# Focus Notes

A focus timer plugin for Obsidian with structured session logging and a lightweight emotional wellbeing check-in. Three modes — Pomodoro, Timer, Stopwatch — in a clean circular sidebar.

Use it for whatever needs focused time: a 25-minute coding sprint, a 10-minute meditation, or an open-ended reading block. When you stop (or the timer finishes), a log modal appears asking what you worked on, how stressed you felt, what emotion fits the moment, a free-form reflection, and any related notes — then writes a templated entry into whichever file and heading you've chosen.

The wellbeing check-in is intentionally low-friction: **stress** is one of four levels (Low / Normal / Medium / High), and **emotion** is a broad category (Unpleasant / Neutral / Pleasant) with optional chips for a more specific state drawn from the existing mood reference.

---

## User Guide

### Install (manual)

```bash
git clone <this-folder> obsidian-focus-notes
cd obsidian-focus-notes
corepack enable
pnpm install
pnpm run build
```

This produces `main.js` next to `manifest.json` and `styles.css`. Copy those three files into your vault at:

```text
<vault>/.obsidian/plugins/focus-notes/
```

Reload Obsidian, then enable **Focus Notes** under Settings → Community plugins.

---

### Usage

Open the panel via the timer ribbon icon or the command palette (`Open Focus Notes panel`). The sidebar has these regions:

**Mode tabs** — Pomodoro, Timer, Stopwatch. Pomodoro and Timer are both countdown variants with different default durations; Stopwatch counts up.

**Focus input** — type what you're focusing on before you start. Pre-fills the modal so you don't have to retype it after.

**Circular timer** — time remaining (countdown) or elapsed (stopwatch). Below it: Reset, Play/Pause, Stop & Log. Stop & Log works while paused — you don't have to resume first.

**Log target (collapsible)** — set the file, heading, position, and group-by-date for *this session*. The file accepts `{{date}}` and `{{date:FORMAT}}` tokens, so `Daily/{{date:YYYY-MM-DD}}.md` always resolves to today. The Group-by-date toggle decides whether sessions are placed under a date sub-heading inside the main heading, or whether each entry carries the date inline. The level dropdown (`H2/H3/H4`) controls the depth of that sub-heading.

**Recent (collapsible)** — most recent entries from the current section, newest-first. Multi-line entries (main bullet + sub-bullets for wellbeing/notes/links) display as a single block. Click any entry to jump to its line. Walks date sub-headings automatically when group-by-date is on.

---

### Focus Timeline

Open the planner via the calendar ribbon icon or the command palette (`Open Focus Timeline`). This is a separate view from the timer. Configure **Focus Timeline → Source folders** in settings first; one folder per line. The timeline intentionally does not scan the whole vault until you opt folders in.

Supported event lines:

```markdown
- 2026-05-24 15:00 - 16:00 Testing
- 2026-05-24 22:00 - 2026-05-25 02:00 Deployment window
```

Supported task lines:

```markdown
- [ ] Update CSV blok | due:2026-05-23 | remind:2026-05-23 18:11
- [ ] Agenda meeting | start:2026-05-20 14:00 | end:2026-05-20 15:00 | due:2026-05-20
- [x] Daftar aplikasi | due:2026-05-19
```

Timeline behavior:

- `start + end` renders as a timed block.
- `start` or `remind` renders as a point item.
- `due` renders as a due chip on that day.
- Unchecked tasks with a past `due` date appear in the pending summary.
- In Day mode, source notes sit above the timeline so the view remains compact in a sidebar/panel.
- Switching from Day to Weekly View opens a new workspace tab, giving the planner more horizontal room.
- In Weekly View, source notes use a left navigation rail with a minimal source toggle.
- Clicking a timeline item opens the source note.
- Day and Weekly View can be switched from the timeline header.

---

### The log modal

Four sections, top to bottom:

1. **What are you doing?** — free text or a `[[note link]]`. Pick from the suggester to wrap as a wikilink automatically. (The sidebar's input shows the same prompt without the suggester — quick capture, no list.)
2. **Emotional Wellbeing** — choose stress level (Low / Normal / Medium / High), then Unpleasant, Neutral, or Pleasant. Optional emotion-state chips let you capture a more specific state without the old by-feeling/by-body flow.
3. **Reflection and notes** — full-width textarea. The placeholder asks what happened, what shifted your stress or emotion, and what you produced. Click **Open expanded ↗** to launch the focus reflection modal (see below).
4. **Related links** — text input plus an `+ Add note` button that opens a fuzzy file picker; selections append `[[Name]]` to the field. You can also type freely.

---

### Expanded reflection modal

Click **Open expanded ↗** on the reflection field to open a focused writing space. Three things visible at once:

- **Emotional Wellbeing card** — the stress level and emotion context you just selected.
- **Big writing area** — full-width textarea, ~14 rows. The same `notes` field as the inline textarea — whatever you type here replaces the inline value when you hit "Save reflection".
- **Two collapsible reference panels**:
  - **Mini-CBT prompts** — six questions as bullets you can read while writing: Intensity (1–10), Trigger, Automatic thought, Pattern check, Evidence for and against, Balanced view. *Reference, not form fields.* You write your answers in the textarea above, in any order, skipping anything that doesn't fit.
  - **Cognitive distortions to check** — ten patterns (all-or-nothing, overgeneralization, catastrophizing, mind reading, personalization, labeling, emotional reasoning, mental filter, minimization, blaming others), each with a short example quote and one-line description. Scan to identify what your automatic thought looks like.

The reflection modal is *cancel-safe*: closing without "Save reflection" preserves whatever you had in the inline textarea.

---

### Output shape

**Flat mode** (group-by-date OFF):

```markdown
## Focus timeline

- 2026-04-28 09:44 - 10:09 Refactor pipeline
    - focus: 25m 0s · pomodoro
    - stress: normal · 😌 Satisfied — fixed the join order, performance is much better now
    - [[Project X]] [[Performance notes]]
```

**Grouped mode** (group-by-date ON, level 3):

```markdown
## Focus timeline

### [[2026-04-28]]

- 2026-04-28 19:44 - 20:09 Update Dashboard token
    - focus: 25m 0s · pomodoro
    - stress: high · 😤 Frustrated — DevOps blocking access to Tableau, had to escalate
    - [[Project X]] [[Executive Summary Dashboard]]
- 2026-04-28 09:44 - 10:09 Refactor pipeline
    - focus: 25m 0s · pomodoro
    - stress: low · 😌 Satisfied — fixed the join order, flow state the whole session
    - [[Project X]] [[Performance notes]]
```

---

### Settings

Settings hold the *defaults* — the sidebar's per-session override always wins for that session.

- **Pomodoro / Timer minutes** — default durations.
- **Use Daily Notes plugin settings** — when on, the default file auto-derives from the core Daily Notes plugin's folder + format, and the manual file template is inactive. Off → use the manual template below.
- **Default file / heading / insert position** — fallback target when Daily Notes integration is off. New installs use `Journal/{{date:YYYY-MM-DD}}.md` under `## Focus timeline` so completed timer sessions are also valid timeline events.
- **Daily-note date format** — Moment.js format for the bare `{{date}}` token.
- **Group entries under date sub-headings** — global default for the sidebar's group toggle.
- **Date sub-heading level / template** — `## / ### / ####` and the text template (default `[[{{date}}]]`).
- **Flat template** — used when grouping is off. The default format is timeline-compatible: `- {{date}} {{startTime}} - {{endTime}} {{task}}`.
- **Grouped template** — used when grouping is on. The default still keeps `{{date}}` in each bullet because Focus Timeline parses line-by-line instead of inferring dates from headings.
- **Auto-open log modal on completion** — countdown finishes → modal opens automatically.
- **Play sound on completion** — short beep at the end of a countdown.
- **Recent entries to show** — how many to surface in the sidebar.
- **Focus Timeline** — enable the timeline view, choose default Day/Weekly View mode, set weekly span, configure source folders, show/hide completed tasks and pending summary, and choose whether the source sidebar starts collapsed. New installs index `Journal` by default, matching the default log target folder.

#### Template placeholders

Time / session: `{{date}}`, `{{startTime}}`, `{{endTime}}`, `{{startISO}}`, `{{endISO}}`, `{{duration}}`, `{{durationMinutes}}`, `{{durationSeconds}}`, `{{mode}}`, `{{task}}`, `{{notes}}`.

Emotional Wellbeing: `{{wellbeing}}`, `{{stressLevel}}`, `{{stressLabel}}`, `{{emotionCategory}}`, `{{emotionCategoryName}}`, `{{emotionKey}}`, `{{emotionName}}`, `{{emotionEmoji}}`, `{{emotionTag}}`. Legacy mood aliases still work: `{{moodKey}}`, `{{moodName}}`, `{{moodEmoji}}`, `{{moodTag}}`, `{{moodKeywords}}`.

Related: `{{links}}`.

---

### Workflow patterns

**Capture-then-organize.** Default target is your daily note. Hit Start, Stop & Log; later pull the entries into a dedicated note by hand or with another plugin.

**Project-scoped.** Override the target in the sidebar to your project note's `## Sessions` heading. All sessions for the next hour log there.

**Daily journal as timeline.** Group-by-date OFF, target the daily note's `## Focus timeline`. Completed timer sessions, manually written events, and task lines can live in the same section and appear in Focus Timeline.

**Dedicated log file with date grouping.** Group-by-date ON, target a permanent file like `Logs/Focus 2026.md` with heading `## Sessions`. Each new day creates its own `### [[YYYY-MM-DD]]` sub-heading; the recent feed walks them automatically.

**Wellbeing pattern review.** Use Dataview to count `#emotion/anxious`, `#emotion/satisfied`, stress levels, or emotion categories across files. If you log consistently, recurring patterns across days tell you more than any single entry.

---

## Developer Reference

### Documentation

The VitePress source lives in `docs/site/` and is organized by audience: User documentation contains tutorials and use-case how-tos, while Developer documentation contains explanations and technical references. Internal ADRs, specifications, and development checkpoints remain in `docs/` but are excluded from the published site.

- `pnpm run docs:dev` — start the local documentation server.
- `pnpm run docs:build` — validate the production build and internal links.
- `pnpm run docs:preview` — preview the built site locally.

Start from [`docs/README.md`](docs/README.md) for the documentation map.

### Local quality workflow

Development uses Node.js 24 and the pnpm version declared in `package.json`. Enable Corepack before the first install:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Use these commands before opening a pull request:

- `pnpm run check` — formatting, lint, version metadata, typecheck, and unit tests.
- `pnpm run test:coverage` — unit tests with the native Node.js coverage report. The report covers source modules loaded by the current tests; it is a visibility baseline, not a claim that every runtime path is covered.
- `pnpm run check:ci` — the complete local CI gate, including the production bundle and artifact validation. `build` (and therefore `check:ci`) never copies files into a vault.
- `pnpm run format` — apply the repository's Biome formatting rules.

`pnpm run dev` and `pnpm run build` never touch a vault, regardless of `.env`. To also copy `manifest.json`, `main.js`, and `styles.css` into `OBSIDIAN_VAULT_PLUGIN_PATH` after a successful build, use `pnpm run dev:vault` (watch mode) or `pnpm run deploy:vault` (one-shot production build) instead.

Tests live in `test/` and use Node's built-in test runner. Reusable test-only fakes and async helpers belong in `test/support/`; keep one-off fixtures beside the test that owns them. Obsidian UI integration still requires manual desktop and mobile validation because the unit runner does not provide an Obsidian runtime.

### State persistence

Settings use Obsidian's standard plugin-data API and live at
`<vault>/.obsidian/plugins/focus-notes/data.json`. To share them between
devices with Obsidian Sync, enable vault configuration sync for community
plugins and their settings on each device, then reload Obsidian after the
configuration finishes syncing.

Releases that used `<vault>/.obsidian/focus-notes-state.json` migrate that file
into standard plugin data when `data.json` is still missing. The old file is
left untouched as a recovery copy but is no longer read after migration or
written by the plugin.

---

### Architecture

```text
TimerEngine              — pure state machine (countdown | stopwatch)
TargetResolver           — expands {{date}} tokens, resolves Daily Notes default
NoteWriter               — heading-aware insertion + date-sub-heading creation
                           + empty-sub-bullet pruning, file/folder auto-creation
RecentEntriesReader      — multi-line entry bundling, walks date sub-headings
ScheduledItemParser      — strict line-based parser for timeline event/task grammar
ScheduledItemIndexer     — scans configured markdown folders into scheduled items
ScheduledItemQuery       — range/source/completed/pending filtering
TimelineLayout           — render model for blocks, points, due chips
TimelineView             — separate planner view with sidebar and Day/Weekly View grid
CircularDisplay          — SVG ring + centered time/label
MoodReference            — existing emotion-state catalog used by wellbeing chips
EmotionalWellbeingPicker — stress level + Unpleasant/Neutral/Pleasant emotion UI
CognitiveDistortions     — 6 CBT prompts + 10 distortion patterns (data only)
ReflectionFocusModal     — wellbeing reminder + big textarea + collapsible CBT
                           reference panels
LogModal                 — what-are-you-doing + wellbeing + reflection + links
TimerView                — composes the above; owns per-session target override
StateStore               — ordered data.json writes and legacy-state migration
SettingsTab              — defaults
main.ts                  — plugin lifecycle and DI
```

The view starts with a fresh copy of the default target on each open, so yesterday's override doesn't silently follow you into today.

---

## License

MIT
