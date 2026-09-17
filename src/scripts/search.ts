// Site search on Pagefind. One controller per search box, shared by the dialog and the /search page.
// States: idle (hint and suggested pages), loading (skeleton), results, empty, unavailable (no index on the dev server).
import { openDialog, closeDialog } from './dialog';
import { track } from './analytics';

interface PagefindHit {
  url: string;
  excerpt: string;
  content?: string;
  meta: { title?: string };
}

interface PagefindResponse {
  results: Array<{ id: string; data: () => Promise<PagefindHit> }>;
}

interface Pagefind {
  options(options: Record<string, unknown>): Promise<void>;
  init(): Promise<void>;
  search(query: string, options?: Record<string, unknown>): Promise<PagefindResponse>;
  debouncedSearch(query: string, options?: Record<string, unknown>, wait?: number): Promise<PagefindResponse | null>;
}

type State = 'idle' | 'loading' | 'results' | 'empty' | 'unavailable';

interface Controller {
  root: HTMLElement;
  input: HTMLInputElement;
  warm(): void;
  settle(): void;
  query(value: string): void;
}

const DEBOUNCE_MS = 200;
const TRACK_AFTER_MS = 1200;
const DIALOG_LIMIT = 8;
const PAGE_LIMIT = 24;
const ELLIPSIS = String.fromCharCode(0x2026);
const NBSP = String.fromCharCode(0xa0);

/* ───────── Pagefind, loaded once and on demand ───────── */
let engine: Promise<Pagefind | null> | null = null;

function loadPagefind(): Promise<Pagefind | null> {
  if (!engine) {
    // The bundle is written into the built site after the Astro build, so the path stays a runtime value.
    const path = '/pagefind/pagefind.js';
    engine = import(/* @vite-ignore */ path)
      .then(async (module: Pagefind) => {
        await module.options({ excerptLength: 24 });
        await module.init();
        return module;
      })
      .catch(() => null);
  }
  return engine;
}

