# Frontend reference study: eight sites, practice by practice

Status: observation notes from one visit on 2026-11-21. Nothing in the frontend design method has been changed from this yet.

The owner named eight sites as the bar for frontend and experience quality. This file lists, for each one, the design choices read from the live page and the individual practices worth taking.

## How this was observed

- Each home page and one inner page were opened logged out in Microsoft Edge through Playwright, at 1440 × 900 and at 390 × 844 with a phone user agent.
- Five screens were captured down the desktop page and three down the phone page. Every capture was looked at.
- Fonts, type sizes, weights, colors, radii, shadows, button sizes, transitions and card grids were read from the browser's computed styles, not estimated from pictures.
- Captures and raw values are in `.cyc/runtime/reference-study-20261121/`.

Limits:

- One visit, one location (Texas), logged out. These sites personalize and run seasonal campaigns, so content and some counts change between visits.
- Hover, keyboard and form behavior were not exercised. Where a note depends on interaction it says so.
- Font names are the names each site serves. Three are proprietary (Airbnb Cereal, Optimist, Spotify Mix). Dallas Software Developers serves its fonts under the aliases `sans` and `handwriting`, so their real names were not readable.
- **Target was not seen.** It returned a "press and hold" human check in both browsers, and the check was not worked around. Its section holds only values read from the page code beneath that check.
- Announcement and sign-up popups on Airbnb and American Eagle were closed with their own close buttons. Cookie banners were left alone and cover the bottom of some captures.

## Capital One

Pages: home, and Credit Cards.

Design choices

- **Font:** Optimist, one family, in three weights: 300, 400 and 600.
- **Headlines are light, not bold:** 40 px at weight 300 for the hero and section headings, 32 px at 300 for column headings, 24 px at 300 for sub-points.
- **Body:** 16 px at 400 with a 1.5 line height. Labels are 12 to 14 px.
- **Eyebrows:** 16 px at 600 in capitals with 0.5 px tracking ("FIND THE RIGHT CARD").
- **Colors:** white canvas, black and `#141414` text, one blue `#0276B1` for every link and primary button, pale gray `#F4F4F4` panels, dark gray `#3D3D3D` footer. The cards page adds green `#25810E` for its one strongest action.
- **Shape:** nearly square. 4 px on buttons and pictures, 2 px on inputs. Only the topic tab is a pill.
- **Buttons:** 48 px tall with 20 px text in the hero. 32 px tall in the sign-in band and on product cards.
- **Width:** content held to 1216 px.
- **Motion:** 0.2 s ease.

Practices worth taking

- A trust line sits above everything: the deposit insurance statement, in small type, before the logo.
- The returning customer's task is on the home page itself. A sign-in band with visible username and password fields sits directly under the navigation, with "Remember me", "Forgot username or password?" and "Set up online access" beside it.
- The offer for a new visitor comes second and does not compete: one full-width landscape photograph, one white panel on it, one headline, one sentence, one button.
- The hero sentence removes the visitor's main fear before the button: "See if you'll be approved with 100% certainty before accepting."
- Reassurance is repeated beside each action in specific terms: "in as little as 90 seconds", "with no impact to your credit score".
- Navigation is six plain product names. Search, help and locations are icons. Sign In is always the last item.
- A "Choose a topic" row switches the content below it and then stays pinned while scrolling. On a phone it becomes a pinned dropdown labelled "Topic".
- Each of the three starting points gets a small flat illustration, a 32 px heading, one sentence and one text link with a chevron. No card boxes.
- Sections alternate picture left, text right, then the reverse, on a pale gray panel. Each has an eyebrow, a heading, two lines and one link.
- The mobile app is shown as a real phone screen with four features listed around it.
- Every product on the cards page is built the same way: card art, a credit-level tag with a small bar icon, the name, three or four checkmarked facts, then two stacked buttons.
- The two buttons on a product are ranked by color and fill: filled green "Check My Eligibility" above outlined blue "Apply Now".
- A time-limited offer is marked with a yellow highlight on the single line it applies to, plus a small "Limited-time offer" tag.
- A compare checkbox sits on every product, and "All filters" with the count ("27 cards") stays pinned while scrolling.
- Footnotes and disclosures are numbered, linked from the claim they qualify, and collected at the foot of the page.
- On a phone the picture comes first and the panel with headline and button sits below it, full width.

