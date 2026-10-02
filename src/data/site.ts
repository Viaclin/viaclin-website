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
  descriptor: 'Life Science Consultancy',
  strapline: 'We push the project.',
  // The mission band on the home page reads its heading and both paragraphs from here.
  tagline: 'Life: Changing',
  mission: {
    lead: 'Behind every shipment is a patient waiting for treatment. Our mission is to make sure it reaches them: the right medicine, in the right place, at the right time.',
    support:
      'We design the supply chains, drive the projects and optimise the operations that carry a therapy from discovery to the patient. When the chain holds, treatment starts on the day it was promised.',
  },
  // Feeds the default meta description and the JSON-LD description, so it stays under 200 characters.
  summary:
    'Life sciences supply chain consultancy that helps treatments reach patients: supply chain consultancy, project management and optimised operations, run by senior operators with one accountable lead.',
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