/* ───────── helpers ───────── */
/** "/services/trial-close-out.html" to "/services/trial-close-out"; "/index.html" to "/". */
export function cleanUrl(url: string): string {
  const [, path = '', tail = ''] = url.match(/^([^?#]*)(.*)$/) ?? [];
  const clean = path.replace(/\.html$/, '').replace(/\/index$/, '');
  return (clean === '' ? '/' : clean) + tail;
}

function plural(count: number): string {
  return count === 1 ? '1 result' : `${count} results`;
}

function inField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/* ───────── one search box ───────── */
function createSearch(root: HTMLElement): Controller | null {
  const form = root.querySelector<HTMLFormElement>('[data-search-form]');
  const input = root.querySelector<HTMLInputElement>('[data-search-input]');
  const clear = root.querySelector<HTMLButtonElement>('[data-search-clear]');
  const status = root.querySelector<HTMLElement>('[data-search-status]');
  const body = root.querySelector<HTMLElement>('[data-search-body]');
  const list = root.querySelector<HTMLElement>('[data-search-list]');
  const suggest = root.querySelector<HTMLElement>('[data-search-suggest]');
  const more = root.querySelector<HTMLElement>('[data-search-more]');
  const moreLink = root.querySelector<HTMLAnchorElement>('[data-search-more-link]');
  if (!form || !input || !status || !body || !list) return null;

  const onPage = root.dataset.searchRoot === 'page';
  const host = root.dataset.host ?? window.location.host;
  const limit = onPage ? PAGE_LIMIT : DIALOG_LIMIT;
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-search-panel]'));

  let state: State = 'idle';
  let run = 0;
  let settledQuery = '';
  let pendingTrack: { term: string; results: number } | null = null;
  let lastTracked = '';
  let trackTimer = 0;

  const setState = (next: State) => {
    state = next;
    root.dataset.state = next;
    panels.forEach((panel) => (panel.hidden = panel.dataset.searchPanel !== next));
    // Suggested pages keep the reader moving whenever there are no results to show.
    if (suggest) suggest.hidden = next === 'results' || next === 'loading';
    body.setAttribute('aria-busy', String(next === 'loading'));
  };

  const flushTrack = () => {
    window.clearTimeout(trackTimer);
    if (pendingTrack && pendingTrack.term !== lastTracked) {
      track('search', { search_term: pendingTrack.term, results: pendingTrack.results });
      lastTracked = pendingTrack.term;
    }
    pendingTrack = null;
  };

  // A search counts once the reader pauses on it, follows a result or leaves; never per keystroke.
  const queueTrack = (term: string, results: number) => {
    window.clearTimeout(trackTimer);
    pendingTrack = { term, results };
    trackTimer = window.setTimeout(flushTrack, TRACK_AFTER_MS);
  };

  const syncUrl = (query: string) => {
    if (!onPage) return;
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState(window.history.state, '', url);
  };

  const row = (hit: PagefindHit, index: number): HTMLLIElement => {
    const href = cleanUrl(hit.url);
    const path = href.replace(/[?#].*$/, '');
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'search-hit search-hit--new';
    link.href = href;
    link.dataset.searchHit = '';
    link.style.setProperty('--i', String(Math.min(index, 8)));

    const title = document.createElement('span');
    title.className = 'search-hit__title';
    title.textContent = (hit.meta.title ?? '').replace(/: Viaclin$/, '').trim() || path;

    // Pagefind escapes page text and adds the <mark> tags itself, so the excerpt is safe to place as markup.
    const excerpt = document.createElement('span');
    excerpt.className = 'search-hit__excerpt';
    excerpt.innerHTML = hit.excerpt;
    // An excerpt cut from the middle of the page says so at each open end.
    const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
    const plain = squash(excerpt.textContent ?? '');
    const whole = squash(hit.content ?? '');
    const at = plain ? whole.indexOf(plain) : -1;
    if (at > 0) excerpt.prepend(ELLIPSIS + NBSP);
    if (at !== -1 && at + plain.length < whole.length) excerpt.append(NBSP + ELLIPSIS);

    const address = document.createElement('span');
    address.className = 'search-hit__url';
    address.textContent = path === '/' ? host : host + path;

    link.append(title, excerpt, address);
    item.append(link);
    return item;
  };

  const render = (hits: PagefindHit[], total: number, query: string) => {
    settledQuery = query;
    syncUrl(query);
    queueTrack(query, total);
    if (!total) {
      list.replaceChildren();
      status.textContent = `No results for ${query}`;
      setState('empty');
      return;
    }
    list.replaceChildren(...hits.map(row));
    status.textContent =
      total > hits.length ? `Showing ${hits.length} of ${plural(total)} for ${query}` : `${plural(total)} for ${query}`;
    if (more && moreLink) {
      more.hidden = onPage || total <= hits.length;
      moreLink.href = `/search?q=${encodeURIComponent(query)}`;
      moreLink.textContent = `See all ${total} results`;
    }
    setState('results');
    body.scrollTop = 0;
  };

  const unavailable = () => {
    status.textContent = 'Search works on the built site.';
    setState('unavailable');
  };

  const search = async (raw: string, now = false) => {
    const query = raw.trim();
    const id = ++run;
    if (clear) clear.hidden = raw === '';
    if (!query) {
      settledQuery = '';
      status.textContent = '';
      list.replaceChildren();
      setState('idle');
      syncUrl('');
      return;
    }
    if (now && query === settledQuery && (state === 'results' || state === 'empty')) return;
    // First answer: skeleton rows. Later answers: the last results stay in place, dimmed, until the new ones land.
    if (state === 'results') body.setAttribute('aria-busy', 'true');
    else setState('loading');

    const pagefind = await loadPagefind();
    if (id !== run) return;
    if (!pagefind) {
      unavailable();
      return;
    }
    try {
      const response = now ? await pagefind.search(query) : await pagefind.debouncedSearch(query, {}, DEBOUNCE_MS);
      if (response === null || id !== run) return;
      const hits = await Promise.all(response.results.slice(0, limit).map((result) => result.data()));
      if (id !== run) return;
      render(hits, response.results.length, query);
    } catch {
      if (id === run) unavailable();
    }
  };

  const caretToEnd = () => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };

  const links = () =>
    Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-search-hit]')).filter((link) => !link.closest('[hidden]'));

  input.addEventListener('input', () => void search(input.value));

  // Enter confirms the query; a second Enter steps into the results.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query && query === settledQuery && state === 'results') links()[0]?.focus();
    else void search(input.value, true);
  });

  clear?.addEventListener('click', () => {
    input.value = '';
    void search('');
    input.focus();
  });

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const stops: HTMLElement[] = [input, ...links()];
    const at = stops.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const to = event.key === 'ArrowDown' ? at + 1 : at - 1;
      if (to < 0 || to >= stops.length) return;
      event.preventDefault();
      stops[to].focus();
      if (to === 0) caretToEnd();
    } else if (at > 0 && (event.key === 'Backspace' || (event.key.length === 1 && event.key !== ' '))) {
      // Typing while a result has focus carries on in the field.
      input.focus();
      caretToEnd();
    }
  });

  // A search field clears itself on Escape before the dialog hears about it. In the dialog, Escape closes
  // in one press and the query stays for the next visit.
  input.addEventListener('keydown', (event) => {
    const dialog = root.closest('dialog');
    if (event.key !== 'Escape' || !dialog || event.isComposing) return;
    event.preventDefault();
    closeDialog(dialog);
  });

  root.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!link || !root.contains(link)) return;
    flushTrack();
    // A result on the page already open still needs the dialog out of the way.
    const dialog = root.closest('dialog');
    if (dialog) closeDialog(dialog);
  });

  window.addEventListener('pagehide', flushTrack);

  return {
    root,
    input,
    warm: () => {
      void loadPagefind().then((pagefind) => {
        if (!pagefind && state === 'idle') unavailable();
      });
    },
    settle: flushTrack,
    query: (value: string) => {
      input.value = value;
      void search(value, true);
    },
  };
}

