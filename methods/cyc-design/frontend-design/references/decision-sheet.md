# Decision sheet

Keep this as `design/decisions.md` in the project. Fill the inventory and the model before any markup. Choose the look before styling. Add the measurements after the first render. Every field holds something a reviewer could check against the rendered site. “Warm and modern” is not a value.

On a handoff or resumed build, open the sheet at **Study decision**. It names the entry in the [frontend field guide](field-guide.md), the project material and the expected behavior. If an older sheet predates these fields, add the decision for the current composed change using the brief and existing assets. Reuse it through Build and Verify. A narrow repair can use the existing task evidence and stay within its original scope.

## Template

```markdown
# Design decisions: <project>

## Inventory
Visitors and jobs: <who arrives, first visit or return, what each came to do>
Pages: <the requested pages, views or in-place states; the job of each>
Records: <the kinds of thing a visitor chooses between, how many of each, and the facts shown on every one>
Visual evidence: <scene, comparable pictures, product example or legible records; source and rights for any media>
Working journey: <the task, its steps, what the visitor sees at the end; the empty state and the error state; what is local or demo>
True now: <what the site computes from data: open or closed, next date, availability, turnaround>
Proof: <specific and checkable; or none>
Data: <the file that holds the records; which facts are real, which are invented for this brief>

## Model
Site model: <one or two from reference-standards.md> because <the visitor's job>
Patterns: <from patterns.md, by name: the opening; header; items; trust; phone>
Study decision: <field-guide chapter and practice> → <visitor question> → <specific asset, record or control and where it appears>
Through the click: <selection or criteria and next state; what survives returning or closing; keyboard or other access need>
First screen holds: <header rows; the task entry or the items; what is true now>
One item is built as: <name, deciding facts and action; picture when it helps someone choose>
Section order: <home page, top to bottom, each with its job>
Phone pattern: <what stays within reach; how the items recompose>
Without this method I would have built: <one line: the opening, the sections, the page count>
What a visitor can do here that they could not do there: <one line>

## Look
Brand: <existing identity and assets, or "none supplied">
Canvas: <white, warm tint or dark; hex values for canvas, ink and muted text> because <a reason from this subject>
Type voice: <one voice from typography.md; the families and the job of each; headline size, weight and tracking, or "no headline"> because <reason>
Corners: <radius for controls; radius for pictures> because <reason>
Color source: <one from color.md; the action color's hex and its jobs; any second color and its jobs> because <reason>
Signature move: <one or two details taken from this subject; where each appears, at least three places>
Against the unguided look: <how this canvas and type voice differ from a cream canvas under a serif headline, or the brand that sets both>
Contrast: <measured pairs for the text, the action and the control cues in use>
Spacing: <the scale; section padding>

## Measurements
First screen (desktop 1440, phone 390): <paste the judge's lines, or link design/first-screen.json>
Study check: <route, viewport and what you actually saw or operated; selected item/state after the click and on return; repair and recheck or observed limitation>
Tells present: <numbers from generic-tells.md> · Count: <N>
Rejection condition: fail if <what this visitor could still not find or do>
Access: <the judge's access lines for each page; the marked and hidden screenshots behind them for text on photographs; how the main control is named, reached and used by keyboard; what was checked by hand>
```

## Example of the level of detail: a neighborhood café

This shows how specific each line should be. It is not a design to reuse; another café has different visitors and a different menu.

