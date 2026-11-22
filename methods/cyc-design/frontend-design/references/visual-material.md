# Visual material

Choose the material that reveals the subject. A meetup can use a single shared gesture. A fit guide can use several comparable photographs. A working calendar can communicate its most important relationship through dates, titles and their positions. Use the density check below for a page whose promise depends on showing the work.

## What the studied sites show

Every one of the eight studied sites fills its first desktop screen with pictures: rows of item photographs, one photograph run to the edge of the screen, or the product itself. The method's [floor](../SKILL.md#step-4-build-the-first-screen-and-the-journey-then-measure) is four pictures in the first desktop screen, or one covering a quarter of it.

- **Photographs are of real people and real things:** the listings, the members, the clothes on people, the product, a person doing the task. Not a symbol of the category.
- **A set is framed alike:** the same shape, the same distance, the same kind of background across every item.
- **Show the differences a visitor judges.** Give people, products or places comparable photographs when appearance matters. For a record chosen by timing or status, show that information directly.
- **The opening photograph runs to an edge** of the screen, or fills its width. It is not a small rectangle in a side column.
- **Quality decides.** One well-lit, well-composed photograph does more than five dim or cluttered ones. Look at each picture at full size in the render before keeping it, and replace any you would not put on a real business's site.
- **Invented people.** For a fictional brief, put a photograph of the person's work on their card, such as a finished haircut or a plated dish, or use a stock portrait and list it in the handoff as a placeholder to replace. Never present a stock stranger as a named real person on a site that is going live.

## The opening photograph

When a photograph communicates the subject best, give it enough space to read at both widths. A full-width scene with the task over it worked for a dealership; a room gallery or fit comparison earns space differently. For a scene-led opening, check the following qualities.

- **One subject.** A car on an empty road, a barber mid-cut, a hand fanning a deck of cards. Not a lot full of cars or a wide shot of a room.
- **Real light.** Dusk, a window, a lit counter, a single lamp. Flat midday light and flash read as a listing photo, not an opening.
- **Room for the text.** A calm area on one side, or a darkened side through a gradient scrim, so the headline and the task panel sit on it without covering the subject.
- **Full width.** It runs edge to edge with no frame, border or rounded corners, and the header can sit over it.
- **The right subject for the business.** The thing itself in use, or the place at its best. A symbol of the category (a generic handshake, a stock skyline) does not count.

Pick it before writing the headline, look at it at full size in the render, and try two or three before keeping one. The item photographs below it can be plainer; the opening cannot.

Text on a photograph has to be read by everyone, at both widths. The judge measures it from the marked and hidden screenshots in Step 4, behind the letters themselves. Three ways to make it pass, in order of reliability:

- **A solid panel.** The task panel on the opening sits on a solid colour; it is measured like any other text.
- **A scrim where the text is.** A gradient from clear to a dark tint, 0.6 to 0.8 opacity, under the headline and fading away from the subject. Check the phone: there the text block is taller and often climbs above the scrim, as on photo tiles whose names sit halfway up.
- **The calm side.** Set the text where the photograph is already dark and even, and choose the crop at each width so it stays there.

A text shadow helps only where it lies directly behind the letters; a soft glow around them does not count.

## The density rule

Use these checks on composed pages where the material helps visitors understand the offer or work. In a task-dense interface, inspect how clearly the actual records, labels and actions communicate their relationships. Preserve the working space and keep reflow and user-selected presentations usable.

Measured on the desktop render, checked again on the phone:

- Within the first two viewports, look for a visual element at least 25 percent of the viewport width. A first screen that opens on a search or a task entry may hold none when the next screen does. A deliberately aligned group can occupy that space together when each item is legible and comparing the items is the point. Inspect the detail people need to see at actual size.
- Follow the material into the next section. A single photograph can reveal a framing decision, lead into a sequence and show what the editor contributed. Bring in a second kind of material when it adds information, such as a plan beside a finished installation. Choose full bleed when scale helps the visitor see the subject.
- No run of more than two consecutive sections that are text on the flat canvas.

