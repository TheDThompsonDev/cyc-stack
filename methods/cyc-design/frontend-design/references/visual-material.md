# Visual material

A page made only of type and hairlines is a document, not a website. Every site held up as the bar carries visual material in every viewport: a photograph with a person in it, a product screenshot in a frame, a technician at a door, a ring chart beside a photo card. "No imagery and strong type" is a valid opening for one viewport; it is not a valid page. This reference says what counts, how much, and how to get it when the brief says local only.

## The density rule

Measured on the desktop render, checked again on the phone:

- In each of the first two viewports, at least one non-text element at least 25 percent of the viewport width: a photograph, an illustration with depth, a rendered object (a ticket, a menu board, a map, a product panel), or a color surface holding content.
- Across the full page, at least three kinds of material from the list below, and at least one full-bleed band (image or color) that breaks the content column.
- No run of more than two consecutive sections that are text on the flat canvas.

A page that fails this is tell 21 on the [generic list](generic-tells.md) however good its type is.

## Kinds of material, strongest first

| Kind | What it does | Local-only path |
| --- | --- | --- |
| Photograph with a subject | Puts a person, a place or the work in the room; the single biggest difference between a site and a document | Download under a permissive license and store in `/assets` with source and license noted (below) |
| Product or interface rendered as an object | A ticket, a chalkboard, a receipt, a schedule card, an app screen in a device frame; proves the thing exists | Build it in HTML and CSS with the page's own tokens; it is content, not decoration |
| Illustration with depth | A scene, not an icon: layered shapes, a horizon, shadow, texture, a drawn object at the size it would be | Inline SVG of 40 or more paths, or a generated bitmap when an image tool is available |
| Color surface holding content | A dark band, a brand block with a list inside it, a panel behind a form | CSS only; one dark band per light page, plus tinted panels where content is item-like |
| Texture | Paper grain, a subtle noise, a halftone, a printed-ink edge; makes flat color feel like a material | CSS: an SVG `feTurbulence` filter at 4 to 8 percent opacity, or a repeating gradient; never a stock "mesh" blob |
| Map or diagram | Where the place is, how the process runs | Inline SVG drawn from the real streets or steps |
| Data drawn as a mark | A ring, a bar, a sparkline beside a number | Inline SVG, sized to the number it explains |

Icons are not material. A row of icons in circles is tell 2.

## Getting photographs when everything must stay local

"Local" means the site runs without a server and without hot-linking. It does not mean the build may not fetch an asset once and store it.

1. Search a permissive source. Wikimedia Commons answers without a key and returns the license with each file (checked 2026-11-02): `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<subject>&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata&format=json`; read `LicenseShortName` and keep CC0, CC BY and CC BY-SA with attribution. Openverse (`https://api.openverse.org/v1/images/?q=<subject>&license=cc0,by`) is a second source when reachable; it was not from the checking machine. The project's own asset folder comes first when it has anything usable.
2. Pick for the composition, not the subject alone: where is the quiet area for text, is the subject sharp, does the light match the palette temperature. Reject anything that looks like a stock handshake. Open the downloaded file at full size and look for a watermark, a photographer's logo, a border or a caption baked into the pixels; a mark that is faint in a thumbnail is obvious across a full-bleed band, and a second copy of the same photograph on another host may carry it too.
3. Fetch the file into `/assets/<name>.jpg`, resize to the largest displayed width (1600 px is enough for a full-bleed), and write `/assets/SOURCES.md` with the URL, author and license for each.
4. Set `width`, `height` and `object-position` for the desktop and phone crops, and one treatment for every photograph on the site (warm, duotone, hairline, untouched).

When an image-generation tool is available in the host, use it for a specific brief ("a two-group espresso machine on an oak counter, morning light from the left, quiet space on the right third") and store the result the same way. When neither is possible, say so in the decision sheet and compensate with rendered objects and illustration with depth, not with more paragraphs.

## What this looked like when it went wrong

A café page built under a "no external images" instruction chose the typographic poster, set a fine headline and a menu as an index list, and shipped nothing but text and rules from top to bottom: no counter, no bread, no board, no room. It scored zero on the original tells and still read as a document. The fix was not a photograph alone; it was a chalkboard rendered as a dark panel for the day's board, a photograph of the counter bleeding off the right edge, a drawn map in the footer and a textured brand band behind the order form.
