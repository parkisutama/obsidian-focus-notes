# Contextual related-log golden fixtures

These fixtures represent the append-only Markdown that Task 12 proposes. Each line must remain understandable even if its final Daily Note link later breaks during archival. The examples assume the primary note is `Daily/2026-08-02.md`; object paths are stated per fixture so varying folder depth remains visible.

## People — `People/Andi.md` under `Interactions`

```md
- 2026-08-02 09:00–10:00 — Discuss audit methodology at Head Office — [Daily Note](../Daily/2026-08-02.md)
```

## Place — `Places/Head Office.md` under `Mentions`

```md
- 2026-08-02 09:00–10:00 — Discuss audit methodology with Andi — [Daily Note](../Daily/2026-08-02.md)
```

## Activity Object — `Persona/Work/Activities/Cycling.md` under `Logs`

```md
- 2026-08-02 06:30–08:00 — Morning cycling — [Daily Note](../../../Daily/2026-08-02.md)
```

## Book — `Books/Thinking.md` under `Reading Notes`

```md
- 2026-08-02 20:15 — Review chapter on associative memory — [Daily Note](../Daily/2026-08-02.md)
```

## Review decision

- [x] The timestamp/range is sufficient without opening the Daily Note.
- [x] The activity text is sufficient after an archive breaks the backlink.
- [x] The source-specific headings are understandable.
- [x] Ordinary relative Markdown links are preferred over block IDs.
