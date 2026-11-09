# Shop Shuffle: Game Design

The opening game of the Untame pitch. A room of 10–30 potential clients (mostly local business owners) joins from their phones. Each person's business becomes a shop on a shared Main Street on the big screen. Shops grow legs and walk to where the customers are. The talk ends on the game: the presenter says thank you over its end card.

Status: rules locked after a prototype and bot testing (see `reference/`). Numbers are starting values, not final.

---

## 1. Why this game exists

- **Thesis, left unsaid:** the new storefront goes where the customers are. The room watches their own shops do it. Say at most one line after the round ("Your storefront just walked to where your customers were"), or nothing.
- **Second line, for the idle rule:** idle marketing fails. Shops that stop paying attention close.
- The game is the proof. Engagement numbers from the room (joined, taps, customers served) are the first slide after it.

## 2. Hard constraints

| Constraint | Value |
|---|---|
| Players | 10–30, on their own phones, joined by QR, no app, no signup. Bots fill the street up to `minPlayers` |
| Length | 2–3 minutes of play |
| Tutorial | None. Every rule must be visible on the big screen |
| Attention | Eyes stay on the big screen. The phone is a blind controller |
| Network | Venue Wi‑Fi or cellular. Must survive dropped phones |

## 3. Flow

1. **Lobby (≈40s):** the screen shows the title over the street, between a QR code on the left and the list of shops on the right. Players scan it and set up their shop on the phone (see "Joining"), and each shop drops from the sky into a random column as it opens. From then on the phone is its controller, and the street is a brawl without consequences: every movement rule applies, but no customers come, nothing scores and shutters stay open. The street is laid out for `minPlayers` shops from the start and only widens past that, at its right edge, so nobody moves as others arrive. Only the lobby takes new players.
2. **Begin:** the presenter starts the round. The title and QR clear, bots drop into the widest empty gaps until there are `minPlayers` shops, then READY? WALK-INS! across the street: the street holds still until WALK-INS!, and the round clock starts with it. The second banner names the phase, as PARACHUTES! names the second. Shops start where the brawl left them.
3. **Phase 1, walk-ins (≈40–60s):** the tutorial in disguise. Low stakes.
4. **Phase 2, parachutes (≈60s):** the real game.
5. **End card (stays until the next round):** the street becomes a podium (see "End card"), with the ranking top right and the contact card top left. Each phone shows its shop's money, final place, how the round went and the full contact card. Play again (`R`) goes back to the lobby: the bots leave, the QR comes back, new players join, and everyone else keeps their shop.

### End card

- **Takeover:** when the clock runs out, the customers and the crosswalk go and the sim takes the controls. Every shop walks to the sides, keeping its order along the street so nobody crosses anyone; with more shops than side columns, they stack. A walker climbs over whatever is in its way and is never pushed or bumped.
- **The podium:** once the middle is clear (or after `clearMax` anyway), its blocks drop in, lowest place first: three columns in the middle of the street, second, first and third left to right, with `secondBlocks`, `firstBlocks` and `thirdBlocks` stone floors capped silver, gold and bronze, each with its number on a plaque. The podium is kept low, so the winners can be bumped and toppled: second and third stand at the same height, with third's block drawn a few pixels lower so the places still read in order. Then the winners walk up, third first, `winnerGap` apart. As the winner reaches the top, its banner (in its color) and the winner's sound come in.
- **Free play:** `freeAfter` later the phones have their shops back, and the street is a brawl without consequences, like the lobby, until the presenter starts the next round. Bots stay put, so the room has the podium to itself. Blocks are floors that can be climbed and stood on, never pushed: a winner can be toppled off its podium, the podium can't.
- **The big screen:** the ranking, always shown, where the shop list sits; the contact card where the join card was (a QR to the site, the site, name and company, email, Replay); the winner's banner where the title was.
- **The phone:** the card over the controller adds the round's customers served and towers toppled. The contact gets a card of its own along the bottom, dark on white so it stands apart from the game, with the controller's arrows between the two: name and company, Save contact (a vCard) and a button for each filled-in way to reach Untame (site, LinkedIn, email, phone). The same frame also shows on every other phone once the round is over (one still setting up has it under the form, in place of the credit) and whenever there's no big screen in the room, before the talk or after it, so a phone opened late or reloaded still has the contact. The contact lives in the copy file; an empty field is left out everywhere.

