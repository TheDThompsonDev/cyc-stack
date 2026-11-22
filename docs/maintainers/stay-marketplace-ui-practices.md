# UI and UX practices worth borrowing from a stay marketplace

The interface gives a guest different evidence at each decision. A row of photographs helps someone notice a place. Dates, prices, and a map help them narrow the field. Once a property looks promising, they can inspect the bedroom, check an entrance requirement, or search guest reviews for a concern of their own.

Reviewed November 22, 2026. I inspected the public homepage, Austin search results, and one condo listing in Edge at 1,440 × 900 and 390 × 844. A November 21 capture supplied a populated desktop homepage for layout measurements. Inventory, experiments, review counts, and prices can change. The observations cover signed-out browsing through checking availability.

## Getting a search started

- **Make the main task the largest control.** The desktop homepage gives the central position to a search bar for destination, dates, and guests. A visitor who already knows their plans can start entering them immediately. [Homepage][home]
- **Distinguish a field’s purpose from its current value.** Each search segment has a persistent label and a separate prompt or selection. The guest segment goes from an invitation to add people to a readable party size.
- **Accept uncertainty about dates.** The date picker offers exact dates, a flexible search, and tolerances such as one or three days either side. A traveler with a movable weekend can express that directly.
- **Show adjacent months together on desktop.** The date picker exposes two consecutive months. Guests can see a stay that crosses a month boundary without losing sight of their starting date.
- **Make a calendar date understandable on its own.** The visible day number has an accessible name with the weekday, month, and year. For past dates, the control also exposes its disabled state and the reason the date cannot be chosen.
- **Explain who belongs in each count.** Adult, child, and infant counters include age ranges. The pet control puts a service-animal explanation beside the decision where the distinction matters.
- **Make changes visible and reversible.** At zero adults the decrement control was disabled. Adding one adult updated the search summary to one guest, enabled decrement, and exposed a clear action. The change was visible before submitting the search.
- **Let the search header shrink when attention moves to results.** The compact version keeps destination, dates, and party size available for editing, leaving more of the viewport for places. [Search results][results]

## Browsing and comparing places

- **Lead with actual inventory.** The populated desktop homepage showed two rows of stays in the opening viewport. The pictures, names, and prices give a visitor something to judge before they settle on a destination. [Homepage][home]
- **Give each row a reason to exist.** Rows are organized around a destination or a travel window. A place and a weekend make a more useful browsing prompt than a generic collection title.
- **Let visitors explore a few more items or open the whole collection.** Row arrows browse within the current page. The linked heading opens the larger set. Browsing one more option costs less effort than starting a new search.
- **Give every listing a predictable reading order.** The image is followed by the property type and place, then price, duration, and rating. The eye can move across a row comparing the same fact in the same position.
- **Put the unit beside the price.** Homepage cards show the amount alongside the number of nights. The results experience also explains that displayed prices include fees. A guest can interpret the amount while comparing options. [Search results][results]
- **Reserve consistent corners for different jobs.** A recognition badge sits on the upper left of the photo and the save heart on the upper right. Scanning for a distinction and remembering a place use separate, predictable locations.
- **Reveal more facts when a visitor narrows their search.** Destination results add details such as beds, bathrooms, dates, and review count. A guest making a shortlist gets more evidence than someone casually browsing the homepage.
- **Make photographs browsable inside results.** A result can expose several photographs with a position indicator. Someone can inspect the interior before deciding whether to open the listing.
- **Let geography participate in the comparison.** Desktop results put listings beside a map with prices on its markers. Guests can compare cost and neighborhood in one view. On phone, the captured layout gives the map the full width and brings the listings up underneath.

## Filters that help visitors decide

- **Offer a shortcut for common criteria.** The filter panel puts choices such as free parking and self check-in near its top. Guests can apply a familiar constraint before exploring the complete list. [Filter panel on search results][results]
- **Put a budget in the visitor’s own units.** The price control switches between nightly price and trip price. A guest planning a fixed-budget weekend can reason about the whole stay.
- **Show the price distribution beside the range.** A histogram provides context for the slider, and the graphic has a text description of typical prices. A visitor can tell whether a limit sits near the middle or at an extreme.
- **Provide a precise alternative to dragging.** Minimum and maximum text fields sit beside the range sliders. An exact budget can be typed directly and does not depend on fine pointer movement.
- **Treat accessibility requirements as searchable facts.** Opening accessibility filters revealed separate choices for step-free access, entrances wider than 32 inches, and toilet or shower grab bars. Guests can select the physical features they actually require.
- **Keep a filter selection visible until the guest applies it.** Selecting the hot tub amenity changed its button to a pressed state. The panel retained a results-count action and a way to clear the selection, so the guest could keep refining.
- **Return keyboard focus to the point of departure.** After I closed the filter dialog with Escape, focus returned to the Filters button. A keyboard visitor can continue from the same part of the results page.