## Airbnb

Pages: home, and search results for Austin.

Design choices

- **Font:** Airbnb Cereal, one variable family for everything.
- **There is no slogan and no large headline.** The largest visible text on the home page is the 20 to 22 px row heading at weight 600 with slightly tight tracking (about −0.02 em).
- **Body:** 14 px. Card titles are 13 px at 500. Prices and ratings are 12 px in gray.
- **Colors:** white canvas, `#222222` text, `#6C6C6C` secondary text, `#DDDDDD` lines, `#F7F7F7` header wash. The brand pink (measured `#DA1249`) appears only on the logo, the round search button and the active phone tab.
- **Shape:** soft. 20 px on photographs, 14 px on small elements, full pills for the search bar and chips, circles for icon buttons.
- **Shadows:** three faint layers on raised items (a 1 px ring at 2%, 2 px 6 px at 4%, 4 px 8 px at 10%).
- **Motion:** 0.25 s with `cubic-bezier(0.2, 0, 0, 1)` almost everywhere.
- **Cards:** 180 px wide with a 12 px gap, seven across at 1440. Photographs are nearly square (1.05 to 1).

Practices worth taking

- The page opens on the task. Search is the hero: one pill with three labelled parts, "Where", "When" and "Who", each with a gray prompt ("Search destinations", "Add dates", "Add guests") and one round brand-colored button.
- The first screen is two full rows of real listings with photographs and prices. Nothing has to be scrolled past.
- Rows are named for a place and often a time, from the visitor's own location: "Popular homes in Broken Bow", "Available in Fredericksburg this weekend".
- Every row heading is a link with an arrow to the full set, and each row has its own previous and next buttons.
- The photograph is the card. No border, no box, no shadow around the text.
- A card states exactly what is needed to compare: type and place, total price for the stay, rating. "$635 for 2 nights · ★ 5.0".
- Prices are totals with fees included, and the site says so in a small notice.
- A "Guest favorite" pill sits top left on the photograph and a heart to save sits top right, in the same spots on every card.
- The category tabs carry small illustrated icons, which give the white page its character without a hero image.
- When the page scrolls, the large search bar shrinks into a compact pill in the pinned header ("Anywhere | Anytime | Add guests").
- A skip link is the first tab stop.
- On results, the list and the map share the screen. The map stays put while the list scrolls, and map pins are price pills.
- The results header restates the search ("Homes in Austin") with a Filters button beside it, and a heading gives the count ("Over 1,000 homes in Austin").
- Results cards get larger photographs with a dot row showing more photos, then three gray lines of facts and an underlined price.
- On a phone, search becomes one full-width pill ("Start your search"), categories become a row of chips, and rows scroll sideways with the next card cut off at the edge to show there is more.
- On a phone a bottom bar holds Explore, Wishlists and Log in, with the active tab in the brand color.
- An announcement appears as a centered dialog on a desktop and as a sheet rising from the bottom on a phone, with one plain dismiss button.

## Undersold

Pages: home, Free Score, and Pricing.

Design choices

- **Fonts:** three, each with one job. DM Serif Display for headlines. DM Sans for everything else. Kalam, a handwriting face, for the one emphasized phrase in a headline.
- **Headlines:** 52 px serif in the hero, 60 to 70 px in later sections, line height about 1.0, tracking about −0.035 em.
- **The handwritten phrase** is set in mustard with a hand-drawn underline ("prove it.", "See yours, free.").
- **Body:** 17 px at a 1.7 line height. Button text is 12 to 14 px in heavy weights, 700 to 850.
- **Eyebrows:** small capitals with wide tracking in mustard-brown ("THE UNDERSOLD SCORE").
- **Colors:** warm cream canvas (`#FBFAF7`, body `#F8F5EE`), near-black green text `#171B18`, gray-green secondary text `#5C625D`, deep green `#104034` for buttons and dark sections, mustard `#EDB848` as the accent.
- **Shape:** 7 to 9 px on buttons, 999 px on chips and the navigation container.
- **Buttons:** 56 px tall in the hero, 45 to 47 px in the header.
- **Width:** about 1180 to 1240 px.
- **Motion:** 0.16 s ease.

