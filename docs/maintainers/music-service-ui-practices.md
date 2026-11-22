# UI and UX practices worth borrowing from a music service

The public site makes a subscription decision easier. The player makes a listening decision easier. On the public page, a single changing word can occupy a third of the screen. In the player, a cover, a title, and an artist credit share that space with several other releases. Both designs use the same type family.

I inspected the U.S. public subscription page and the signed-out browser player at 1,440 × 900 and 390 × 844 CSS pixels on November 22, 2026. The U.S. home address led to the player, so the subscription page provided the public marketing view. I checked browse, search, release pages, and keyboard interactions. The observations about controls cover the visible interface. Signed-in playback, queue behavior, and purchasing were outside the review. [Public site][public] · [Player][player]

## Public site — making the offer understandable

- **Keep one part of a campaign headline steady.** A fixed opening phrase anchors a changing final word about music, artists, or fans. The italic ending introduces movement while the visitor can still read the main idea at a glance. [Public site][public]
- **Recompose the hero for a narrow screen.** Desktop puts a left-aligned headline over full-width video. The phone places the footage inside a circular motif above a centered headline on black. Giving the letters their own background keeps faces and words from competing in the narrow crop. [Public site][public]
- **Keep the weight of a headline while changing its scale.** The variable title face measured **128 px at weight 900** on desktop and **40 px at 900** on the phone. At both sizes its broad, heavy letterforms carry the campaign. [Public site][public]
- **Offer two actions for two different levels of readiness.** A filled green pill starts the trial. An outlined pill beside it lets visitors compare plans. The buttons stack on the phone, keeping both paths visible with the offer. [Public site][public]
- **Put the recurring commitment beside the introductory price.** Under the trial action, visitors can read the renewal price, billing interval, eligibility, and end date. The individual plan repeats the introductory period and subsequent monthly charge where the visitor picks a tier. [Offer and plans][plans]
- **Organize benefits around moments a person recognizes.** Listening in a car, on a wearable, and through a home speaker each have an image and a short explanation. A visitor can start with the device and setting they already use. [Public site][public]
- **Give motion a reversible control.** The hero video has a visible pause button. On desktop I activated it and its accessible name changed to Play. A visitor can stop the footage to read the offer and has a clear way to restart it. [Public site][public]
- **Make plans comparable in the same reading order.** The main cards place the plan name, price, account or household details, included benefits, and action in a repeatable sequence. Looking across three desktop cards, I could compare who qualifies and how many accounts are included without rereading each offer. [Plan selection][plans]
- **Put exceptions beside the benefit they qualify.** The family card describes the audiobook allowance and identifies the plan manager as its recipient on the same line. A household can see what is shared before committing. [Plan selection][plans]
- **Carry each plan’s accent from its name to its action.** The individual tier uses **#1ED760** green, student **#91EEDA** mint, duo **#FFA178** peach, and family **#D8A3FF** lavender. Written tier names, eligibility, and account counts also identify the options for people who do not distinguish the hues. [Plan selection][plans]

## Web player — finding something to hear

