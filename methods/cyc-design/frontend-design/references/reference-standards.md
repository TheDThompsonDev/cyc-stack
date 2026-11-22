# Site models

Eight production sites that the project's owner holds up as the bar were studied on 2026-11-21. Each stands here for a site model: a way of organizing a site around what its visitor came to do. They are described by that job, not by name. Choose the model by the visitor's job, take its anatomy, and fill it with the project's own inventory, pictures and look.

## What was measured

Public home pages, signed out, with the [probe](../scripts/first-screen.mjs) in a desktop browser at 1440 × 900 and a phone browser at 390 × 844. Actions are the links, buttons and form controls visible in the first screen. Pages linked are the other pages on the same site that the home page links to. Pictures are images, video and drawn graphics at least 80 px on each side, and the last column is how much of the first screen the largest one covers.

| Model | Actions, desktop | Actions, phone | Pages linked | Height in screens | Pictures, desktop | Largest picture | Pictures, phone | Canvas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Finder | 43 | 28 | 212 | 4.9 | 22 | 2% | 9 | white |
| Store | 25 | 14 | 58 | 6.9 | 8 | 42% | 4 | white |
| Campaign | 29 | 19 | 138 | 5.9 | 4 | 84% | 4 | white |
| Front door | 23 | 9 | 111 | 4.9 | 4 | 53% | 2 | white |
| Product showcase | 14 | 12 | 60 | 5.2 | 6 | 44% | 1 | white |
| Working surface | 88 | 16 | 291 | 1 (app shell) | 19 | 21% | 6 | near-black |
| Proof-led service | 15 | 7 | 20 | 8 | 1 | 86% | 0 | warm cream |
| Gathering | 19 | 7 | 7 | 6 | 1 | 29% | 1 | dark navy |
| Bike shop, generated without the method | 7 | 4 | 0 | 2.3 | 1 | 27% | 1 | cream |
| Barbershop, generated without the method | 9 | 7 | 0 | 8.3 | 3 | 26% | 3 | cream |
| Barbershop, earlier method that counted actions only | 36 | 26 | 5 | 3.6 | 1 | 9% | 0 | white |

The generated pages show the two ways to miss. The pages built without the method each had a large photograph and little to do: one page, nothing linked, under twelve things to act on. The page built with an earlier version of this method had six working pages and a booking a visitor could finish, and one small photograph. The owner judged it worse than the page built without the method. Substance without something to look at fails the bar, and so does a good-looking page with nothing to do.

