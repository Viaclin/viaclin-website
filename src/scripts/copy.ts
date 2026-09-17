// Copy buttons: <button data-copy="text to copy">. Confirms in the label and in the live region.
async function write(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and insecure origins: fall back to a hidden field.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    field.remove();
    return ok;
  }
}

export function initCopy(): void {
  const live = document.getElementById('live-region');
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
    const text = button.querySelector<HTMLElement>('[data-copy-label]');
    const idle = text?.textContent ?? 'Copy';
    let timer = 0;
    button.addEventListener('click', async () => {
      const ok = await write(button.dataset.copy ?? '');
      const message = ok ? 'Copied' : 'Copy failed';
      if (text) text.textContent = message;
      button.classList.toggle('is-done', ok);
      if (live) live.textContent = ok ? `${button.dataset.copy} copied to the clipboard` : 'Copy failed. Select the text and copy it by hand.';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (text) text.textContent = idle;
        button.classList.remove('is-done');
      }, 2200);
    });
  });
}