Practices worth taking

- The hero headline names the visitor's situation, not the product: "You have the experience. We'll help you prove it."
- An eyebrow above the headline lists the four steps of the product in order, so the visitor knows the path before reading on.
- The three sentences under the headline state the problem with competing tools and the difference, in plain words.
- Two buttons with different weights: a filled 56 px primary with an arrow, and an outlined "See How It Works" with a play icon.
- Three short reassurances with icons sit under the buttons: "Every bullet scored with a reason", "Baseline + rebuild yours to keep", "No credit card required".
- The photograph is a person doing the task, it fills the right side of the screen to the edge, and it fades into the canvas so the text stays readable.
- The product's own conversation is laid over the photograph as three chat bubbles: the question, the answer, the follow-up. The visitor sees what using it is like before any feature list.
- The second section shows the real product in a browser frame, on a dark green band, and says so: "A compact tour of the real product".
- Every made-up example is labelled where it appears: "Illustrative fictional score", "Illustrative synthetic career examples".
- The site states its own limits in the hero: it is in open beta and may have rough edges.
- The Free Score page shows the result before asking for anything: a sample scorecard with a gauge, three counted categories and the reason one line scored low.
- Under the main button, one small line answers the practical questions: what is free, no credit card, which file types.
- The process is four numbered steps with one icon each.
- Pricing has a two-way toggle, three plans, and one plan made dominant with the dark green fill, a mustard button and a labelled tab.
- A row under the pricing heading removes risk: "No credit card for Free", "Cancel anytime", "Your work stays yours".
- The navigation sits in its own floating white pill, separate from the logo and from the filled call to action.
- The privacy banner is titled "Your privacy, your call", analytics are off until allowed, and Decline and Allow are the same size.
- A skip link is the first tab stop.
- The phone page has its own shorter headline, a full-width 56 px button, the four steps as a two-by-two grid, and a before and after toggle that shows a score going from 3 to 8.

## Dallas Software Developers

Pages: home, and Meetups.

Design choices

- **Fonts:** a geometric sans for nearly everything and a handwriting face for labels and captions. Both are served under aliases, so their names are not recorded here.
- **Headlines are very large and very heavy:** 88 px at weight 800 in the hero, 68 px for section headings, 43 to 53 px for smaller ones, with tight tracking (about −0.06 em) and a line height near 0.95.
- **Body:** 20 px in the hero, 18 px in sections, 16 px in small items.
- **Handwritten labels:** 36 to 48 px at 600, in yellow or a section color ("Meetups", "Cohorts", "Next up").
- **Colors:** dark navy canvas `#0B1318`, off-white text `#F7F7F1`, blue-gray body text `#CBD2D7`, one yellow `#FFCA23` for primary buttons and the highlighted words. Each activity also has its own icon color.
- **Shape:** 10 to 13 px on buttons, cards and photographs.
- **Buttons:** 45 to 50 px tall, 14 to 15 px text at 800, dark text on yellow.
- **Signature details:** a 5 px solid yellow offset shadow behind photographs, a torn-paper edge on one band, tilted photo collages with handwritten captions.
- **Width:** 1296 px. **Motion:** 0.3 s ease.

Practices worth taking

