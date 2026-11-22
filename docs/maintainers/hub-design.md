# Hub design decisions

Status: the read-only hub was built on November 20, 2026 from these decisions. The page is [scripts/hub-page.mjs](../../scripts/hub-page.mjs); the server and the state it reads are [scripts/hub.mjs](../../scripts/hub.mjs); the user guide is [The hub](../work-queue.md#the-hub).

## Who it is for and what they should be able to do

A person who asked for work to be done and is not reading a terminal. Two live trials had agents exchanging findings and answers, and the owner said twice that he never saw them talk. The exchange lived in a file, and each session's chat showed only its own commands.

The page answers three questions at a glance, in this order:

1. Where is the work? The line, with each unit's state.
2. Does anything need me? What waits on the person.
3. What are they saying? The conversation, as it happens.

Rejection condition: the page fails if a person watching it during a live run cannot tell, without scrolling on a desktop screen, which unit is being worked and whether anything waits on them.

## Direction

A window onto a shop floor, not a dashboard. The line is drawn as a track with a station per unit, because order is the thing a queue adds. The agents' words are the main event and get the widest column and the most space. There are no cards with shadows, no charts and no counters beyond "1 of 2 units done".

| Decision | Value | Why |
| --- | --- | --- |
| Layout | A band for the goal and the track, then two columns: conversation left, "Waiting on you" above "Activity" on the right. On a phone: waiting on you, conversation, activity | The conversation is what was missing. What needs the person is short and must not be scrolled past |
| Signature element | The track: numbered stations on a rail; the unit in progress is solid ink with a slow ring; a done unit is green with a check; a halted unit is the signal color | Shows order and position in one look |
| Display face | Bahnschrift, then DIN Alternate, Avenir Next Condensed, Franklin Gothic Medium, Arial Narrow | Signage lettering, present on Windows and macOS. Nothing is downloaded |
| Body face | Segoe UI Variable Text, Segoe UI, system-ui | Long technical messages need a plain reading face |
| Code | ui-monospace, Cascadia Mono, Consolas, Menlo | Agents quote commands and file names constantly |
| Speakers | Builder teal, reviewer violet, the person in the signal color, as a rule down the left edge of each message and on the name | Who is speaking is read before the words |
| Signal color | Burnt orange, used only for what needs the person, a halted unit, and lost contact | One color means "look here" |
| Motion | A ring on the unit in progress and a brief wash on a new message. Both stop under reduced motion | The page should look alive only where something is happening |

## Palette and contrast

Measured against the page background of each mode. All text pairs meet 4.5 to 1.

| Role | Light | Ratio | Dark | Ratio |
| --- | --- | --- | --- | --- |
| Page | `#F4F1EA` | | `#151410` | |
| Surface (code, selects) | `#FFFDF8` | | `#1F1D18` | |
| Text | `#1C1B18` | 15.27 | `#F1EDE3` | 15.76 |
| Secondary text | `#5A554C` | 6.56 | `#B3AC9D` | 8.17 |
| Rule | `#D9D2C3` | | `#3A362D` | |
| Signal | `#B4420F` | 5.00 | `#F59E5B` | 8.71 |
| Builder | `#0B5C63` | 6.83 | `#62CDD3` | 9.82 |
| Reviewer | `#5A3E9B` | 7.17 | `#BDA8F2` | 8.82 |
| Done | `#1E6B41` | 5.76 | `#74DDA6` | 11.09 |
| Signal on its wash | on `#FBE9DD` | 4.78 | on `#3A2415` | 6.88 |

## Words

The page says what happened in the words a person would use. A finding is "found a problem". A closed question shows "Fixed", "Declined", "Went on with an assumption" or "Answered". A run's history becomes "finished building", "ran the project's checks: passed", "proved its new tests fail on the old code". Unit states are "Next up", "In progress: building", "Waiting, after rename", "Halted: needs you". The page never shows a run ID, a hash or a JSON field. When the person is the speaker the verb agrees: "You ask the builder of rename", not "You asks". A paused run reads "Paused while building" and loses its ring.

## Safety choices that shape the page

- Everything an agent wrote is placed with `textContent`. Words between backticks are shown as code. Nothing an agent writes is parsed as markup or run.
- The page loads nothing from outside: no font, script, stylesheet or image. A content security policy says so and a test reads the page for it.
- The server binds to 127.0.0.1, answers only GET and HEAD, and refuses a request whose Host is not the local address. The address of a request is compared as it was sent and never parsed, so no request can make the server fail.
- Characters that reverse the text after them are dropped before text is shown, so a goal or a message reads in the order it was written.
- Before it listens, the hub checks that nothing on this machine already answers on the port under either local address. On Windows a second listener on 127.0.0.1 is allowed beside one on every address and would take its local traffic.

## What was rendered and checked

Rendered against a finished trial project with eleven real messages, at 1280 and 375 pixels wide, in light and dark:

- No sideways scroll at 375 pixels.
- Heading order: one h1 (the goal), then h2 for each of the three sections.
- The first focus stop is "Skip to the conversation".
- The first render put "Activity" above the conversation on a phone, which pushed the main event down a full screen. The sections were reordered so the page reads: waiting on you, conversation, activity.
- The clock first showed "12:54:24 PM", which wrapped the message number onto a second line. It now shows 24-hour time.

Then watched during a live run with a builder session and a reviewer session.

## What an independent review found

A reviewer that had not built the hub read the code, sent it hostile requests and broke it on purpose to see which tests noticed. It reported twelve problems; each was fixed and has a test that fails without the fix.

| Found | Now |
| --- | --- |
| One request with an address that cannot be parsed stopped the hub | The address is compared as sent; anything else is "not found" |
| When the shown queue changed, the first queue's messages stayed on the page | A different queue starts the page's lists again |
| With several queues open the page showed the last one created | It shows the one being worked, then a halted one |
| "Waiting on you" listed the person's own unanswered question | Only what an agent asked the person; nothing in a cancelled queue |
| Three sections were rebuilt on every poll, dropping focus and any selection | A section is redrawn only when what it shows changed; an unchanged state is answered with "not modified" |
| A new item waiting on the person was announced only in the tab title | A status line says "2 items now wait on you" to a screen reader |
| The tests did not pin what the server exposes or run the page's script | Exact headers and bound address are asserted; the script runs in a small browser against hostile text |
| A long message could be cut inside a character; one stray backtick turned the rest into code | Cut between characters; a backtick without a partner is shown as it is |
| `cyc hub status` and stray options started the hub without a word | Refused, naming what is not accepted |

The review also confirmed what held: no text an agent writes is run, the Host check, path handling, oversized and stalled requests, and the read-only claim.

## Not built

- Answering a question or deciding a halted unit from the page. That is the next step, and it is where the hub stops being read-only.
- Files changed and check output per unit.
- A notification when something starts waiting on the person while the page is in a background tab. The tab title carries the count and a screen reader is told; nothing else reaches a person who is looking elsewhere.