## 4. Phone

### Joining

- **One field: the shop's name.** Until one is typed, the field and the sign show a plain "Shop name" placeholder and the shop can't open, so every player names their own shop and knows which one is theirs.
- **Live preview:** the phone draws the shop exactly as the big screen will, with the same sign fitting and font, so the name wraps and shrinks on the sign as you type. A letter that would push the name under the sign's smallest size isn't accepted, so nothing is ever cut off on the big screen.
- **Shop type:** one shop on screen; arrows or a swipe cycle through the types, starting at a random one. Dragging moves the shop with the finger; past halfway it slides out and the next type slides in from the other side, which the arrows do at once.
- **Color is assigned,** never picked: hues are handed out so that a repeated hue always goes to a different shop type, which keeps every shop findable.
- **Editing:** until the round begins, a player can go back to the form. The shop stays on the street with its current name and type, and an edit applies only when confirmed. If the round begins mid-edit, the edit is dropped and the phone becomes the controller.
- A player who hasn't opened their shop by the time the round begins waits for the replay. They can set it up meanwhile, and it drops in when the lobby reopens.
- **The sign fills up:** once a letter doesn't fit, nothing more is taken until something is deleted, so a narrower letter can't slip in after a wider one was refused.
- **Branding:** the form stays at the top, above where the keyboard comes up. The room under it shows the game's title and tagline, with the credit along the bottom.

### Presenter list

- On the right, the screen lists the shops that have joined, in the order they opened, and how many phones are still setting up. Clicking a name renames the shop (a name that doesn't fit the sign isn't taken); the × that shows on hover takes it off the street. That stands in for a profanity filter. Once the round begins, the same list becomes the live ranking by money (bots tagged, closed shops dimmed), hidden unless the presenter calls it up with `B`; the end card always shows it.
- A removed shop's phone goes back to the setup form, with what the player last typed still filled in, and can open it again.
- A phone that disconnects in the lobby keeps its shop, marked offline in the list, until the presenter removes it.
- Names can only be changed in the lobby, so they are settled before the round.

### Presenter controls

- **Skip (`S`):** from the walk-ins straight to the parachutes, and from the parachutes to the results, for a talk running long. Shops, shoppers and money stay as they are.
- **Restart (`N`):** a fresh round straight away, from wherever the shops stand, with READY? WALK-INS!. Phones that waited join it, and bots fill in again.
- **Bot fallback (`F`):** bots play the phones' shops for the round, one of each type in the bot mix in turn, and hand them back on a second `F`. It also turns on by itself when the screen has lost the relay for a few seconds mid-round, and turns off when the relay returns, so a dead network never leaves a street of closed shops. The HUD shows BOTS PLAYING while it's on.

### Controls