- The headline is a question to the visitor: "What are you building?", with the key word on a yellow block in dark ink.
- The paragraph under it is specific and plain: who comes, how often, that it is free, that there is pizza, and what you might do there.
- The photograph is real members crowded round a laptop. It bleeds to the edge of the screen and fades into the canvas.
- The next real event sits in the first screen as its own white card: date, time, a link to details and one arrow button. A handwritten "Next up" note points at it.
- Proof is one line with a number: "9,500+ developers in the DSD community".
- Two buttons with different jobs: yellow "Find a meetup" and outlined "Join Discord" with the Discord icon.
- Four ways to take part are four verbs in handwriting, "Meet. Build. Speak. Give back.", each with an icon and one line.
- Three numbers with labels sum up the offer: 9,500+ members, 24 meetups a year, $0 to attend.
- The testimonial names the person, their role and which cohort they were in.
- Section headings state facts in the group's own voice: "Pizza at six. Talks at 6:45." "Six weeks to demo day."
- Each section pairs a small handwritten label in yellow with the large heading, and puts one part of the heading in yellow.
- A program is summarized as three labelled facts: duration 6 weeks, format remote, commitment 15 to 20 hours a week.
- Past speakers are a four-column directory of faces and names, sixteen on the home page, with a link to all.
- Links that leave the site are marked with a diagonal arrow, in the navigation and on buttons.
- The header is pinned, slightly see-through, and always shows the yellow "Join the Community" button.
- Every photograph has a text description, and a skip link is the first tab stop.
- On a phone the photograph comes first, then the headline at 52 px, and the two buttons sit side by side.

## Target

Not seen. These are values read from the page code beneath the human check. No practice is claimed from them.

- **Font:** Helvetica for Target, one family, at weights 400 and 700.
- **Type:** 29 px at 700 for section headings, 19 px at 700 for sub-headings, 16 px body, 12 to 14 px for small text.
- **Colors:** white canvas, `#333333` text, `#666666` secondary text, `#F7F7F7` bands, one red `#CC0000`.
- **Shape:** full pills (999 px) on buttons, 8 to 12 px on fields and panels.
- **Buttons:** 40 to 44 px tall, 16 px text at 700.
- **Header:** pinned, 80 px tall, with Categories, Deals, Pickup and delivery, a 44 px search field asking "What can we help you find?", and Account. A "Ship to" postal code and a store name are in the header text.
- **Categories:** a featured grid of square pictures, six across, 228 px wide.
- **Width:** 1400 px.

To study Target properly, the owner needs to pass the human check in the Browser pane, where the page is open.

## American Eagle

Pages: home, and Women's Loungewear and PJs.

Design choices

- **Fonts:** Avenir Next for the interface (Regular, Medium and Demi), Knockout 74 for display capitals, and Octangle for the seasonal headings.
- **Display type is very large and sits on the photographs:** 60 px for "40% OFF", 90 px for "gift guide", 36 to 48 px for prices on tiles. Knockout is tracked out by 2 px.
- **Interface type is small:** 12 to 14 px navigation and labels, 16 px body, all with 0.3 px tracking.
- **Colors:** white canvas and `#24272A` text for the shop itself. The campaign brings its own set: navy `#182C52`, deep green `#00312A`, lime `#CDF279`, cream `#F2EDE5`. Sale red `#BF0A10` is kept for deals.
- **Shape:** product photographs are square-cornered. Buttons are full pills, 50 px tall with a 25 px radius.
- **Photographs:** portrait, about 0.8 to 1, the same framing on every product.
- **Width:** promotions run edge to edge. The shop grid is held to about 1316 px.

Practices worth taking

- Photography of people wearing the product fills the screen edge to edge. The first photograph covers most of the first screen.
- The offer is written on the photograph in display type, with the buttons on the photograph too.
- Buttons name where they go, not "Shop now": "Shop Women", "Shop Men", "Shop Jeans", "Shop Deals".
- A promotion bar at the very top rotates messages and has previous, next and pause buttons.
- Navigation is nine plain category words in one centered row, with the deals link set apart in red with an icon.
- The menu that opens under a category is two columns of text links with small gray column headings and a lot of space.
- Sister brands are tabs above the header.
- Tiles put the price first, large, then the product name as an underlined link, then the old price: "$15 COZY TEES Was $29.95".
- A repeating band of words ("FLASH DEALS") separates sections and carries the campaign's pattern and colors.
- The campaign look is seasonal and separate from the shop's own plain white, so it can change without touching the shop.
- On a category page the heading carries the count ("Women's Loungewear & PJs (139)") under a breadcrumb.
- A "Store Pickup (Get It Today!)" switch is the first filter.
- Filters are a list of collapsed groups with a plus sign. Sub-categories are plain links above them.
- A product shows, in order: the photograph, a small blue line of status ("New Family PJs! + Bestseller"), the name, the old price struck through beside the new price, then the deal name in red.
- A "Save 40%" tag sits on the corner of the photograph and a heart to save sits on the opposite corner.
- Demand is shown on the photograph in a quiet strip: "In demand! 335 sold".
- An editorial tile with a photograph and a link is placed inside the product grid in place of one product.
- On a phone the grid is two columns, and "Category" and "Filter & Sort" are two pills that stay pinned.
- On a phone the header is a row of six icons: menu, search, offers, saved, account, bag.

