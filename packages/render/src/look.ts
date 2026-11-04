// Visual-only constants. Gameplay numbers (speeds, timings, sizes of the street) always come from the sim config.
// Sizes are in art pixels or fractions of a cell (GRID), times are in seconds, rates per second, angles in radians.
// The look to match is reference/pixel-street.html.

import type { PaletteColor } from './colors.ts';

export const TAU = Math.PI * 2;

// Art pixels per column and per floor. Everything on the street is drawn on this grid, then scaled up
export const GRID = {
  cellW: 32,
  cellH: 26,
};

export const STREET_LOOK = {
  // Sidewalk plus asphalt, in floors, and the sidewalk's share of it
  streetDepth: 2.4,
  sidewalkShare: 0.32,
  // Sky above the highest parachuter spawn, so a canopy is never cut off
  skyHeadroom: 1,
  // Neighboring sky bands blend over this share of a band's height, centered on the edge
  skyBlend: 0.3,
  // How fast the view zooms out (or back in) as towers grow
  zoomRate: 1.5,
  // Paving joints across the sidewalk, as a share of a column, offset from the column edge
  jointSpacing: 0.5,
  jointOffset: 0.25,
  // Light specks in the asphalt: one per this many art pixels of road
  speckArea: 40,
  // Distant buildings along the ground line: widths in art pixels, heights in floors
  skylineMinW: 14,
  skylineMaxW: 34,
  skylineMinH: 1,
  skylineMaxH: 3,
  // Square windows on a grid, kept clear of the walls and the ground
  skylineWindowSize: 2,
  skylineWindowStep: 6,
  skylineWindowInset: 4,
  skylineWindowChance: 0.45,
  // Sometimes a narrow gap between neighbors
  skylineGap: 2,
  skylineGapChance: 0.4,
  // Sometimes tucked behind the last one instead, by a share of the narrower of the two (at most half, so only neighbors overlap)
  skylineOverlapChance: 0.4,
  skylineOverlapMin: 0.2,
  skylineOverlapMax: 0.5,
  // Clouds drift right; each one is faster than the last, on its own row of the sky
  clouds: 3,
  cloudSpeed: 2,
  cloudSpeedStep: 0.5,
  cloudSpacing: 194,
  cloudTop: 0.1,
  cloudRowStep: 0.2,
  // Fixed seeds, so the skyline and the specks are the same every round
  skylineSeed: 3,
  speckSeed: 5,
};

export const CROSSWALK_LOOK = {
  // Gap between the crosswalk and the column edges, sidewalk and bottom of the road
  inset: 2,
  // The empty crosswalk: a blinking dashed outline
  dash: 2,
  dashGap: 2,
  blinkRate: 6,
  blinkOn: 0.75,
  blinkOff: 0.35,
  // Bars fill this share of their slot
  barShare: 0.55,
  minBar: 2,
  barAlpha: 0.9,
  // Each bar fades in through the same steps the crossing wave fades out by (never fully until it is gone); a fade-in
  // takes this share of the time between bars, so it's done before the next one
  fadeSteps: 3,
  fadeFloor: 0.15,
  fadeInShare: 0.6,
};

export const SHOP_LOOK = {
  // The body is this share of a column wide; the roof ledge fills the rest of the floor, so stacked shops touch
  bodyWidth: 0.84,
  roofShare: 0.1,
  minRoof: 2,
  // Rows of the body: sign (plus a padding row above and below the name), awning, then the shopfront
  signShare: 0.32,
  minSign: 5,
  signPad: 1,
  signInset: 0.05,
  signLines: 2,
  // Lines of a name are this share of a capital apart; a name never sets smaller than this capital height
  signLineGap: 0.35,
  signMinCap: 2.5,
  awningShare: 0.18,
  minAwning: 3,
  // Striped awnings: stripe width as a share of the body
  stripeShare: 1 / 9,
  minStripe: 2,
  // Shopfront: side margins, door width, the door's glass and knob height (shares of the door)
  frontMargin: 0.07,
  doorShare: 0.2,
  minDoor: 3,
  doorGlassShare: 0.25,
  knobAt: 0.55,
  // The barber pole turns, the café cup steams
  poleShare: 0.07,
  poleRate: 6,
  steamRate: 3,
  // Hues snap to steps along the golden angle, so neighbors in the list never look alike
  hueSpread: 137.508,
  hueOffset: 20,
  hueSnap: 15,
  // Exponential follow toward the grid position: sideways, and down a floor
  followRate: 16,
  dropRate: 11,
  // Climbing up a floor takes this share of a step (MOVEMENT.cellTime), easing in and out: the shop moves into the
  // next column halfway through a step, so half a step finishes the climb as the step ends
  climbShare: 0.5,
  // Standing up or sitting down takes this long
  standTime: 0.125,
  flashTime: 0.4,
  pushMeterHeight: 0.07,
  minPushMeter: 2,
  pushMeterGap: 0.14,
  // Sprites drawn for a shop's look and state; the cache starts over past this many
  spriteCache: 512,
};

