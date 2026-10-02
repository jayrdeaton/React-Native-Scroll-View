import { usesContentInset } from './insetMode'

// Extra distance past the geometrically-required hide distance, so a soft shadow (a FAB's) that
// bleeds past the bar's box doesn't leave a sliver at the screen edge once fully hidden.
export const CHROME_SLACK = 2

// How far a list can actually be scrolled from its resting position. In inset mode the resting
// position sits at -headerHeight and raw contentOffset spans [-headerHeight, maxScroll]; in padding
// mode the header is part of the content and raw spans [0, maxScroll].
export const chromeTravel = (maxScroll: number, headerHeight: number) => {
  'worklet'
  return usesContentInset ? maxScroll + headerHeight : maxScroll
}

// Where a half-hidden stack should come to rest once scrolling stops: whichever end is nearer.
export const chromeSettleTarget = (offset: number, stackHeight: number) => {
  'worklet'
  return offset > stackHeight / 2 ? stackHeight : 0
}
