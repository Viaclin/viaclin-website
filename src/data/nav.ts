export interface NavLink {
  title: string;
  href: string;
  summary?: string;
}

export const services: NavLink[] = [
  {
    title: 'Supply Chain Consultancy',
    href: '/services/supply-chain-consultancy',
    summary: 'Clinical-phase and pre-launch supply expertise.',
  },
  {
    title: 'Project Management',
    href: '/services/project-management',
    summary: 'End-to-end ownership of the projects that decide your timeline.',
  },
  {
    title: 'Optimised Operations',
    href: '/services/optimised-operations',
    summary: 'Proven technology and AI applied with precision, next-gen ready.',
  },
];

export const primary: NavLink[] = [
  { title: 'How we work', href: '/how-we-work' },
  { title: 'Contact', href: '/contact' },
];

export const company: NavLink[] = [
  { title: 'How we work', href: '/how-we-work' },
  { title: 'Contact', href: '/contact' },
  { title: 'Search', href: '/search' },
];

export const legal: NavLink[] = [
  { title: 'Privacy notice', href: '/privacy' },
  { title: 'Terms of use', href: '/terms' },
  { title: 'Cookie policy', href: '/cookies' },
  { title: 'Accessibility', href: '/accessibility' },
  { title: 'Legal and compliance', href: '/legal' },
];
