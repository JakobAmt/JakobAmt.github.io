(() => {
  const canvas = document.getElementById('flowfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Tweakables ----
  const COLOR      = 'rgba(0, 180, 216, 0.22)'; // line colour + opacity
  const LINE_WIDTH = 1.2;
  const CELL       = 8;        // grid resolution in px (smaller = smoother lines, more CPU)
  const SCALE      = 0.0025;   // terrain zoom (smaller = bigger blobs)
  const LEVELS     = 8;       // number of contour heights
  const MORPH      = 0.00002;  // how fast the shapes change shape (per ms)
  const PAN        = 2;        // sideways drift in px per second
  const FPS        = 30;       // motion is slow, so 30 fps is plenty and saves battery

  // ---- 3D Perlin noise (x, y, time) ----
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];

  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function grad(h, x, y, z) {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function perlin(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z),         grad(p[BA], x - 1, y, z), u),
           lerp(grad(p[AB], x, y - 1, z),     grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1),     grad(p[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }
  // Two octaves: big shapes + a bit of wobbly detail
  const terrain = (x, y, z) =>
    (perlin(x, y, z) + 0.5 * perlin(x * 2 + 17.3, y * 2 + 9.1, z * 1.5)) / 1.5;

  // ---- Contour levels ----
  const levels = Array.from({ length: LEVELS }, (_, i) => -0.5 + (i + 0.5) / LEVELS);

  // Marching squares lookup: which cell edges each case connects
  // edges: 0 = top, 1 = right, 2 = bottom, 3 = left
  const SEG = [
    [], [3, 2], [2, 1], [3, 1], [0, 1], [0, 1, 3, 2], [0, 2], [3, 0],
    [3, 0], [0, 2], [3, 0, 2, 1], [0, 1], [3, 1], [2, 1], [3, 2], []
  ];

  let W, H, cols, rows, field;
  let ex = 0, ey = 0;

  function edgePoint(e, x, y, tl, tr, br, bl, L) {
    switch (e) {
      case 0: ex = x + CELL * (L - tl) / (tr - tl); ey = y; break;
      case 1: ex = x + CELL; ey = y + CELL * (L - tr) / (br - tr); break;
      case 2: ex = x + CELL * (L - bl) / (br - bl); ey = y + CELL; break;
      case 3: ex = x; ey = y + CELL * (L - tl) / (bl - tl); break;
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL) + 1;
    rows = Math.ceil(H / CELL) + 1;
    field = new Float32Array(cols * rows);
  }

  function render(now) {
    const z = now * MORPH;
    const offsetX = (now / 1000) * PAN * SCALE;

    // 1. Sample the terrain height on a grid
    for (let j = 0; j < rows; j++) {
      const ny = j * CELL * SCALE;
      for (let i = 0; i < cols; i++) {
        field[j * cols + i] = terrain(i * CELL * SCALE + offsetX, ny, z);
      }
    }

    // 2. Trace contour lines with marching squares
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (const L of levels) {
      for (let j = 0; j < rows - 1; j++) {
        const y = j * CELL;
        for (let i = 0; i < cols - 1; i++) {
          const k = j * cols + i;
          const tl = field[k], tr = field[k + 1];
          const bl = field[k + cols], br = field[k + cols + 1];
          const c = (tl > L ? 8 : 0) | (tr > L ? 4 : 0) | (br > L ? 2 : 0) | (bl > L ? 1 : 0);
          if (c === 0 || c === 15) continue;

          const seg = SEG[c];
          const x = i * CELL;
          for (let s = 0; s < seg.length; s += 2) {
            edgePoint(seg[s], x, y, tl, tr, br, bl, L);
            ctx.moveTo(ex, ey);
            edgePoint(seg[s + 1], x, y, tl, tr, br, bl, L);
            ctx.lineTo(ex, ey);
          }
        }
      }
    }
    ctx.stroke();
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    render(now);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reduceMotion) render(0);
    }, 150);
  });

  resize();
  if (reduceMotion) render(0);
  else requestAnimationFrame(frame);
})();