## Inspecting one place

- **Lead with a useful spread of photos.** The desktop listing gives one image more space, then uses the other cells to show different views. The gallery includes the living space, bathroom, and shared amenities. A visitor gets several pieces of evidence in one glance. [Listing][listing]
- **Organize a large gallery by the question behind the click.** Opening the full photo tour revealed shortcuts for the kitchen, bedroom, bathroom, balcony, and other spaces. Someone wondering about cooking facilities can go straight to kitchen photos.
- **Put capacity directly beneath the property identity.** The listing identifies the accommodation type and location, then gives guest capacity, bedrooms, beds, and baths on one line. A group can rule a place in or out immediately.
- **Show the sleeping arrangement as its own section.** The example pairs a bedroom photograph with the bed type. A group can check how it would divide the sleeping spaces when the total bed count alone leaves that unclear.
- **Group a long inventory by use.** Opening the full amenities list exposed sections for the bathroom, laundry, kitchen, safety, and workspace. Someone checking for a particular facility can go directly to its category.
- **Give a rating a denominator.** The listing put its 4.99 score beside 185 reviews. Opening the reviews revealed a star distribution and category scores for cleanliness, check-in, communication, location, and value. A guest can investigate what the average represents.
- **Let people search other guests’ experience.** Searching those 185 reviews for *parking* returned six. The interface reported that count and offered a clear-search control. This is especially valuable for questions an amenity checkbox cannot answer.
- **Surface conditions before commitment.** House rules, safety information, and cancellation details have identifiable entry points. When the cancellation details depend on travel dates, the listing asks for those dates where the guest is looking for the answer.
- **Match the primary action to what is known.** With no dates selected, the listing asks the guest to check availability and explains that dates are needed for an exact price. On phone, that action is visible in a bottom bar while the first screen introduces the place.

## Typography, color, shape, and responsive layout

- **Use one variable sans-serif across the journey.** The measured family was **Cereal VF**. The fallback stack includes Circular, system UI faces, Roboto, Helvetica Neue, and sans-serif. Reusing one family keeps controls, listing facts, and editorial headings visually related. [Homepage][home]
- **Give the collection heading just enough weight to organize the row.** A desktop destination heading measured **20 px / 24 px, weight 600**, with **−0.18 px** tracking. It is easy to locate while the photographs keep their prominence.
- **Keep comparison text compact and differentiated.** A homepage listing title measured **13 px / 16 px at 500**. Price and rating metadata measured **12 px / 16 px at 400**. The body default was **14 px / about 20 px**. Those small sizes served short recurring facts.
- **Increase the type scale when the visitor chooses a property.** The sampled desktop listing title measured **26 px / 30 px at 500**. The accommodation-type heading below measured **22 px / 26 px at 500**, with **−0.44 px** tracking. The detail page establishes hierarchy without a competing display face. [Listing][listing]
- **Let photography supply most of the color.** The measured surfaces included white and **#F7F7F7**, with **#222222** primary text, **#6C6C6C** secondary text, and **#DDDDDD** dividers. A saturated pink, sampled at **#DA1249**, draws attention to the search action.
- **Concentrate personality in a small, useful detail.** Each top-level travel category pairs a miniature illustration with a plain text label. The illustrations help distinguish the categories at a glance and give the otherwise restrained header a recognizable character.
- **Keep the photo crop and gap consistent.** At 1,440 px, a populated home row showed seven complete cards, approximately **180 px** wide with **12 px** gaps. The nearly square photos measured about **1.05:1**. Different properties can share a baseline without acquiring heavy card borders.
- **Use shape to distinguish controls from content.** Listing photos sit inside rounded containers with **20 px** corners. The long search control is pill-shaped and small directional controls are circular. Their silhouettes help a visitor recognize their jobs.
- **Use elevation where something sits above the page.** One measured shadow combined a **1 px** ring at **2%** black, a **2 px** offset and **6 px** blur at **4%**, and a **4 px** offset and **8 px** blur at **10%**. The search surface reads as raised while the photo rows stay visually quiet.
- **Keep small transitions consistent.** A recurring control transition measured **250 ms** with `cubic-bezier(0.2, 0, 0, 1)`. Reusing an easing curve gives similar controls a similar response.
- **Show what a horizontal gesture will reveal.** Phone home rows used approximately **165 px** cards, **12 px** gaps, and horizontal scroll snapping. Part of the following card remained visible at the edge, giving the row a directional cue.
- **Keep frequent destinations within thumb reach.** The phone’s bottom navigation groups exploring, saved places, and login, with text labels and an active-state accent. Photo rows remain available above it. [Mobile homepage][home]

[home]: https://www.airbnb.com/
[results]: https://www.airbnb.com/s/Austin--TX/homes
[listing]: https://www.airbnb.com/rooms/1372095508415821840
