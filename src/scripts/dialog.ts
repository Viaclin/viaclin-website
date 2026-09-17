// Shared dialog helpers on top of the native <dialog>: focus trap, Escape and the inert page come free.
// Adds: focus return to the opener, close on backdrop click, [data-dialog-close] buttons, layout events.
const openers = new WeakMap<HTMLDialogElement, HTMLElement | null>();
const wired = new WeakSet<HTMLDialogElement>();

function wire(dialog: HTMLDialogElement): void {
  if (wired.has(dialog)) return;
  wired.add(dialog);

  dialog.addEventListener('click', (event) => {
    // A click on the dialog element itself is a click on the backdrop.
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.querySelectorAll<HTMLElement>('[data-dialog-close]').forEach((button) =>
    button.addEventListener('click', () => closeDialog(dialog)),
  );
  dialog.addEventListener('close', () => {
    const opener = openers.get(dialog);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('viaclin:layout'));
  });
}

export function openDialog(dialog: HTMLDialogElement, opener?: HTMLElement | null): void {
  wire(dialog);
  if (dialog.open) return;
  openers.set(dialog, opener ?? (document.activeElement as HTMLElement | null));
  dialog.showModal();
  document.dispatchEvent(new CustomEvent('viaclin:layout'));
}

export function closeDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) dialog.close();
}
