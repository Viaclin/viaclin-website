// Consultant experience banner. The order is the owner's and stays as written.
//
// name   Shown as text when there is no logo file, and read out by assistive tech in every case.
// file   Optional single-colour SVG in src/assets/clients (every fill set to currentColor, tight viewBox,
//        no width or height attributes). Leave it out and the name is typeset in the site typeface.
// scale  Optional optical correction for a logo, as a multiple of the band height.
//        Wide wordmarks sit near 0.6 to 0.8; compact or stacked marks sit near 1.2 to 1.5.
export interface Client {
  name: string;
  file?: string;
  scale?: number;
}

// Logo files came from Wikimedia Commons (Special:FilePath) on 18 September 2026 and were converted
// to a single colour without any change of shape. Companies without a clean vector source stay typeset.
export const clients: Client[] = [
  { name: 'Roche', file: 'roche.svg', scale: 1.15 },
  { name: 'Novartis', file: 'novartis.svg', scale: 0.85 },
  { name: 'Novo Nordisk' },
  { name: 'AstraZeneca', file: 'astrazeneca.svg', scale: 0.66 },
  { name: 'Sanofi', file: 'sanofi.svg', scale: 0.8 },
  { name: 'GSK' },
  { name: 'Bayer', file: 'bayer.svg', scale: 1.4 },
  { name: 'Regeneron', file: 'regeneron.svg', scale: 0.7 },
  { name: 'Karuna Therapeutics' },
  { name: 'Theratechnologies' },
  { name: 'Avadel', file: 'avadel.svg', scale: 0.95 },
  { name: 'MorphoSys', file: 'morphosys.svg', scale: 1.1 },
  { name: 'CureVac', file: 'curevac.svg', scale: 1.25 },
  { name: 'Dark Blue Therapeutics' },
  { name: 'Amolyt Pharma' },
  { name: 'Johnson & Johnson', file: 'jnj.svg', scale: 0.5 },
  { name: 'Amicus Therapeutics' },
  { name: 'Carmot Therapeutics' },
];
