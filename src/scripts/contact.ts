// Contact: the start-a-conversation popup and every contact form on the page.
// States: empty (hints), error (per field and summary), sending, success, failure, email fallback.
import { openDialog } from './dialog';
import { track } from './analytics';
import { getUtm } from './utm';

const CLOSE_OUT_MESSAGE = 'I would like to discuss the nine-step close-out.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isCheckbox(field: Field): field is HTMLInputElement {
  return field instanceof HTMLInputElement && field.type === 'checkbox';
}

/** Every error begins with the label the visitor can see. A label that ends in a question mark takes no colon. */
function withLabel(label: string, text: string): string {
  if (label.endsWith('?')) return `${label} ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  return `${label}: ${text}`;
}

function messageFor(field: Field): string {
  const label = field.dataset.label ?? field.name;
  if (isCheckbox(field)) {
    return field.checked ? '' : withLabel(label, 'tick the box so we can reply to you.');
  }
  const value = field.value.trim();
  if (!value) {
    if (field instanceof HTMLSelectElement) return withLabel(label, 'choose the stage that fits best.');
    if (field.name === 'message') return withLabel(label, 'tell us a little about the programme.');
    return withLabel(label, 'this field is empty.');
  }
  if (field.name === 'email' && !EMAIL_PATTERN.test(value)) {
    return withLabel(label, 'enter an address like name@company.com.');
  }
  return '';
}

function showError(field: Field, message: string): void {
  const error = document.getElementById(`${field.id}-error`);
  if (error) error.textContent = message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
}

function applyTopic(root: HTMLElement, topic: string | undefined | null): void {
  if (topic !== 'close-out') return;
  const stage = root.querySelector<HTMLSelectElement>('select[name="stage"]');
  const message = root.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
  if (stage) stage.value = 'Trial close-out';
  if (message && !message.value) message.value = CLOSE_OUT_MESSAGE;
}

function wireForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form');
  if (!form) return;
  // The markup carries no novalidate, so the browser checks the form when this script never runs.
  // With the script running, the messages below take over.
  form.noValidate = true;
  const fields = Array.from(form.querySelectorAll<Field>('[required]'));
  const summary = root.querySelector<HTMLElement>('[data-summary]');
  const submit = root.querySelector<HTMLButtonElement>('[data-submit]');
  const submitLabel = root.querySelector<HTMLElement>('[data-submit-label]');
  const hasKey = root.dataset.hasKey === 'true';
  const email = root.dataset.email ?? '';
  let started = false;

  fields.forEach((field) => {
    field.addEventListener('blur', () => {
      // A checkbox always has a value ("yes"), so it counts as touched once it is ticked.
      const touched = isCheckbox(field) ? field.checked : field.value !== '';
      if (touched || field.getAttribute('aria-invalid')) showError(field, messageFor(field));
    });
    field.addEventListener('input', () => {
      if (!started) {
        started = true;
        track('form_start', { form: root.closest('dialog') ? 'dialog' : 'page' });
      }
      if (field.getAttribute('aria-invalid')) showError(field, messageFor(field));
    });
    field.addEventListener('change', () => {
      if (field.getAttribute('aria-invalid')) showError(field, messageFor(field));
    });
  });

  const setBusy = (busy: boolean) => {
    if (!submit) return;
    submit.disabled = busy;
    submit.classList.toggle('is-busy', busy);
    if (submitLabel) submitLabel.textContent = busy ? 'Sending' : 'Send';
  };

  const finish = (which: 'done' | 'mailto-done') => {
    const panel = root.querySelector<HTMLElement>(`[data-${which}]`);
    const title = panel?.querySelector<HTMLElement>('[tabindex="-1"]');
    form.hidden = true;
    if (panel) panel.hidden = false;
    title?.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (summary) summary.textContent = '';

    const problems = fields.map((field) => [field, messageFor(field)] as const).filter(([, message]) => message);
    fields.forEach((field) => showError(field, messageFor(field)));
    if (problems.length) {
      if (summary) {
        summary.textContent =
          problems.length === 1 ? 'One field needs attention before this can send.' : `${problems.length} fields need attention before this can send.`;
      }
      problems[0][0].focus();
      return;
    }

    // Campaign values ride along with the enquiry.
    const utm = getUtm();
    form.querySelectorAll<HTMLInputElement>('[data-utm]').forEach((input) => {
      input.value = utm[input.name] ?? '';
    });

    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    track('form_submit', { form: root.closest('dialog') ? 'dialog' : 'page', stage: data.stage });

    if (!hasKey) {
      // No form service configured: hand the enquiry to the visitor's email app.
      // Campaign values that have something in them follow the message as one line.
      const campaign = Object.entries(utm)
        .filter(([, value]) => value)
        .map(([name, value]) => `${name}=${value}`)
        .join(', ');
      const body = [
        `Name: ${data.name}`,
        `Company: ${data.company}`,
        `Work email: ${data.email}`,
        `Programme stage: ${data.stage}`,
        '',
        data.message,
        ...(campaign ? ['', `Campaign: ${campaign}`] : []),
      ].join('\n');
      window.location.href = `mailto:${email}?subject=${encodeURIComponent('Website enquiry: viaclin.com')}&body=${encodeURIComponent(body)}`;
      finish('mailto-done');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean };
      if (!response.ok || result.success === false) throw new Error(`Form service answered ${response.status}`);
      track('generate_lead', { stage: data.stage });
      finish('done');
    } catch (error) {
      console.error('[viaclin] enquiry did not send', error);
      if (summary) {
        summary.textContent = `That did not send. Email ${email} and we will pick it up.`;
        summary.focus();
      }
    } finally {
      setBusy(false);
    }
  });
}

export function initContact(): void {
  document.querySelectorAll<HTMLElement>('[data-contact-form]').forEach(wireForm);

  // /contact?topic=close-out fills the page form.
  const topic = new URLSearchParams(window.location.search).get('topic');
  const pageForm = document.querySelector<HTMLElement>('main [data-contact-form]');
  if (pageForm) applyTopic(pageForm, topic);

  const dialog = document.getElementById('convo-dialog') as HTMLDialogElement | null;
  if (!dialog || typeof dialog.showModal !== 'function') return;

  document.addEventListener('click', (event) => {
    const opener = (event.target as HTMLElement | null)?.closest<HTMLElement>('.js-convo');
    if (!opener) return;
    // On the contact page the form is already in front of the visitor.
    if (pageForm && !opener.closest('dialog')) {
      event.preventDefault();
      applyTopic(pageForm, opener.dataset.topic);
      pageForm.scrollIntoView({ block: 'start' });
      pageForm.querySelector<HTMLElement>('input:not([type="hidden"]):not([type="checkbox"])')?.focus({ preventScroll: true });
      return;
    }
    event.preventDefault();
    const form = dialog.querySelector<HTMLElement>('[data-contact-form]');
    if (form) applyTopic(form, opener.dataset.topic);
    openDialog(dialog, opener);
    track('modal_open', { place: opener.dataset.trackPlace ?? 'unknown', topic: opener.dataset.topic ?? 'general' });
  });
}