## Notion

Pages: home, and Pricing.

Design choices

- **Fonts:** Die Grotesk for the marketing pages. The product shown inside the page uses Notion's own Inter. A third face sets one quotation.
- **Headlines:** 80 px at weight 500 with a line height of 1.0 for the hero and the closing line, 54 px at 500 for section headings.
- **Body:** 18 px under the hero, 16 px elsewhere, 14 px in navigation. Weights are fine-tuned: 420, 450 and 500.
- **Colors:** white canvas, text at 95% black, secondary text at 54% black, warm grays `#F6F5F4` and `#F9F9F8` for secondary buttons and panels. **There is no brand color.** Primary buttons are black.
- **Color comes from pictures:** painted backdrops behind product windows, small illustrations, and partner logos.
- **Shape:** full pills for every button, 8 to 12 px on frames and cards.
- **Buttons:** 44 px tall, 16 px text at 500.
- **Shadows:** several very faint layers.
- **Width:** 1252 px. **Motion:** 0.15 to 0.3 s.

Practices worth taking

- One short headline, centered, at 80 px, then one sentence, then two buttons. Nothing else above the product.
- The two buttons are a black pill and a pale gray pill, the same size.
- The product is the hero picture. A real window of the app, typing as you watch, starts inside the first screen and runs off the bottom of it, which invites the scroll.
- Moving demonstrations have a pause button.
- The header is navigation left, logo centered, account and "Try Notion" right. It stays pinned, and "Try Notion" turns from gray to black once the hero has scrolled away.
- Each section is one 54 px heading, one live picture of the product, then three short columns of a bold line and a gray sentence. No boxes around the columns.
- Connected tools are shown by name with a real-looking count: "Slack, 23,802 messages".
- Customers are shown as a row of tiles, each a customer's logo over a product window on its own painted color.
- The page closes by repeating the 80 px headline size and the same two buttons.
- The pricing page puts customer logos directly under the headline.
- A monthly and yearly switch sits above the plans with the saving stated beside it.
- Four plans are grouped into two panels by purpose, each panel with its own headline.
- Each plan shows the name, the price with its unit, one line saying who it is for, a full-width button, then a checklist that starts "Everything in Plus, and:".
- Only the recommended plan has a black button and a "Recommended" tag. The others are pale.
- The currency is stated ("Price in USD") and a chat button stays at the corner.
- On a phone the headline is 40 px, the two buttons sit side by side, and the header always shows "Try Notion".

## Spotify

Pages: the web player's home, and Search.

Design choices

- **Fonts:** Spotify Mix in two weights only, 400 and 700, with a title cut for shelf headings.
- **Type is small and steady:** 24 px at 700 for shelf headings, 16 px for titles, 14 px for secondary lines, 11 to 12 px for legal links.
- **Colors:** black page, `#121212` panels, `#1F1F1F` fields, white text, `#B3B3B3` secondary text. Green `#1ED760` is the one brand color, saved for the paid offer. The main buttons are white pills.
- **Color comes from the content:** cover art, and category tiles in many saturated colors.
- **Shape:** full pills for buttons and search, 6 px on covers, 8 px on panels, circles for artists.
- **Shadow:** one, on covers: 8 px 24 px at 50% black.
- **Buttons and search:** 48 px tall.
- **Motion:** 0.15 s with `cubic-bezier(0.3, 0, 0, 1)`.

Practices worth taking

