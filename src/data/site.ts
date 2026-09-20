// One place for every fact about the company. An empty string renders nothing on the site.
export const site = {
  name: 'Viaclin',
  legalName: 'Viaclin Limited',
  url: 'https://viaclin.com',
  email: 'info@viaclin.com',
  vat: 'IE4754731LH',
  croNumber: '820040',
  registeredOffice: 'Fenero, Block D, Tyrrelstown Plaza, Dublin 15, D15 K4PY, Ireland',
  linkedin: '',
  country: 'Ireland',
  descriptor: 'Life science consultancy',
  strapline: 'We push the project.',
  summary:
    'Life sciences supply chain consultancy: supply chain consultancy, project management and operations excellence, delivered by senior operators with one accountable lead per engagement.',
  // The address on the previous site (supplyai.eu) now serves a parking page, so nothing links until the owner confirms one.
  sisterBrand: { name: 'SupplyAI', url: '' },
  // How long enquiry data is kept, for example '24 months'. Empty renders a neutral sentence on /privacy.
  enquiryRetention: '30 days',
  // Legal pages carry a "Draft for solicitor review" line while this is true (owner's spec, section 8.9).
  legalDraft: true,
  ga4: import.meta.env.PUBLIC_GA4_ID ?? '',
  clarity: import.meta.env.PUBLIC_CLARITY_ID ?? '',
  gsc: import.meta.env.PUBLIC_GSC_VERIFICATION ?? '',
  web3formsKey: import.meta.env.PUBLIC_WEB3FORMS_KEY ?? '',
  legalUpdated: '2026-09-17',
} as const;

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-09-17" to "17 September 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

/** Build date, shown in the footer as the site's last update. */
export const builtOn = new Date().toISOString().slice(0, 10);
