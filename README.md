# michaeljmaynard.github.io

Static hosting for interactive work linked from [michaeljmaynard.co.uk](https://michaeljmaynard.co.uk). Crawling is disallowed in `robots.txt`.

| Path | What it is | SHA-256 |
|---|---|---|
| `/hawes-curtis-pdp/` | Presentation: the working product page with desktop and mobile widths, full screen, and an optional guide to its key decisions (`shell/`) | — |
| `/hawes-curtis-pdp/pdp/` | The product page itself, `hc-v3-pdp.html` unchanged | `bca21e89bd1432092cf343f8ac30d9b335baeb50c022b469b0f4ce53e0b5cb5a` |
| `/smythson-diary-finder/` | Presentation with the same desktop and mobile widths, full screen, and a five-chapter guide to the Diary Finder | — |
| `/smythson-diary-finder/finder/` | The self-contained Diary Finder prototype, unchanged | `7394930ed20b13cb72a78f7f181b80320b0418c67aaf1e7547e42f503eba365e` |

The presentation never edits or overlays the product page: it shows it in a same-origin window, resizes that window for the mobile view (so selections and the bag carry over), and scrolls it to a chapter on request.

Deep links: `?view=mobile` opens the mobile width; `#thinking` opens the guide; `#thinking-2` to `#thinking-4` open a chapter and bring it into view.

The Diary Finder also supports `#thinking-5`. Its chapters jump to stages reached in the interactive journey and leave the visitor's answers intact. Later chapters can be read before those stages are unlocked.