```markdown
# Design decisions: Halvard Coffee, Ballard

## Inventory
Visitors and jobs: a regular checking today's hours and this week's filter coffees before walking over; a newcomer deciding whether to come; someone ordering ahead for pickup.
Pages: Home (what is on today and the way in to ordering); Menu (drinks and food by category, with prices); Beans (the week's roasts to buy, with origin and notes); Order ahead (build a pickup order); Visit (hours by day, map, parking, the roasting schedule).
Records: 14 drinks (name, size, price), 8 pastries (name, price, baked today or sold out), 5 beans (origin, process, notes, price per 250 g, roast date). 27 records, all shown with their facts.
Visual evidence: the counter in morning light, full width, as the opening; every pastry and every bag photographed straight on against the same pale wall, 13 in all, three of them in the first screen; stock photographs under a free license, listed in assets/SOURCES.md as placeholders.
Working journey: Order ahead. Pick items → choose a pickup time from the slots left today → review → confirmation with the order and the time. Empty state: "Nothing in your order yet" with the three most ordered drinks. Error: a slot that filled is named and the next two are offered. Demo: the order is kept on this device and nothing is charged, stated on the review step.
True now: open or closed with the closing time, from the hours table; the next pickup slot; which pastries are sold out; days since roast for each bean.
Proof: the roast date on every bag; the price on every item. No testimonials.
Data: data/menu.json and data/hours.json. Every item, price and hour is invented for this brief.

## Model
Site model: Store, because most visitors come to see what they can get today. The order page takes its item from the Finder.
Patterns: Hero photograph with the task on it; Items under the hero; Context row; Header that stays; The picture is the card; Three facts under the picture; Practical line under the button; Bottom bar.
Study decision: Catalog and pickup / Make timing a way to narrow the catalog → Can I collect coffee before my train? → show the next available slot from the hours data beside Order ahead. The counter photograph shows the shop at work; keep the time legible on a solid panel on the phone.
Through the click: selecting 9:40 carries the time into review beside the drink; Back keeps the slot if still available. Closing the time chooser restores focus to the slot control.
First screen holds: a context row (Open until 3:00 pm · Ballard Ave · next pickup 9:40); a header with Menu, Beans, Order ahead, Visit; this week's three filter coffees as items with origin, notes and price; "Order ahead" as the one filled button.
One item is built as: a square photograph, the name, one gray line of facts (size and price, or origin and process), and an Add button on the order page.
Section order: today's filters → the pastry case with sold-out states → roasting Thursdays, with the date of the next roast → menu by category → hours by day and the map.
Phone pattern: a fixed bottom bar with Menu, Order and Visit; the context row stays at the top; items go two across.
Without this method I would have built: a cream page with a serif slogan beside one illustrated cup, a strip of three facts, six menu cards and a contact block, on one page.
What a visitor can do here that they could not do there: see what is on today with prices, and place a pickup order for a time that is still free.

## Look
Brand: none supplied.
Canvas: white #ffffff with ink #1c1917 and muted text #57534e, because the pastries and the bags are the color and need a clean counter under them.
Type voice: quiet. One family, Figtree. "This week at the counter" at 56 px bold on the opening photograph of the counter at 7 am, with "Order ahead" and the next pickup slot on a white panel; interface 13 to 16 px, section titles 28 px semibold, because the coffees carry the page once the photograph has set the morning.
Corners: 12 px on pictures, full pills on buttons, because the cups, lids and stickers in the shop are all round.
Color source: the photographs. One roast brown #7c2d12 for the Order button, the selected slot and the wordmark.
Signature move: the roast date as a round ink stamp, tilted, on every bag photograph, on the order confirmation and beside "roasting Thursdays".
Against the unguided look: a white canvas, not cream, and one sans family with no serif headline.
Contrast: ink on canvas 17.4:1; white on the brand color 9.3:1; the gray facts line #57534e on white 7.6:1.
Spacing: 4 px scale; 64 px between sections.

## Measurements
First screen: desktop pass 19 actions, pass 4 pages linked, pass 4.2 screens, pass 5 pictures, pass canvas #ffffff with the headline in Figtree; phone pass 9 actions.
Study check: /order, phone. Chose 9:40 by keyboard. Review showed the drink and 9:40; closing the chooser returned focus to the time button.
Tells present: none · Count: 0
Rejection condition: fail if a visitor cannot tell what is on today or cannot finish a pickup order on a phone.
Access: no access FAIL on any of the five pages; four menu photographs carry alt that names the cup and the pour. "Order ahead" is the second tab stop after the skip link; slots are radio buttons with the time as the label; the filled-slot error is tied to the group and read on change.
```

The numbers in the example's Measurements block illustrate the format. Record what the judge prints for the real page.

## Several sites in one request

Fill this before building the first site. No two rows share a model, an inventory and a journey, and no two share both a canvas and a type voice.

| Site | Visitor's job | Model | Records | Working journey | Canvas and type voice | Without the method |
| --- | --- | --- | --- | --- | --- | --- |
| Café | See what is on today, order ahead | Store | 27 menu items and beans | Pickup order with time slots | White, quiet | Slogan and a cup |
| Home repair | Get a visit booked for a problem today | Front door over Finder | 18 jobs with price ranges and response windows | Problem → zip code → window → confirmation | White, light | Slogan and three service cards |
| Photographer | Judge the work for a commission | Campaign | 6 projects, 60 photographs with captions | Filter by kind of work, open a project, send an inquiry | Dark, display on photographs | One hero photo and a quote |
| Meetup | Decide to come to the next event | Gathering | 10 upcoming and past events, 12 speakers | RSVP for a dated event | Warm tint, heavy | Slogan and three feature cards |
