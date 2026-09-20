// The spinning dot-sphere from the previous site's hero, recoloured to the brand.
// Points sit on a Fibonacci lattice; colours come from --sphere-a and --sphere-b so both themes work.
export function initSphere(): void {
  const canvas = document.getElementById('sphere') as HTMLCanvasElement | null;
  const host = canvas?.parentElement;
  if (!canvas || !host) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const SIZE = 520;
  const R = SIZE / 2;
  const radius = R * 0.84;
  const COUNT = 440;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    points.push([Math.cos(GOLDEN * i) * ring, y, Math.sin(GOLDEN * i) * ring]);
  }

  const tilt = 0.42;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  let angle = 0;
  let colourA = '37 130 83';
  let colourB = '10 41 72';
  // Comma form, built once per theme rather than once per point per frame.
  let rgbA = '37,130,83';
  let rgbB = '10,41,72';

  const readColours = () => {
    const style = getComputedStyle(document.documentElement);
    colourA = style.getPropertyValue('--sphere-a').trim() || colourA;
    colourB = style.getPropertyValue('--sphere-b').trim() || colourB;
    rgbA = colourA.split(' ').join(',');
    rgbB = colourB.split(' ').join(',');
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = host.getBoundingClientRect().width || SIZE;
    const next = Math.round(css * dpr);
    // Writing canvas.width clears the bitmap, so skip the write when the backing size is unchanged.
    if (next === canvas.width) return;
    canvas.width = canvas.height = next;
    ctx.setTransform(canvas.width / SIZE, 0, 0, canvas.width / SIZE, 0, 0);
  };

  const draw = () => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    for (let i = 0; i < COUNT; i++) {
      const [x0, y0, z0] = points[i];
      const x = x0 * ca - z0 * sa;
      const z = x0 * sa + z0 * ca;
      const y = y0 * ct - z * st;
      const depth = (y0 * st + z * ct + 1) / 2;
      const rgb = i % 5 === 0 ? rgbB : rgbA;
      ctx.beginPath();
      ctx.arc(R + x * radius, R + y * radius, 0.8 + depth * 1.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${(0.1 + depth * 0.8).toFixed(3)})`;
      ctx.fill();
    }
  };

  readColours();
  resize();

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const frozen = () => reduce.matches || document.documentElement.classList.contains('static');
  let frame = 0;
  let visible = false;
  let last = 0;

  // The spin is paced by elapsed time, so a 120 Hz screen turns the sphere at the same rate as a
  // 60 Hz one. A long gap (a background tab, a slow frame) is capped so the sphere never jumps.
  const tick = (now: number) => {
    const dt = last ? Math.min(now - last, 50) : 16.7;
    last = now;
    angle += 0.000192 * dt;
    draw();
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    const run = visible && !frozen() && !document.hidden;
    if (run && !frame) frame = requestAnimationFrame(tick);
    if (!run && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    }
    if (!run) draw();
  };

  // Animate while the sphere is on screen and the tab is in front; rest otherwise.
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(host);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);
  document.addEventListener('viaclin:theme', () => {
    readColours();
    if (!frame) draw();
  });
  window.addEventListener('resize', () => {
    resize();
    if (!frame) draw();
  }, { passive: true });
  draw();
}