- The whole phone is two halves: **tap left / tap right to step one column; hold to keep walking.** Release and you sit at the next column. Pushing a tower takes a hold. A held finger can slide across the middle to turn without letting go.
- On top, your shop as the street draws it (shutters down when it's closed), the money it has made, and its place (#3 of 12). Nothing else during play: the phone is in your shop's tint, big, so you can play without looking at it.
- All feedback is on the big screen: your shop lurches when you press, and pressing brings it to the front of a cluster.

## 5. The street

- A side view of one street, divided into **columns** (a grid). Each column holds a stack of shops.
- Logic is grid-based; animation is smooth (walk cycles, squash on landing, tumbles on scripted arcs). No physics engine.
- Column count: `max(players + 4, 1.5 × players)`, capped by readability (about 17 on a 1080p screen), then made odd so the street has a middle column (the end card's first place stands in it). At 30 players the street is full and stacking is forced. That is accepted.
- Shop size is uniform: every shop is one floor tall.

### Look (pixel art, decided)

The mockup is `reference/pixel-street.html`, and the screen renderer draws it. Visual only: none of this changes a rule.

- **Grid:** 32 art pixels per column, a 32×26 cell. Daylight palette.
- **Shops** are drawn in code from parts (sign, awning, wall, window goods, and the front's layout: door right, door left, a door between two windows, or a serving hatch) in a pool of designs, colored by the player's three-shade tint ramp. A shop fills its whole floor (27×23 body plus a 3-pixel roof ledge), so stacked shops touch. The front is only 7 art rows, so designs differ in their big parts (awning shape, door position, wall, and what's behind the window: daylight, a lamp-lit room, a dark shop or greenery, its goods filling it), not just the goods. Window glass has no glare: the same streak on every window made them all read alike. The café has a coffee bar facing the street, with stools in front. A few small things animate (the barber pole, the steam off a cup on the café's bar, a glint on the records, the marquee's bulbs chasing one in three); none of it may look like a rule: grey horizontal slats mean shutters and a red outline means a falling tower, so no shop art uses either.
- **Signs:** the name in Press Start 2P, drawn over the shop at full resolution but hard-edged like the rest of the street, every pixel solid ink or clear (it leans and spins with the shop), set as large as the sign allows on one line or split between words onto two, in whole steps of the font's pixel grid so every font pixel lands on whole screen pixels. A name that would set smaller than a minimum size is wrapped at that size and cut off with a dot. A row of padding under the roof line.
- **Motion:** lean, dizzy sway, topple spin and the landing squash rotate and scale the drawn shop, even where pixels leave the grid. A pusher leans with the tower's strain pulses; the push meter stays put.
- **Legs:** thin ink legs with a side-view four-frame stride. Every leg animation is drawn facing right; facing left mirrors the legs (only the legs) pixel for pixel. Two equal segments per leg: standing up and sitting down bend the knees out sideways (about 0.125 s) instead of stretching the legs. Climbing a floor steps up: the front foot lifts onto the shop ahead and straightens as the body rises with it, so the climb reads as stepping up a stair.
- **Underwear:** shorts over the top of the legs, each leg's part hanging lower than the middle. Every shop wears one pair, picked from its name: dots or vertical stripes in one of six tacky color pairs. They mirror with the legs.
- **People** (walk-ins, parachuters) are hand-drawn pixel maps, 5×10 with a one-pixel outline. A shirt is never paired with a skin tone too close to it.
- **Text and fades:** small text (callouts, coins, signs) is 8-bit type, Press Start 2P; banners (the READY? WALK-INS! countdown and PARACHUTES!, all one size, the results' winner, and Paused) are 16-bit type, Jersey 15, the lobby title's font. A shop name too big for its sign in Press Start 2P even at one screen pixel per font pixel (a 720p projector, a small window) is set in Micro 5, a narrower 5-pixel type, instead; everywhere it fits, the sign is unchanged. Both are outlined in ink: coins as tall as the 3×5 pixel font they replaced, callouts a little taller, titles larger (a pixel font scaled up stops reading as pixel art). Text never fades with real alpha: it washes out toward white through a few palette keyframes (a title washes in and out the same way).
- **No marker over your own shop:** everyone shares one screen, and each phone shows its shop's tint.
- **Scale:** the street scales by whatever fits every column and the sky (centered when the height is what limits it), and eases as towers grow. At a scale that isn't a whole number, some art pixels are a device pixel wider than others.
- **Open:** whether to step the zoom between whole-number scales instead.

### Sound (8-bit, decided)

- **Sound effects only, no music,** and only from the big screen: thirty phones beeping would drown it, and the phone is a controller nobody looks at, so phones keep their buzz and stay silent. Every sound is synthesized live from NES-style channels (three pulse widths, a triangle, noise), with no sound files; pitch slides and fades move in frame steps, which is what makes them sound 8-bit.
- **What makes a sound:** footfalls (two per column, alternating two tones, higher up a tower), a soft thud as a walk ends and the legs fold, a grunt per wobble of a tower under a push (rising as the topple nears), the topple's falling whistle and the crash as it lands, bumps, the push-back (a rough two-note reject), walk-in and parachuter coins, a lost customer, a shop dropping in to join, the shutter clicking down one row at a time and hitting the sill as it closes, the shutter snapping up, one beep per crosswalk bar (higher on the last, as the wave steps off), READY?, WALK-INS!, PARACHUTES!, a tick for each of the round's last five seconds, and a short run up to a held note for the winner. No sound for climbing.
- **A crowd stays listenable:** footfalls are capped across the whole street per second (one walking shop still sounds every one), each sound has a minimum gap, at most a couple of topples ring at once, only the furthest-along push grunts, and a few coins can ring at once. Coins keep one pitch. The crosswalk beeps are kept low: a cue to look, not an alarm. Each sound pans to its column.
- **The winner's run** plays as the winner reaches the top of the podium. The end card's walking, drops and free play sound like the rest of the game.
- **Sound starts at load where the browser allows it, otherwise on the presenter's first key or click;** until then the HUD shows CLICK FOR SOUND, so a phone joining a silent lobby gets noticed. It pauses with the game, and `M` mutes it (the HUD shows MUTED). A fast-forward or a restart makes no sound for the part skipped.

## 6. Movement rules (locked)

**Your height:** a sitting shop is 1 floor. A walking shop stands on legs one floor tall, so it is 2 floors high and carries everything stacked on its roof. Heights are measured from the surface under your feet.

**One sentence for the player:** legs reach one floor. One floor up, you climb. Higher, you push until the top falls off.

| You walk into a column whose top is… | Result |
|---|---|
| At or below your feet | Step across / step down onto it |
| One floor above your feet | **Climb** onto it |
| Two or more floors above your feet | **Push.** Hold for `pushTime` and everything above your first floor **topples** to the far side, landing on top of whatever is there. You can then climb what is left |
| A walker heading toward you, within one floor of your level | **Bump:** whoever started walking first carries on; the other bounces back. Started together: both bounce |

- **Steps commit (decided after M2 playtest):** a press starts a step that finishes on its own, so a tap moves a full column. Pressing the other way mid-step turns back. A released step that meets a wall or a tower leans and springs back; one that meets a walker waits for it. A tap into a tower never pushes.
- **Push-back defense:** a shop being pushed can walk into the attacker. That is a bump (the pushed shop stands one floor above its attacker, which is why bumps reach one floor), which resets the push. It always bounces both, even though the attacker moved first. This is the only defense.
- **After a topple:** fallen shops are stunned for `stunTime` and immune to being pushed for `immuneTime` (shown by a dizzy wobble).
- **Edge towers can't be toppled** (nowhere to fall).
- **Podium blocks** (the end card only) are floors under a column's stack: a walker climbs onto one a floor up, and one two or more floors up is a wall, never a push.
- **Carrying:** a walking shop carries everything above it. Carried shops count as sitting, so they can still catch parachuters, but walk-ins can't get past the walker's legs to reach them. A rider can step off at any time.
- **Strain telegraph:** a tower being pushed wobbles visibly before it goes. That wobble is also the cue for the defender to look up.

## 7. Customers

### Walk-ins (from the bottom, both phases)

- Shoppers **cross the street** from the bottom edge toward the shop **directly in front of them** (`sidestep = 0`).
- They enter the **lowest open, sitting shop** in that column. Closed shops are skipped: shoppers go upstairs past them. A walking shop blocks the column: shoppers walk under its legs and don't reach anything riding on it.
- With nowhere to go, they turn around and walk back (shown in grey). Missed customers should be visible.
- Crossing takes `crossTime` (≈2.5s). Below ~1.5s nobody can react in time; above ~3s it stops mattering.

### Arrival pattern: crosswalk waves + trickle

- **Trickle:** a thin stream of walk-ins anywhere, all the time, so every shop earns something and everyone learns "sitting earns, walking gets skipped".
- **Waves:** a crosswalk `waveWidth` columns wide appears somewhere on the street.
  - **Telegraph (decided after the prototype):** no numeric countdown. The crosswalk appears empty, then its `waveLines` horizontal bars are drawn bottom to top, one every `waveLineInterval`. The wave steps off as the last bar is drawn (4 bars at 0.5 s: the same 2 s warning the prototype tested). The empty outline shows `waveOutline` before the first bar's count starts, out of the pause, so players get an early hint of where to go; the bars, the wave and the bots keep the timing above.
  - `waveSize` shoppers then cross over `waveSpawn` seconds.
  - The crosswalk fades, waits `wavePause`, and appears somewhere else (at least one width away).
- Why waves: they reduce position luck compared to a drifting crowd, and they give a reason to look up.

### Parachuters (phase 2)

- Fall from the sky with sideways drift (`wind`), and enter the **first open shop they touch, from the top.**
- Walking shops count at their full walking height, so walking intercepts parachuters. That is intended: in phase 2, walking pays.
- Parachuters that reach the street become walk-ins.

## 8. Idle shutters (locked)

- A shop with no input for `idleTime` (≈12s) **pulls its shutters down**. The shutters drop visibly over the last `idleWarn` seconds (≈4s).
- A closed shop earns nothing. Any press reopens it.
- Climbing onto a closed shop takes its customers (walk-ins go upstairs to you).
- Off in the lobby: players are looking down to set up their shop.
- This also handles dropped or disconnected phones: their shop closes on its own instead of holding a column forever.
- Known limit: it beats idle phones, not campers. A tap every ~10s keeps a shop open, and a tap into a wall or a tall neighbor does it without moving (elsewhere a tap costs a step). Waves and phase 2 are what make people move.

## 9. Scoring

- **A customer pays the shop they enter. Nothing is shared.** Shared tower revenue was tested and rejected: it balanced the bots but is invisible to players.
- **A walk-in pays `walkInValue` (5), a parachuter `paraValue` (10), the same in both phases (decided after M2).** Every coin on the street shows exactly what it added, so the final score adds up from what players saw. A coin rises from the customer who paid, or, for a walk-in that climbed past shuttered shops, from the shop it entered; the shop that got paid flashes a thick yellow ring that washes out like the coin. Whole numbers, no decimals. Phase 1 weighs less through timing and the walk-in to parachuter ratio, not a hidden multiplier.

## 10. Tunables (starting values from the prototype)

| Name | Default | Meaning |
|---|---|---|
| minPlayers | 12 | Bots fill the street up to this many shops when the round begins |
| roundTime | 120 s | Whole round |
| paraStart | 60 s | Phase 2 begins |
| cellTime | 0.45 s | Time to walk one column |
| walkLift | 1.0 | Leg height in floors |
| pushTime | 0.9 s | Sustained push to topple (0.8–1.0 s accounts for human reaction + network) |
| stunTime | 0.5 s | Stun after toppling |
| immuneTime | 2.0 s | Can't be pushed again after toppling |
| bumpStun | 0.35 s | Stun after a bump |
| crossTime | 2.5 s | Walk-in crossing time |
| sidestep | 0 | Columns a walk-in will sidestep |
| trickleRate | 4 / player / min | Background walk-ins |
| waveWidth | 4 columns | Crosswalk width |
| waveLines | 4 | Telegraph bars, drawn bottom to top |
| waveLineInterval | 0.5 s | Time per telegraph bar |
| waveSize | 20 | Shoppers per wave |
| waveSpawn | 3 s | Time over which a wave steps off |
| wavePause | 4 s | Gap before the next crosswalk's bars start |
| waveOutline | 2 s | How early the empty outline shows, out of that gap |
| paraRate | 12 / player / min | Parachuters in phase 2 |
| wind | 0.8 columns/s | Parachute drift |
| groundInPhase2 | true | Walk-ins continue in phase 2 |
| idleTime | 12 s | No input before shutters close |
| idleWarn | 4 s | Visible shutter drop before closing |
| walkInValue | 5 | A walk-in's pay |
| paraValue | 10 | A parachuter's pay |
| firstBlocks / secondBlocks / thirdBlocks | 2 / 1 / 1 | Podium blocks under each place |
| clearMax | 6 s | Longest the takeover waits for the middle to clear before the blocks drop |
| blockSettle | 1 s | From the blocks dropping to the winners setting off |
| winnerGap | 1.2 s | Between one winner setting off and the next |
| freeAfter | 3 s | From the winner reaching the top to free play |

All tunables live in `packages/sim/src/config.ts`, together with the constants the prototype hard-coded (lean, bump gap, speeds, bot timings). The screen's tuning panel edits them live and, in dev, saves them back into that file.

## 11. What bot testing showed

From the prototype's headless bot runs (`reference/bench.js`). Bots are not people, but they find dominant strategies fast.

- Without idle shutters, a shop that never moves earns as much as anyone in phase 1 (0.93–1.08× movers). With them, ~0.2× in phase 1 and ~0.01× over a round.
- Waves cut position luck vs a drifting crowd: newcomer income spread 0.37 vs 0.64 at 16 players, 0.72 vs 0.91 at 30.
- With top-only pay, walk-and-sit players still out-earn climbers over a full round (≈1.5–1.65× average vs ≈0.9×). Phase 2 balance is the main open problem.
- If walk-ins stop in phase 2, bots that just wander earn ≈1.9×: a walking shop stands taller and intercepts parachuters. Walking, not climbing, is what phase 2 currently rewards.
- Climbing toward a tower you can't step onto means toppling it. Expect players to wreck towers they meant to join.

## 12. Open questions

1. **Phase 2 balance with top-only pay.** Climbing and towers don't pay enough yet, and stopping walk-ins in phase 2 swings the advantage to constant walking. Levers to test: more parachuters, higher `paraValue`, walk-ins stopping in phase 2, wider parachute drift, a shorter walking height in phase 2. `reference/bench.js` has a section for this.
2. **Wreck-then-climb.** Holding into a tall tower knocks the top off, then climbs what is left. Probably the strongest single move. Watch it in playtests.
3. **Idle warning visibility.** Players watch the big screen, not their phone. Is a 4s shutter drop on screen enough, now that each row clicks as it drops? Consider a phone buzz.
4. **Shop readability at 30 players** on a real projector from the back of the room.

## 13. Rejected (don't reintroduce without a reason)

| Idea | Why it was dropped |
|---|---|
| 8-slot phone grid to pick a spot | Pulls eyes down to the phone |
| Physics / continuous positions | Unpredictable on stage; grid made every rule a clean comparison |
| Ghosting overlapping shops | Kills the comedy and makes finding yourself harder |
| Shared tower revenue (split or every floor) | Balanced the bots, but invisible and hard to explain |
| Walkers shove shorter shops | Fixed ground camping but removed climbing; rules got hard to intuit |
| Shoved shops pop onto neighbor roofs | Only needed for shoving |
| Fixed crosswalks | Whoever parks there wins and can't be moved |
| Drifting crowd band | More position luck than waves |
| Numeric countdown on crosswalks | Replaced by bars drawn one per second |
| Phase 1 earnings weighted down (×0.3) | Invisible: a coin said +1 but added 0.3, so totals didn't match the street |
| Pick one of 4 designs | One shop to swipe through, with your name already on it, shows the result directly |
| Picking your own color | Colors must stay findable with up to 30 players; assigned hues guarantee it |
| Joining mid-round | Joining is slow and pulls eyes down; a replay reopens the lobby instead |
| Profanity filter | Filters miss things; the presenter's list renames or removes a shop |
