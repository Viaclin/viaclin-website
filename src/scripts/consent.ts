// Stub. Task 6 replaces this with the consent banner logic. The exports are the contract.
export interface Consent {
  analytics: boolean;
  insights: boolean;
}

export function getConsent(): Consent {
  return { analytics: false, insights: false };
}

export function onConsent(_callback: (consent: Consent) => void): void {}

export function initConsent(): void {}
