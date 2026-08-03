export const CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'For parts'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const LISTING_OPTIONS = [
  'Delivery available',
  'Local pickup',
  'Open to trades',
  'Original packaging',
  'Warranty included',
  'Bundle deal',
] as const;
export type ListingOption = (typeof LISTING_OPTIONS)[number];