- **Let a visitor explore real content immediately.** The signed-out home shows songs, artists, and releases. I could follow a song to its release and inspect the track list before making an account decision. [Player home][player] · [Release detail][release]
- **Give each desktop region a lasting purpose.** Search occupies the top bar, the library occupies the left panel, and the center changes from discovery shelves to the selected release. Returning to search or the library does not require finding a new route on each screen. [Player home][player] · [Release detail][release]
- **Give a new library a specific first action.** The empty library offers two starts with different outcomes. One creates a playlist. The other browses podcasts to follow and explains that following brings new episodes into reach. [Player home][player]
- **Use one typographic family at two reading speeds.** The proprietary **Mix** sans serif, developed with Dinamo, has separate UI and title faces. Desktop shelf headings use the title face at **24 px / 700**, while titles and supporting metadata use **16 px** and **14 px** UI text. Phone home shelves use **20 px / 700** headings. It is worth borrowing the division of roles even with a different font. [Player home][player] · [Typeface design notes][type]
- **Build depth into the dark interface.** Black **#000000** gutters separate **#121212** panels. The desktop search field uses **#1F1F1F**. Primary text is white, with **#B3B3B3** for supporting text. These small shifts make the field, panels, and reading order legible without outlining every component. [Player home][player] · [Browse][browse]
- **Let artwork carry identity.** On desktop, recordings use square covers with slightly rounded corners and artists use circular portraits. Titles and artist credits keep their own lines under the art. Someone scanning quickly can distinguish a person from a recording even before reading its name. [Player home][player]
- **Offer both a sample shelf and a way to see its full contents.** Each desktop row introduces a collection with several examples and a link to the full section. On a phone, roughly two covers and part of the next fit across, signaling that more are within horizontal reach. [Player home][player]
- **Support browsing before someone has a query.** The search screen opens with labeled destinations including music, podcasts, audiobooks, genres, and moods. Saturated tiles form a four-column grid on desktop and a two-column grid on the phone. Even without recognizing artwork, a visitor can act on the text label. [Browse][browse]
- **Let someone narrow a search after seeing what the name could mean.** A phone search for Miles Davis returned the artist, albums, tracks, playlists, and a podcast. Type filters appeared with the results. *Kind of Blue* was labeled as an album and *So What* as a song, both credited to the artist. [Player search][browse]
- **Make a new search cheap.** The phone query stays editable above the results. A named clear button emptied the field in one tap, and the back control was separate. Clearing text and leaving search are distinguishable actions. [Player search][browse]
- **Give frequent destinations stable phone positions.** Home, Search, Library, and the paid offer appear in a bottom bar with an icon and text label at each destination. I saw the same arrangement on the home and browse screens, with the current destination emphasized. [Player home][player] · [Browse][browse]

## Web player — opening a release and using its controls

- **Bring the selected item into the next screen.** Opening a trending song took me to its parent release with that song’s row selected. The URL carried the track identifier, the row was visibly highlighted, and its selected state was exposed to assistive technology. The interface preserved the listener’s original choice. [Release detail][release]
- **Show the listening commitment before the track list.** The phone album header gives the year, track count, and approximate total time. The album I opened showed **37 songs** and **about 1 hour 45 minutes**. Someone choosing music for a trip can judge the length immediately. [Album detail][album]
- **Let the release artwork set the scene while its track list stays readable.** On the desktop single I opened, a magenta header echoed its cover and faded into the dark list below. The primary Play button stayed bright green. Color associates the page with this release while the main action remains recognizable. [Release detail][release]
- **Design a track row for comparison.** The desktop list aligns the track number, title and artist credits, and duration under consistent columns. On the phone album, the title and credit stay together with a more-options control on each row. [Desktop release][release] · [Phone album][album]
- **Keep secondary actions attached to their track.** The desktop row’s options menu offered credits, sharing, and song radio. Its accessible button name included the track and artist, so a keyboard user can identify which recording those actions affect. [Track menu][release]
- **Return keyboard focus to where the task began.** I focused the track’s options button, opened its menu with Enter, and dismissed it with Escape. Focus returned to that same button, preserving my position in the list. [Track menu][release]
- **Make the workspace adjustable from the keyboard.** The desktop library divider is exposed as a named slider. With it focused, Right Arrow changed its value from **330 to 340**, giving someone who uses a keyboard control over the space devoted to the library. [Release detail][release]
- **Give keyboard users an early route past persistent navigation.** The first Tab stop on a fresh desktop player page was a skip link to the main view. That shortcut matters when the same search, account, and library controls precede every new release. [Player home][player]

[public]: https://www.spotify.com/us/premium/
[plans]: https://www.spotify.com/us/premium/#plans
[player]: https://open.spotify.com/
[browse]: https://open.spotify.com/search
[release]: https://open.spotify.com/album/1V8Qu6CwkBfYucnCWxynq8?highlight=spotify:track:4HCOHRCSQelz2GPX8iTamO
[album]: https://open.spotify.com/album/5IZ8sY5FjtL9hloXpv0XbD
[type]: https://newsroom.spotify.com/2024-05-22/introducing-spotify-mix-our-new-and-exclusive-font/
