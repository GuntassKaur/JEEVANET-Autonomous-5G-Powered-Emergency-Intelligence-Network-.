(function () {
  const canvas = document.getElementById("siteHeroCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let raf = 0;

  function size() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const parent = canvas.parentElement;
    const w = Math.max(320, parent.clientWidth || parent.offsetWidth || 800);
    const h = Math.max(280, parent.clientHeight || parent.offsetHeight || 500);
    canvas.width = Math.floor(w * d);
    canvas.height = Math.floor(h * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  const trail = [];
  let t0 = 0;
  let running = true;

  function draw(ts) {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    if (!t0) t0 = ts;
    const t = (ts - t0) * 0.001;
    const parent = canvas.parentElement;
    const w = Math.max(320, parent.clientWidth || 800);
    const h = Math.max(280, parent.clientHeight || 400);
    ctx.fillStyle = "#050a12";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 209, 255, 0.07)";
    ctx.lineWidth = 1;
    const step = 44;
    const off = (t * 16) % step;
    for (let x = -off; x < w + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = -off; y < h + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const cx = w * (0.5 + 0.35 * Math.sin(t * 0.4));
    const cy = h * (0.5 + 0.2 * Math.cos(t * 0.35));
    trail.push({ x: cx, y: cy });
    if (trail.length > 70) trail.shift();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < trail.length - 1; i++) {
      const a = (i / trail.length) * 0.4;
      ctx.strokeStyle = "rgba(0, 255, 156, " + a * 0.35 + ")";
      ctx.lineWidth = 14 - (i / trail.length) * 7;
      ctx.beginPath();
      ctx.moveTo(trail[i].x, trail[i].y);
      ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
      ctx.stroke();
    }
    for (let i = 0; i < trail.length - 1; i++) {
      const a = (i / trail.length) * 0.5;
      ctx.strokeStyle = "rgba(0, 209, 255, " + a + ")";
      ctx.lineWidth = 7 - (i / trail.length) * 4;
      ctx.shadowColor = "#00d1ff";
      ctx.shadowBlur = 10 * (i / trail.length);
      ctx.beginPath();
      ctx.moveTo(trail[i].x, trail[i].y);
      ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  window.addEventListener("resize", size);
  requestAnimationFrame(() => {
    size();
    raf = requestAnimationFrame(draw);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      running = true;
      raf = requestAnimationFrame(draw);
    }
  });
})();

