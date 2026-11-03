# Generic tells

This is the page a model writes when nobody tells it otherwise. Learn it so you can recognize it in your own output. Score a rendered page by counting the tells present. Three or more: the page is generic, and the repair is a different decision, not a different color. One or two: fix them before extending the treatment.

## The default page

Layout

1. Centered hero: headline, one-sentence subhead, two buttons (filled and outline), everything centered, nothing else in the first viewport.
2. Three equal cards in a row, each with an icon in a tinted circle, a bold title and two lines of text. Repeated as "features", "services" and "why us".
3. Every section built the same way: the same max-width container, the same vertical padding, a centered heading and centered subhead, then a grid.
4. White and light gray (`#f9fafb`, `#f3f4f6`) alternating as the only rhythm.
5. A testimonials row of three quote cards with avatar circles, and a stats row of four numbers nobody measured (10k+, 99%, 24/7, 4.9 stars).
6. A footer with four link columns and a copyright line, however small the site.

Type

7. Inter, Roboto, Poppins, Montserrat, Open Sans or `system-ui` for everything, including the display size.
8. Display text at 36 to 48 px with default letter-spacing and line-height 1.2, so the headline reads as large body text.
9. Every heading at the same weight (700) and the same color. No eyebrow label, no italic or secondary voice anywhere.
10. Centered text everywhere, including paragraphs.

Color and surface

11. A blue, indigo, teal or violet accent (`#2563eb`, `#6366f1`, `#14b8a6`, `#8b5cf6`), or a two-stop gradient of two of them, on buttons, icons and a highlighted headline word.
12. Pure white canvas (`#ffffff`), gray text (`#6b7280`) and gray borders (`#e5e7eb`).
13. Border-radius 12 to 16 px and a soft drop shadow on every box; cards inside cards.
14. A gradient blob, glass panel or mesh background behind the hero.

Imagery and copy

15. Emoji as icons, or several icon sets at different stroke widths.
16. A category illustration (a cup, a camera, a house outline) stretched to hero size, or a stock-style photo unrelated to the copy.
17. Headlines that could head any business: "Welcome to [Name]", "Quality you can trust", "Your journey starts here", "Crafted with care", "Elevate your experience".
18. Placeholder specifics: "123 Main Street", "John Doe", "$99/month", "Since 1995", "Lorem ipsum".
19. A pill badge above the headline reading "✨ Now live" or "New".
20. The phone layout is the desktop layout stacked: hero text still centered, the three cards now three tall cards.

The opposite failure, which the first twenty tells do not catch

21. Wall of text: no photograph, rendered object, illustration or color surface at least a quarter of the viewport wide in the first two viewports; sections are type and hairlines on one flat canvas. Good typography does not rescue this; the page reads as a document.
22. Flat page: every section sits on the same canvas with the same content column; no full-bleed band, no panel, no change of surface for item-like content.

## Escaping each tell

Each row is a different decision, not a style.

| Tell | Replace with |
| --- | --- |
| 1 Centered hero | An archetype from the [catalog](layout-archetypes.md): a split whose image bleeds to the viewport edge, a full-bleed scene with type set into its quiet area, a typographic poster, a tool-first opening |
| 2, 3 Equal cards, identical sections | Structure that follows the content: a numbered process as a vertical index list with large numerals; a menu as a two-column price list with hairline rules; work as an editorial grid with one hero item; a comparison as a real table |
| 4 Gray and white alternation | Rhythm by density and surface: one dark or deeply colored section, one full-bleed image band, one quiet text-only section at a narrow measure |
| 5 Invented stats and quotes | Specific proof: a real menu with prices, a named project with its brief, a plan table with actual limits. Or nothing |
| 6 Four-column footer | A footer proportional to the site: one line with the address, hours and a contact, or a short two-column band |
| 7 to 9 One sans, one weight | A named pairing from [typography](typography.md): display face plus text face plus an eyebrow style; display at 56 to 96 px on desktop with negative tracking; one italic or handwritten accent phrase |
| 11, 12 Blue accent, white and gray | A palette derived from the subject ([color](color.md)): tinted canvas, deep brand color, one warm or cool accent, ink that is not pure black |
| 13 Rounded and shadowed | One surface system: hairline borders on a tinted canvas, or flat color blocks, or sharp corners. Shadows only on things that float |
| 15, 16 Emoji, category clip art | One icon set at one stroke width; photography chosen for a specific subject and cropped for the layout; or no imagery and strong type |
| 17, 18 Generic copy | Copy made of this business's nouns: the roast, the street, the neighborhood, the service radius, the dish, the camera body, the venue |
| 19 Pill badge | An eyebrow label that says something ("Open 6:30 to 15:00 · Roasting Thursdays") |
| 20 Stacked phone | Recompose per archetype: the image gets its own crop, the action comes before the explanation, lists become a compact rhythm |
| 21 Wall of text | Material from [visual material](visual-material.md): a sourced photograph stored locally, the product rendered as an object (a board, a ticket, a screen), an illustration with depth, texture on the brand surface |
| 22 Flat page | One full-bleed image or color band, a tinted panel behind item-like content, a dark section with the demonstration in it |

## Score sheet

Record this in the run evidence for the signature section and for the finished page, at desktop and phone width:

```text
View: desktop 1440 | phone 390
Tells present: [numbers]   Count: N   Verdict: pass (<3) | fail (>=3)
Material: [kinds present, largest non-text element as % of viewport width in viewports 1 and 2]
Changed decisions: ...
```

Counting is deliberate. It stops "it feels fine" from passing a page a reviewer recognizes as default at a glance. Tell 21 alone fails the page: a document with a good headline is still a document. The count is a self-review, not a measurement of quality; a page can score zero and still be weak, which the [experience review](experience-review.md) exists to catch.
