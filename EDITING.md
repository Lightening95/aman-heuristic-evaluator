# Changing how the page looks

Easiest route: tell Claude what you want changed and it edits the files for you. If you'd rather poke at it yourself, here's the map.

While `START.bat` is running, save a file and the page updates by itself. Just switch back to the browser. If you break something, the black window shows a red error; undo your change (Ctrl+Z) and save again.

Open the files in any text editor. Notepad works; [VS Code](https://code.visualstudio.com) is nicer.

## The three files that matter

| What you want to change | File |
|---|---|
| Wording, buttons, what appears where | `app/page.tsx` |
| Colours, spacing, sizes, pop-up styling | `app/globals.css` |
| The heuristics being checked | `lib/rubric.ts` |

## Wording

In `app/page.tsx`, text you see on screen sits between `>` and `<`, like:

```
<h1>Dashboard Heuristic Evaluator</h1>
```

Change the words between the tags, leave the tags alone.

## Colours

Everything is set once at the top of `app/globals.css`, in the `:root` block:

```
--accent: #3b5bdb;     /* buttons and highlights */
--bg: #f6f7f9;         /* page background */
--surface: #ffffff;    /* cards */
--sev-4: #c53030;      /* catastrophe red */
```

The `@media (prefers-color-scheme: dark)` block below sets the same colours for dark mode.

## Spacing and placement

- Page width: `.page { max-width: 1280px; }`
- Side-by-side columns: `.setup` and `.workspace` use `grid-template-columns`. The first number is the left column, the second the right. Swap the numbers to change which side is wider.
- Gaps between things: `gap:` values.
- Rounded corners: `--radius`.

## Pop-ups

- `.popover` is the grey hover box used by the score cards and the `?` help.
- `.pin-popup` is the card that appears next to a numbered pin on the screenshot.

To add a pop-up to something else in `app/page.tsx`, make sure its container has `position: relative` in the CSS, then put this inside it:

```
<div className="popover">
  <strong>Title</strong>
  <span>Explanation.</span>
</div>
```

and in the CSS add your container to the hover rule:

```
.your-thing:hover > .popover { display: flex; }
```
