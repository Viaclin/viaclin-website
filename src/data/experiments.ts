// A/B experiments. An experiment runs when `active` is true and the visitor has granted insights consent.
// Markup contract: <a data-ab="hero-cta" data-ab-operator="Talk to a senior operator">Start a conversation</a>
// The first variant is the control: it is the text already in the markup.
export interface Experiment {
  /** Matches the data-ab attribute in the markup. */
  key: string;
  /** Switch an experiment on here. Off means every visitor sees the control. */
  active: boolean;
  /** Variant names. Each one other than the control needs a data-ab-<name> attribute in the markup. */
  variants: string[];
  /** Optional split, one number per variant, in any unit. Left out means an even split. */
  weights?: number[];
}

export const experiments: Experiment[] = [
  {
    key: 'hero-cta',
    active: false,
    variants: ['control', 'operator'],
  },
];
