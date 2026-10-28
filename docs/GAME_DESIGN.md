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
| Players | 10–30, on their own phones, joined by QR, no app, no signup |
| Length | 2–3 minutes of play |
| Tutorial | None. Every rule must be visible on the big screen |
| Attention | Eyes stay on the big screen. The phone is a blind controller |
| Network | Venue Wi‑Fi or cellular. Must survive dropped phones |

## 3. Flow

1. **Join (≈40s):** scan QR, type business name (pre-filled with a funny suggestion so blank never stalls), pick one of 4 shop designs drawn at random from a larger pool, name rendered on the sign. Each player also gets a unique tint so duplicates are findable.
2. **Phase 1, walk-ins (≈40–60s):** the tutorial in disguise. Low stakes.
3. **Phase 2, parachutes (≈60s):** the real game.
4. **Results (≈20s):** leaderboard on screen; each phone shows "Your shop: N customers".
5. **Town hub:** shops walk back and settle into Main Street. Untame's own buildings (Workshop = client work, Arcade = original games) are stops for the rest of the talk.
6. **Close:** every phone shows a contact card: site, LinkedIn, Save contact (vCard), a shareable image of their shop, and a permanent URL that works tomorrow.

## 4. Controls (phone)

- The whole phone is two halves: **hold left / hold right to walk.** Release to sit.
- No other UI during play. The phone shows your shop's tint, big, so you can play without looking at it.
- All feedback is on the big screen: your shop lurches when you press, and pressing brings it to the front of a cluster.

## 5. The street

- A side view of one street, divided into **columns** (a grid). Each column holds a stack of shops.
- Logic is grid-based; animation is smooth (walk cycles, squash on landing, tumbles on scripted arcs). No physics engine.
- Column count: `max(players + 4, 1.5 × players)`, capped by readability (about 18 on a 1080p screen). At 30 players the street is full and stacking is forced. That is accepted.
- Shop size is uniform: every shop is one floor tall.

## 6. Movement rules (locked)

**Your height:** a sitting shop is 1 floor. A walking shop stands on legs one floor tall, so it is 2 floors high and carries everything stacked on its roof. Heights are measured from the surface under your feet.

**One sentence for the player:** legs reach one floor. One floor up, you climb. Higher, you push until the top falls off.

| You walk into a column whose top is… | Result |
|---|---|
| At or below your feet | Step across / step down onto it |
| One floor above your feet | **Climb** onto it |
| Two or more floors above your feet | **Push.** Hold for `pushTime` and everything above your first floor **topples** to the far side, landing on top of whatever is there. You can then climb what is left |
| A walker pressing toward you, within one floor of your level | **Bump:** both bounce back |

- **Spring-back:** release before crossing half a cell and you snap back. Past half a cell you commit.
- **Push-back defense:** a shop being pushed can walk into the attacker. That is a bump (the pushed shop stands one floor above its attacker, which is why bumps reach one floor), which resets the push. This is the only defense and needs no extra rule.
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
- This also handles dropped or disconnected phones: their shop closes on its own instead of holding a column forever.
- Known limit: it beats idle phones, not campers. A tap every ~10s keeps a shop open without moving. Waves and phase 2 are what make people move.

## 9. Scoring

- **A customer pays the shop they enter. Nothing is shared.** Shared tower revenue was tested and rejected: it balanced the bots but is invisible to players.
- **Phase 1 earnings count ×`phase1Weight` (≈0.3)** so the tutorial phase doesn't decide the winner. Alternative: show the scoreboard only from phase 2.
- **A parachuter is worth `paraValue` (≈3) walk-ins.**

## 10. Tunables (starting values from the prototype)

| Name | Default | Meaning |
|---|---|---|
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
| phase1Weight | 0.3 | Phase 1 score multiplier |
| paraValue | 3 | Parachuter worth in walk-ins |

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