// Thin ink legs: two equal segments with the knees bent outward, so sitting down folds the knees out sideways
export const LEG_LOOK = {
  // Leg width as a share of a column; hips and knees as a share of the body width
  legShare: 1 / 16,
  hipSpread: 0.24,
  kneeOut: 0.06,
  // How far a foot reaches forward (of the body width) and lifts on a passing frame (of a floor)
  reach: 0.12,
  footRaise: 0.1,
  // Under this many art pixels of lift, legs aren't drawn
  minLift: 2,
  // A side-view stride: frames per stride, strides per column walked
  stridesPerCell: 2,
  framesPerStride: 4,
  // Closer than this to its grid position (in columns), a walking shop stands still
  moveSettle: 0.02,
  // Climbing: over the first share of the climb the front foot lifts (of a floor) and reaches forward (of the body
  // width), then plants on the step and straightens as the body rises over it
  climbLiftShare: 0.4,
  climbFootRaise: 0.5,
  climbReach: 0.5,
};

// Shorts over the top of the legs: every shop wears its own pair (colors.ts picks it)
export const UNDIES_LOOK = {
  // Height as a share of a floor, and the middle's share of that: each leg's part hangs lower than the middle
  share: 0.24,
  minRows: 4,
  middle: 0.5,
  // Each leg's part sits out past its hip by this share of a column
  spread: 0.06,
  // Dots on every other row, each dot row shifted along; stripes run down every few columns
  dotStep: 3,
  dotStagger: 2,
  stripeStep: 2,
  // While standing up the shorts stay this far off the ground, and aren't drawn shorter than minShow rows
  groundGap: 2,
  minShow: 3,
};

export const MOTION_LOOK = {
  // A tower under a push leans toward its fall and shakes harder as the push nears pushTime; the pusher leans with it
  strainLean: 0.07,
  strainWobble: 0.05,
  strainRate: 32,
  stunShake: 0.03,
  stunRate: 45,
  // Immune after a topple: a slow dizzy sway with stars circling the roof
  dizzyAngle: 0.07,
  dizzyRate: 7,
  dizzyStars: 3,
  dizzyOrbitX: 0.45,
  dizzyOrbitY: 0.1,
  dizzyHeight: 0.16,
  // Toppled shops fly to the far column on an arc, tumbling, then squash as they land
  arcTime: 0.5,
  arcHeight: 1.1,
  arcSpin: Math.PI,
  squashTime: 0.25,
  squash: 0.2,
  // A shop that joins falls from this many floors above the sky, landing with the same squash; shops that join together
  // (the bots, as a round begins) drop one after another, dropStagger apart
  dropAbove: 1,
  dropTime: 0.6,
  dropStagger: 0.05,
};

export const PEOPLE_LOOK = {
  // Where a shopper's feet are on the sidewalk, from its top edge
  sidewalkFeet: 0.7,
  // Shoppers start this far below the bottom edge, in art pixels
  farBelow: 4,
  // Walk-ins cross on lanes spread over this middle share of their column, not all down its center
  laneSpread: 0.6,
  stepRate: 8,
  // Shoppers with nowhere to go walk back across the street, greyed out and fading
  leaveTime: 1,
  leaveAlpha: 0.6,
  leaveFade: 0.5,
  // A customer who pays stays put as a coin-yellow silhouette, then washes out through the text wash keyframes, each
  // frame an equal share of buyTime
  buyTime: 0.5,
  // Canopy radius as a share of a column; rows, and the gap down to the hands, as shares of the radius
  canopyShare: 0.2,
  minCanopy: 4,
  canopyRows: 0.75,
  minCanopyRows: 3,
  canopyGap: 0.9,
  canopyPanel: 0.4,
  minCanopyPanel: 2,
  // Canopies sway in one-pixel steps instead of rotating
  swayRate: 2.5,
  swayGain: 1.4,
  swayShift: 1,
};

export const FX_LOOK = {
  // Callouts and coins: capital height and outline thickness, in art pixels
  calloutCap: 7.5,
  calloutRing: 1,
  coinCap: 5,
  coinRing: 1,
  // A coin starts this many art pixels above the customer who paid: a walk-in's head, a parachuter's canopy
  coinAbove: 2,
  calloutTime: 0.9,
  calloutRise: 1,
  calloutAbove: 0.4,
  coinTime: 0.9,
  coinRise: 0.6,
  // Text holds full strength for this share of its life, then washes out through the wash keyframes
  fadeHold: 0.6,
  // Fades are palette keyframes, never alpha: how far the fill goes toward white, how much of its color it loses, and the outline
  wash: [
    { light: 0.45, gray: 0, outline: 'greyLo' },
    { light: 0.7, gray: 1, outline: 'grey' },
  ] as const satisfies readonly { light: number; gray: number; outline: PaletteColor }[],
  burstTime: 0.3,
  burstSize: 0.3,
  burstRays: 8,
  // A burst's rays start this far out and grow to full length
  burstStart: 0.4,
  bannerTime: 2.5,
  // A round opens with the street held for readyHold, READY? showing over the start of it, then GO! as play starts
  readyHold: 1.5,
  readyTime: 1.5,
  goTime: 1.5,
  // Every banner is set at the size that makes the phase banner span this share of the street, and washes in and out
  // over this share of its life at each end
  bannerWidth: 0.35,
  bannerFade: 0.2,
  // Effect text, titles and shop names are smooth display type, the HUD's --font-display; titles are outlined by this share of their size
  displayFont: "'EAS VHS', 'Arial Black', Impact, sans-serif",
  titleOutline: 0.18,
  // Oldest effects are dropped past this many, so a burst of events can't pile up
  maxEffects: 300,
};