The [floor](../SKILL.md#step-4-build-the-first-screen-and-the-journey-then-measure) sits just under the lowest studied site on each count that separated the groups: things to act on, pages linked, height, and pictures. Every studied desktop first screen held four or more pictures or one covering over a quarter of it. One studied phone page opens on text and a button with no picture, so the phone count is reported without a verdict.

A second visit the same day gave different counts on sites that load content as the visitor scrolls or that test variants: 50 actions and 2.6 screens on the finder, 35 actions and 2.3 screens on the store, 18 actions under a different headline on the product showcase. On both visits every site had at least 14 actions on a desktop, 7 on a phone, 7 pages linked, and pictures at or above the floor. Page height did not hold steady, so a first screen with twice the floor of actions is not judged on height.

Limits: two visits per site on one day, signed out, United States content. The store was read through a verification screen, so its anatomy below is the least certain. Record counts depend on how a page is built. Read the numbers as the gap between these sites and a generated page, not as targets to reach.

## Finder

The visitor came to find one option among many.

- **First screen:** no slogan. A header with five category tabs, each with a small illustrated icon. One pill-shaped search bar split into where, when and who, with a round button in the brand color. Then two full rows of real items.
- **One item:** a near-square photograph with 20 px corners, a status pill at the top left, a heart at the top right, a 13 px title, and one gray 12 px line with the total price and the rating. No box around it. Seven across at 1440.
- **Down the page:** more rows, each named for a place and often a time from the visitor's own area, each with an arrow to the full set.
- **Results page:** the list beside a map that stays put, price pills as map pins, the search restated in the header with a Filters button, and the count as the heading.
- **Phone:** one full-width search pill, categories as chips, rows that scroll sideways with the next item cut off, and a bottom bar.
- **Look seen with it:** white canvas, quiet type voice, soft corners, color from the photographs.

Use it when the site's worth is the number and quality of its options: stays, homes, cars, classes, tradespeople, restaurants, jobs.

## Store

The visitor came to buy from a catalog, here or today.

- **First screen:** a pinned header 80 px tall with categories, deals, pickup and delivery, a wide search field that asks a question, and the account. The delivery postal code and the nearest store are in the header. Then this week's offer and a grid of category pictures, six across.
- **One item:** a square picture with the name under it.
- **Buttons:** full pills, 40 to 44 px tall, in the one brand color.
- **Look seen with it:** white canvas, quiet type voice with 29 px section headings, pill corners, one saturated brand color.

Use it when visitors already know roughly what they want and the questions are where, when and how much: grocery, hardware, pharmacy, a café menu, a parts counter.

## Campaign

The visitor came to see a collection and choose a style.

- **First screen:** a bar of rotating offers, tabs for sister brands, a centered wordmark with search to the right, and nine plain category words in one row. Then one photograph of people in the product, edge to edge, with the offer set on it in display type and pill buttons on it that name where they go.
- **Down the page:** tiles two and four across, each a photograph with the price large, the product name underlined and the old price. A band of repeated words separates sections.
- **Category page:** the heading with the count, a same-day pickup switch as the first filter, collapsed filter groups, and a grid three across.
- **One product:** a portrait photograph, a saving tag on one corner and a heart on the other, a small status line, the name, the old price struck through beside the new one, and the deal name in the sale color.
- **Phone:** a row of six header icons, the grid two across, and category and filter pills that stay pinned.
- **Look seen with it:** white shop with a seasonal campaign palette, display type on photographs, square pictures with pill buttons.

Use it when the product is chosen by how it looks on someone: clothing, furniture, beauty, a portfolio, a venue.

## Front door

The visitor came either to resume a task or to explore an offer.

- **First screen:** a one-line trust statement above the logo. Six plain product names, three icon utilities and sign-in. A band directly below with the sign-in fields visible. Then one full-width landscape photograph with a white panel on it: a light 40 px headline, one sentence that removes the main fear, and one button.
- **Down the page:** a row of topics that switches the content and stays pinned. Three starting points, each a small flat illustration, a heading, one sentence and one link. Alternating picture and text panels on pale gray. The mobile app shown as a real screen.
- **Product list page:** every product built identically with its picture, a who-it-is-for tag, checkmarked facts and two ranked buttons, with a compare box, pinned filters and a count.
- **Phone:** the picture first, then the panel below it at full width; sign-in becomes one header button.
- **Look seen with it:** white canvas, light type voice, nearly square corners, one brand color for every link and button.

Use it when returning customers and new ones arrive at the same address: a bank, an insurer, a clinic, a utility, a school, any business with accounts or bookings.

## Product showcase

The visitor came to judge whether software fits.

- **First screen:** navigation on the left, the mark centered, account and one pill button on the right. One centered headline at 80 px, one sentence, two pill buttons the same size. Then the real product in a large frame, moving, starting inside the first screen and running off the bottom.
- **Down the page:** each section is one large heading, one live picture of the product, then three short columns of a bold line and a gray sentence with no boxes. Connected tools shown by name with a count. Customers as a row of tiles. The page closes on the headline size and buttons it opened with.
- **Pricing page:** customer marks under the headline, a period switch with the saving, plans grouped into two panels, each plan as five lines, one plan dominant.
- **Phone:** the headline at 40 px, the two buttons side by side, and the main button always in the header.
- **Look seen with it:** white canvas, large grotesque voice, pill buttons, no brand color: color comes from artwork behind the product.

Use it when the product is a screen: software, an app, a dashboard, a developer tool.

## Working surface

The visitor came to use the product, signed in or not.

- **First screen:** the product itself. A top bar with home, a search field that asks a question, and sign-in as a filled pill. Rounded panels on a darker page: a library with helpful empty states, then shelves of content with a heading and "Show all".
- **One item:** a square cover with a title and one gray line. People are circles.
- **Offer:** one bar pinned to the bottom edge in a gradient used nowhere else, with one button.
- **Browse page:** a grid of flat colored category tiles, four across.
- **Phone:** the mark and one pill in the top bar, a bottom bar with four destinations, shelves that scroll sideways.
- **Look seen with it:** near-black canvas, quiet type voice in two weights, pill buttons, color from the content.

Use it when the site is the tool: a player, an editor, a tracker, a booking desk, a catalog people work in daily.

## Proof-led service

The visitor came to decide whether a service can deliver.

- **First screen:** navigation in its own floating pill, with a separate filled button. An eyebrow listing the steps of the service. A serif headline about the visitor's situation with one handwritten phrase. Three plain sentences. A filled 56 px button and an outlined one. Three reassurances with icons. On the right, a photograph of a person doing the task, run to the edge and faded into the canvas, with pieces of the real product laid over it.
- **Down the page:** the real product in a frame on a dark band. Examples labelled as examples. Four numbered steps. Plans with one made dominant and a row that removes risk.
- **Tool page:** a sample result beside the headline, and one practical line under the button.
- **Phone:** a shorter headline, a full-width button, the steps as a two-by-two grid.
- **Look seen with it:** warm cream canvas, editorial serif voice, a deep color with a warm accent, small radii.

Use it when a person is hiring judgment or skill: a consultancy, a clinic, a tutor, a repair or building trade, a salon, a studio.

## Gathering

The visitor came to decide whether to join something that has a next date.

- **First screen:** a pinned, slightly see-through header with the join button always visible. An eyebrow naming the place. A very large headline that asks the visitor a question, with one word on a block of the brand color. A specific paragraph: who comes, how often, what it costs. Two buttons. One line of proof with a number. A photograph of real members run to the edge, and the next event as its own card with date, time and one button.
- **Down the page:** four ways to take part as four verbs. Three numbers with labels. A named testimonial. Sections that each pair a small handwritten label with a large factual heading. Photographs with an offset block shadow and handwritten captions. A directory of faces.
- **Phone:** the photograph first, then the headline at 52 px, with the two buttons side by side.
- **Look seen with it:** dark canvas, heavy type voice with handwritten labels, soft corners, one bright brand color used in fields.

Use it when the offer is people and a date: a meetup, a club, a class series, a congregation, a league, a venue with a calendar.

## The opening, whatever the model

The anatomy above describes observed pages. Borrow the part that answers this visitor’s question. The dealership owner preferred the car photograph with search on it and real vehicles immediately below. A stay finder can lead with editable criteria and comparable options, and a working application with the records themselves. See the [field guide](field-guide.md) for the associated behavior, access needs and phone decisions.

## Combining two

Where two kinds of visitor start in different places, put one model's opening above the other's. A front door's returning-task band sits well above a finder's search or a store's offer. A gathering's next-event card sits well inside a proof-led service's first screen. Take the item anatomy from the model that owns the records.
