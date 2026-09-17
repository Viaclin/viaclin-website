export type VideoKey = 'technician' | 'pumps' | 'labelling' | 'robot' | 'warehouse' | 'driver';

export interface Film {
  /** Path stem. Files: `${base}-1280.mp4`, `${base}-720.mp4`, `${base}.jpg`. */
  base: string;
  /** What the footage shows, for the poster alt text and the pause button label. */
  alt: string;
  /** Short caption shown in the glass chip. */
  chip: string;
}

// In page order: the footage follows the product from cleanroom to doorstep.
export const videos: Record<VideoKey, Film> = {
  technician: {
    base: '/video/01-technician',
    alt: 'A technician in cleanroom gowning checks stainless steel bioreactors',
    chip: 'Cleanroom monitoring',
  },
  pumps: {
    base: '/video/02-pumps',
    alt: 'Filling pumps dispense liquid into glass vials on a conveyor',
    chip: 'Fill and finish',
  },
  labelling: {
    base: '/video/03-labelling',
    alt: 'A labelling machine applies labels to pharmaceutical vials',
    chip: 'Labelling',
  },
  robot: {
    base: '/video/04-robot',
    alt: 'A robotic arm places vials into cartons on a packaging line',
    chip: 'Robotic packaging',
  },
  warehouse: {
    base: '/video/05-warehouse',
    alt: 'An automated shuttle stocks pallets in a high-bay warehouse',
    chip: 'Automated depot',
  },
  driver: {
    base: '/video/06-driver',
    alt: 'A delivery driver carries a temperature-controlled medical parcel to a door',
    chip: 'The last mile',
  },
};