A page that fails this is tell 21 on the [generic list](generic-tells.md) however good its type is.

## Kinds of material, strongest first

| Kind | What it does | Local-only path |
| --- | --- | --- |
| Photograph with a subject | Puts a person, a place or the work in the room; the single biggest difference between a site and a document | Download under a permissive license and store in `/assets` with source and license noted (below) |
| Product or interface rendered as an object | A ticket, a chalkboard, a receipt, a schedule card, an app screen in a device frame; proves the thing exists | Build it in HTML and CSS with the page's own tokens; it is content, not decoration |
| Illustration with depth | A scene, not an icon: layered shapes, a horizon, shadow, texture, a drawn object at the size it would be | Use a drawing or generated image whose composition and detail read at the intended size |
| Color surface holding content | A dark band, a brand block with a list inside it, a panel behind a form | Use a CSS background where it groups or emphasizes related content. Check its text, links and controls on that surface. |
| Texture | Paper grain, a subtle noise, a halftone, a printed-ink edge; makes flat color feel like a material | CSS: an SVG `feTurbulence` filter at 4 to 8 percent opacity, or a repeating gradient; never a stock "mesh" blob |
| Map or diagram | Where the place is, how the process runs | Inline SVG drawn from the real streets or steps |
| Data drawn as a mark | A ring, a bar, a sparkline beside a number | Inline SVG, sized to the number it explains |

Icons are not material. A row of icons in circles is tell 2.

## Getting photographs

A site that may load from the network can link photographs from a source whose license allows it, such as Unsplash, Pexels or Wikimedia Commons. Choose by how the photograph looks first, then confirm the license, and list every picture with its source in the handoff. Give each linked picture its dimensions, a description and a fallback color, and render the page once with pictures blocked.

When everything must stay local, the site runs without a server and without hot-linking. That does not mean the build may not fetch an asset once and store it.

1. Search a permissive source. Wikimedia Commons answers without a key and returns the license with each file (checked 2026-11-02): `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<subject>&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata&format=json`; read `LicenseShortName` and keep CC0, CC BY and CC BY-SA with attribution. Openverse (`https://api.openverse.org/v1/images/?q=<subject>&license=cc0,by`) is a second source when reachable; it was not from the checking machine. The project's own asset folder comes first when it has anything usable.
2. Pick for the composition, not the subject alone: where is the quiet area for text, is the subject sharp, does the light match the palette temperature. Reject anything that looks like a stock handshake. Open the downloaded file at full size and look for a watermark, a photographer's logo, a border or a caption baked into the pixels; a mark that is faint in a thumbnail is obvious across a full-bleed band, and a second copy of the same photograph on another host may carry it too.
3. Fetch the file into `/assets/<name>.jpg`, resize to the largest displayed width (1600 px is enough for a full-bleed), and write `/assets/SOURCES.md` with the URL, author and license for each.
4. Set image dimensions and choose the crop separately for desktop and phone. Protect the detail the design depends on, such as people looking at a laptop. Decide whether each group of pictures needs context, close detail or consistent framing.

When an image-generation tool is available in the host, use it for a specific brief ("a two-group espresso machine on an oak counter, morning light from the left, quiet space on the right third") and store the result the same way. When neither is possible, say so in the decision sheet and compensate with rendered objects and illustration with depth, not with more paragraphs.

## What this looked like when it went wrong

A café page built under a "no external images" instruction chose the typographic poster, set a fine headline and a menu as an index list, and shipped nothing but text and rules from top to bottom: no counter, no bread, no board, no room. It scored zero on the original tells and still read as a document. The fix was not a photograph alone; it was a chalkboard rendered as a dark panel for the day's board, a photograph of the counter bleeding off the right edge, a drawn map in the footer and a textured brand band behind the order form.