- The site is the product. A logged-out visitor lands in the working player with real content, not on a page about it.
- The page is rounded panels on black with small gaps: the library, the content, and a collapsed side panel.
- Search is in the top bar at all times and asks a question: "What do you want to play?"
- Content is shelves. Each has a heading and "Show all", and a row of covers with a title and one gray line.
- Shape tells you the type: square covers for songs and albums, circles for artists.
- The empty library is not empty. It holds two cards, each with a sentence of help and one button: "Create your first playlist", "Let's find some podcasts to follow".
- The offer to sign up is a single bar pinned to the bottom, in a pink to blue gradient that appears nowhere else, with one white button.
- "Log in" is a white pill and "Sign up" is plain text beside it, so the two are ranked.
- Browse is a grid of category tiles, four across. Each is one flat color with the name top left and a tilted cover bottom right.
- A skip link is the first tab stop.
- On a phone the top bar holds the logo and an "Open App" pill, and a bottom bar holds Home, Search, Your Library and Premium.
- On a phone the paid offer is a card that can be closed, with the price after the trial and the end date written out.
- On a phone shelves scroll sideways with a little over two covers showing.

## Seen on most or all of them

Seven sites were seen. Target is counted only where a value could be read from its code.

- **Pictures fill the first screen on all seven.** Rows of photographs (Airbnb, Spotify), one large photograph that runs to the edge of the screen (American Eagle, Capital One, Undersold, Dallas Software Developers), or the product itself (Notion).
- **Photographs are of real people and real things:** listings, members, clothes on people, the product. The same framing is used across a set.
- **One color does the primary action** on every site: pink, blue, lime, black, white, deep green, yellow, red.
- **Main buttons are 44 to 56 px tall** (Target's are 40 to 44). Smaller 32 px buttons appear only inside Capital One's sign-in band and product cards.
- **Body text is 14 to 20 px.** 16 px is the most common.
- **Navigation is three to nine plain words.** Sign-in or the main action sits at the right end on Capital One, Notion, Spotify, Undersold and Dallas Software Developers.
- **A skip link** was found on seven of eight (not on Notion).
- **Specific numbers and plain facts replace adjectives:** a total price, "90 seconds", "24 meetups each year", "$0 to attend", "335 sold".
- **Reassurance sits beside the action** on Capital One, Undersold and Spotify: no credit card, no impact to your credit score, cancel anytime.
- **The real thing is shown before sign-up:** real listings, real products, the real app, a sample result, the next real event.
- **The header or the main action stays in reach while scrolling** on six: Airbnb, American Eagle, Notion, Spotify, Dallas Software Developers and Target. Capital One pins its topic row.
- **On a phone, rows scroll sideways with the next item cut off** on Airbnb, Spotify, American Eagle and Capital One.
- **On a phone the main action is in the header or a bottom bar** on six: Airbnb, American Eagle, Capital One, Notion, Spotify and Undersold. Dallas Software Developers keeps a Discord button and the menu there.
- **Motion is short:** 0.15 to 0.35 s.
- **Repeated items are built identically**, with each fact in the same position every time.

## Where they differ, on purpose

- **Canvas:** white on five (Airbnb, American Eagle, Capital One, Notion, Target), warm cream on one (Undersold), dark on two (Spotify, Dallas Software Developers).
- **Headline:** none at all (Airbnb, Spotify, Target), light and modest at 40 px (Capital One), serif at 52 to 70 px (Undersold), large at 80 px (Notion), very large and heavy at 88 px (Dallas Software Developers), display type on photographs (American Eagle).
- **Number of fonts:** one family on four (Airbnb, Capital One, Target, Spotify), two or three with strict jobs on four.
- **Corners:** nearly square (Capital One, American Eagle products), soft (Airbnb, Dallas Software Developers), full pills (Notion, Spotify, Target).
- **Where color comes from:** the brand color (Capital One, Target, Dallas Software Developers), the photographs (Airbnb, American Eagle), the content (Spotify), artwork (Notion), a two-color palette (Undersold).

No two of the eight share a look. Each has one or two signature moves nobody else here uses: Airbnb's illustrated tab icons, Capital One's light headlines, American Eagle's type on photographs, Notion's painted backdrops, Spotify's colored tiles, Undersold's handwritten phrase, Dallas Software Developers' yellow highlight and offset shadow.

## What became of these findings

They were findings against the method of 2026-11-21. The method was rebuilt from them the same day, and the [design history](../context/frontend-design.md) records each change and the builds that tested it.
