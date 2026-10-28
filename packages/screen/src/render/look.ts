// Visual-only constants. Gameplay numbers (speeds, timings, sizes of the street) always come from the sim config.
// Sizes are fractions of a cell (cellW / cellH), times are in seconds, rates per second, angles in radians.

export const TAU = Math.PI * 2;

export const STREET_LOOK = {
  // Tallest a cell gets relative to its width; a short street gets more sky instead
  cellAspect: 0.82,
  // Sidewalk plus asphalt, in floors, and the sidewalk's share of it
  streetDepth: 2.4,
  sidewalkShare: 0.32,
  // Sky above the highest parachuter spawn, so a canopy is never cut off
  skyHeadroom: 1,
  // How fast the view zooms out (or back in) as towers grow
  zoomRate: 1.5,
  curbTickHeight: 0.5,
  curbTickAlpha: 0.35,
};

export const CROSSWALK_LOOK = {
  // Gap at each side of the crosswalk, and above and below it on the asphalt
  insetX: 0.06,
  insetY: 0.1,
  // The empty crosswalk: a pulsing dashed outline
  dash: [8, 6],
  outlineWidth: 2,
  pulseRate: 6,
  outlineAlpha: 0.5,
  // Each new bar grows in from the center
  barGrowTime: 0.18,
  barAlpha: 0.9,
  // A crossing wave fades out, but never fully until it is gone
  fadeFloor: 0.15,
};

export const SHOP_LOOK = {
  bodyWidth: 0.84,
  bodyHeight: 0.8,
  awningShare: 0.26,
  awningStripes: 5,
  // Stripes alternate the shop's tint with this much darker
  stripeDarken: 14,
  windowInset: 0.12,
  windowTop: 0.4,
  windowAlpha: 0.55,
  shutterSlats: 6,
  labelSize: 0.2,
  labelMaxShare: 0.32,
  outline: 1.5,
  humanOutline: 4,
  legWidth: 0.045,
  legMinWidth: 1.5,
  // Hips from the body's center, and how far the knees bend outward (of the body width)
  hipSpread: 0.24,
  kneeOut: 0.06,
  // Leg swing per column walked, and how far a foot swings
  stridesPerCell: 2,
  strideReach: 0.1,
  // Golden-angle hues, so neighbors in the list never look alike
  hueStep: 137.508,
  hueOffset: 20,
  // Exponential follow toward the grid position: sideways, up and down, legs
  followRate: 16,
  climbRate: 11,
  legRate: 14,
  // Under this many pixels the legs aren't drawn
  minLegPixels: 1,
  // The bouncing arrow over your own shop
  markerSize: 0.14,
  markerAspect: 1.2,
  markerGap: 0.28,
  markerBob: 0.05,
  markerBobRate: 5,
  pushMeterHeight: 0.07,
  pushMeterGap: 0.08,
  pushTrackAlpha: 0.3,
  flashTime: 0.4,
  flashWidth: 3,
};

export const MOTION_LOOK = {
  // A tower under a push leans toward its fall and shakes harder as the push nears pushTime
  strainLean: 0.07,
  strainWobble: 0.05,
  strainRate: 32,
  stunShake: 0.03,
  stunRate: 45,
  // Immune after a topple: a slow dizzy sway with dots circling the roof
  dizzyAngle: 0.07,
  dizzyRate: 7,
  dizzyDots: 3,
  dizzyOrbitX: 0.45,
  dizzyOrbitY: 0.11,
  dizzyDotSize: 0.035,
  dizzyHeight: 0.18,
  // Toppled shops fly to the far column on an arc, tumbling, then squash as they land
  arcTime: 0.5,
  arcHeight: 1.1,
  arcSpin: Math.PI,
  squashTime: 0.25,
  squash: 0.2,
};

export const PEOPLE_LOOK = {
  shopperSize: 0.085,
  shopperMinSize: 2.5,
  shopperLine: 1.5,
  // Where a shopper's feet are on the sidewalk, from its top edge
  sidewalkFeet: 0.7,
  // Shoppers with nowhere to go walk back across the street, greyed out
  leaveTime: 1,
  leaveAlpha: 0.6,
  canopySize: 0.17,
  canopyMinSize: 5,
  canopyLift: 1.7,
  swayAngle: 0.12,
  swayRate: 2.5,
};

export const FX_LOOK = {
  calloutTime: 0.9,
  calloutRise: 1,
  calloutAbove: 0.4,
  calloutSize: 0.28,
  calloutMinSize: 12,
  coinTime: 0.6,
  coinRise: 0.8,
  coinSize: 0.07,
  burstTime: 0.3,
  burstSize: 0.3,
  burstRays: 8,
  bannerTime: 2.5,
  bannerSize: 0.06,
  // Oldest effects are dropped past this many, so a burst of events can't pile up
  maxEffects: 300,
};