/* ───────── wiring: openers, keys, the /search page ───────── */
export function initSearch(): void {
  const dialog = document.getElementById('search-dialog') as HTMLDialogElement | null;
  const dialogRoot = dialog?.querySelector<HTMLElement>('[data-search-root="dialog"]') ?? null;
  const pageRoot = document.querySelector<HTMLElement>('[data-search-root="page"]');
  const inDialog = dialogRoot ? createSearch(dialogRoot) : null;
  const onPage = pageRoot ? createSearch(pageRoot) : null;

  const otherDialogOpen = () => {
    const open = document.querySelector('dialog[open]');
    return open !== null && open !== dialog;
  };

  const open = (opener?: HTMLElement | null) => {
    // On /search the box is already on the page: go to it instead of stacking a dialog over it.
    if (onPage) {
      onPage.input.focus();
      onPage.input.select();
      return;
    }
    if (!dialog || !inDialog || otherDialogOpen()) return;
    if (!dialog.open) {
      openDialog(dialog, opener);
      track('modal_open', { place: opener?.dataset.trackPlace ?? (opener ? 'button' : 'keyboard'), topic: 'search' });
    }
    inDialog.input.focus();
    inDialog.input.select();
    inDialog.warm();
  };

  dialog?.addEventListener('close', () => inDialog?.settle());

  document.addEventListener('click', (event) => {
    const opener = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-search-open]');
    if (!opener) return;
    event.preventDefault();
    open(opener);
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const command = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
    const typing = inField(event.target) || inField(document.activeElement);
    const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !typing;
    if (!command && !slash) return;
    if (otherDialogOpen()) return;
    event.preventDefault();
    if (command && dialog?.open) closeDialog(dialog);
    else open();
  });

  if (onPage) {
    // The page exists to search, so the index loads with it and ?q= runs at once.
    onPage.warm();
    const query = new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
    if (query) onPage.query(query);
  }
}
