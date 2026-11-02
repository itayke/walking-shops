# Walking Shops: Game Design

The opening game of the Untame pitch. A room of 10–30 potential clients (mostly local business owners) joins from their phones. Each person's business becomes a shop on a shared Main Street on the big screen. Shops grow legs and walk to where the customers are. Then the town becomes the hub for the rest of the talk.

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

1. **Lobby (≈40s):** the screen shows the title and a QR code over the street. Players scan it and set up their shop on the phone (see "Joining"), and each shop drops from the sky into a random column as it opens. From then on the phone is its controller, and the street is a brawl without consequences: every movement rule applies, but no customers come, nothing scores and shutters stay open. The street widens as shops arrive. Only the lobby takes new players.
2. **Begin:** the presenter starts the round. The title and QR clear, bots drop into the widest empty gaps until there are `minPlayers` shops, then READY? GO! across the street: the street holds still until GO!, and the round clock starts with it. Shops start where the brawl left them.
3. **Phase 1, walk-ins (≈40–60s):** the tutorial in disguise. Low stakes.
4. **Phase 2, parachutes (≈60s):** the real game.
5. **Results (≈20s):** leaderboard on screen; each phone shows "Your shop: N customers". A replay goes back to the lobby: the bots leave, the QR comes back, new players join, and everyone else keeps their shop.
6. **Town hub:** shops walk back and settle into Main Street. Untame's own buildings (Workshop = client work, Arcade = original games) are stops for the rest of the talk.
7. **Close:** every phone shows a contact card: site, LinkedIn, Save contact (vCard), a shareable image of their shop, and a permanent URL that works tomorrow.

## 4. Phone

### Joining

- **One field: the shop's name.** Its placeholder is a funny suggestion, and opening the shop with the field blank uses it.
- **Live preview:** the phone draws the shop exactly as the big screen will, with the same sign fitting and font, so the name wraps and shrinks on the sign as you type. A letter that would push the name under the sign's smallest size isn't accepted, so nothing is ever cut off on the big screen.
- **Shop type:** one shop on screen; arrows or a swipe cycle through the types, starting at a random one.
- **Color is assigned,** never picked: hues are handed out so that a repeated hue always goes to a different shop type, which keeps every shop findable.
- **Editing:** until the round begins, a player can go back to the form. The shop stays on the street with its current name and type, and an edit applies only when confirmed. If the round begins mid-edit, the edit is dropped and the phone becomes the controller.
- A player who hasn't opened their shop by the time the round begins waits for the replay.

### Presenter list

- Next to the QR, the screen lists the shops that have joined, like the scoreboard, and how many phones are still setting up. Clicking a name renames the shop; a remove button takes it off the street. That stands in for a profanity filter.
- A phone that disconnects in the lobby keeps its shop until the presenter removes it.

### Controls

- The whole phone is two halves: **tap left / tap right to step one column; hold to keep walking.** Release and you sit at the next column. Pushing a tower takes a hold.
- No other UI during play. The phone shows your shop's tint, big, so you can play without looking at it.
- All feedback is on the big screen: your shop lurches when you press, and pressing brings it to the front of a cluster.

## 5. The street

- A side view of one street, divided into **columns** (a grid). Each column holds a stack of shops.
- Logic is grid-based; animation is smooth (walk cycles, squash on landing, tumbles on scripted arcs). No physics engine.
- Column count: `max(players + 4, 1.5 × players)`, capped by readability (about 18 on a 1080p screen). At 30 players the street is full and stacking is forced. That is accepted.
- Shop size is uniform: every shop is one floor tall.

### Look (pixel art, decided)

The mockup is `reference/pixel-street.html`, and the screen renderer draws it. Visual only: none of this changes a rule.

- **Grid:** 32 art pixels per column, a 32×26 cell. Daylight palette.
- **Shops** are drawn in code from parts (sign, awning, wall, window, door) in a pool of designs, colored by the player's three-shade tint ramp. A shop fills its whole floor (27×23 body plus a 3-pixel roof ledge), so stacked shops touch.
- **Signs:** the name in Jersey 15, drawn over the shop at full resolution but hard-edged like the rest of the street, every pixel solid ink or clear (it leans and spins with the shop), set as large as the sign allows on one line or split between words onto two. A name that would set smaller than a minimum size is wrapped at that size and cut off with a dot. A row of padding under the roof line.
- **Motion:** lean, dizzy sway, topple spin and the landing squash rotate and scale the drawn shop, even where pixels leave the grid. A pusher leans with the tower's strain pulses; the push meter stays put.
- **Legs:** thin ink legs with a side-view four-frame stride. Every leg animation is drawn facing right; facing left mirrors the legs (only the legs) pixel for pixel. Two equal segments per leg: standing up and sitting down bend the knees out sideways (about 0.125 s) instead of stretching the legs. Climbing a floor steps up: the front foot lifts onto the shop ahead and straightens as the body rises with it, so the climb reads as stepping up a stair.
- **Underwear:** shorts over the top of the legs, each leg's part hanging lower than the middle. Every shop wears one pair, picked from its name: dots or vertical stripes in one of six tacky color pairs. They mirror with the legs.
- **People** (walk-ins, parachuters) are hand-drawn pixel maps, 5×10 with a one-pixel outline. A shirt is never paired with a skin tone too close to it.
- **Text and fades:** effect text (callouts, coins) and titles (the READY? GO! countdown and the phase banner, all one size) are smooth display type, the HUD's Jersey 15, outlined in ink: coins as tall as the 3×5 pixel font they replaced, callouts a little taller, titles larger (a pixel font scaled up stops reading as pixel art). Text never fades with real alpha: it washes out toward white through a few palette keyframes (a title washes in and out the same way).
- **No marker over your own shop:** everyone shares one screen, and each phone shows its shop's tint.
- **Scale:** the street scales by whatever fits every column and the sky (centered when the height is what limits it), and eases as towers grow. At a scale that isn't a whole number, some art pixels are a device pixel wider than others.
- **Open:** whether to step the zoom between whole-number scales instead.

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
  - **Telegraph (decided after the prototype):** no numeric countdown. The crosswalk appears empty, then its `waveLines` horizontal bars are drawn bottom to top, one every `waveLineInterval`. The wave steps off as the last bar is drawn (4 bars at 0.5 s: the same 2 s warning the prototype tested).
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
- **A walk-in pays `walkInValue` (5), a parachuter `paraValue` (10), the same in both phases (decided after M2).** Every coin on the street shows exactly what it added, so the final score adds up from what players saw. Whole numbers, no decimals. Phase 1 weighs less through timing and the walk-in to parachuter ratio, not a hidden multiplier.

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
| wavePause | 4 s | Gap before the next crosswalk |
| paraRate | 12 / player / min | Parachuters in phase 2 |
| wind | 0.8 columns/s | Parachute drift |
| groundInPhase2 | true | Walk-ins continue in phase 2 |
| idleTime | 12 s | No input before shutters close |
| idleWarn | 4 s | Visible shutter drop before closing |
| walkInValue | 5 | A walk-in's pay |
| paraValue | 10 | A parachuter's pay |

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
3. **Idle warning visibility.** Players watch the big screen, not their phone. Is a 4s shutter drop on screen enough? Consider a phone buzz.
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
