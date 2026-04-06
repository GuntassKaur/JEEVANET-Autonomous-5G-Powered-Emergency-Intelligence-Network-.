(function () {
      const canvas = document.getElementById("mapCanvas");
      const ctx = canvas.getContext("2d");
      const routeText = document.getElementById("routeText");
      const logInner = document.getElementById("logInner");
      const modalBackdrop = document.getElementById("modalBackdrop");
      const openModal = document.getElementById("openModal");
      const closeModal = document.getElementById("closeModal");

      function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvas._w = rect.width;
        canvas._h = rect.height;
      }

      window.addEventListener("resize", resize);
      resize();

      const demoSettings = {
        signalPreempt: true,
        railSync: true,
        solarCorridor: true,
        dronesEnabled: true,
        wearableUplink: true,
        langBroadcast: true,
        zeroTrustHud: true,
        auditChain: true,
        edgeGain: 0.72,
      };

      const mapFrame = document.getElementById("mapFrame");
      const slotDash = document.getElementById("map-slot-dashboard");
      const slotAmb = document.getElementById("map-slot-ambulance");

      function moveMapToView(viewId) {
        if (!mapFrame || !slotDash || !slotAmb) return;
        const target = viewId === "ambulance" ? slotAmb : slotDash;
        if (mapFrame.parentElement !== target) target.appendChild(mapFrame);
        requestAnimationFrame(() => {
          resize();
          window.dispatchEvent(new Event("resize"));
        });
      }

      function setView(viewId) {
        const id = viewId || "dashboard";
        document.querySelectorAll(".view").forEach((v) => {
          v.classList.toggle("view--active", v.getAttribute("data-view-id") === id);
        });
        moveMapToView(id);
      }

      const COL = {
        blue: "#00d1ff",
        green: "#00ff9c",
        red: "#ff3b3b",
        dim: "rgba(0, 209, 255, 0.12)",
      };

      const accidents = [
        { x: 0.72, y: 0.38 },
        { x: 0.28, y: 0.62 },
      ];

      const trafficLights = [
        { x: 0.45, y: 0.35, phase: 0 },
        { x: 0.55, y: 0.55, phase: 0.4 },
        { x: 0.35, y: 0.48, phase: 0.7 },
        { x: 0.62, y: 0.42, phase: 0.2 },
      ];

      const railway = { x: 0.5, y: 0.72, barrier: 0 };

      const corridorPath = [
        { x: 0.12, y: 0.78 },
        { x: 0.25, y: 0.65 },
        { x: 0.38, y: 0.52 },
        { x: 0.48, y: 0.45 },
        { x: 0.58, y: 0.38 },
        { x: 0.72, y: 0.32 },
        { x: 0.85, y: 0.22 },
      ];

      const heatZones = [
        { x: 0.72, y: 0.38, r: 0.24, a: 0.32 },
        { x: 0.28, y: 0.62, r: 0.2, a: 0.26 },
        { x: 0.55, y: 0.28, r: 0.14, a: 0.14 },
        { x: 0.38, y: 0.75, r: 0.12, a: 0.1 },
      ];

      const stagingPoints = [
        { x: 0.4, y: 0.28 },
        { x: 0.65, y: 0.5 },
        { x: 0.18, y: 0.45 },
        { x: 0.52, y: 0.22 },
        { x: 0.3, y: 0.35 },
        { x: 0.75, y: 0.42 },
        { x: 0.22, y: 0.58 },
        { x: 0.48, y: 0.62 },
      ];

      function stagingCountLive() {
        const el = document.getElementById("rngStaging");
        if (!el) return 3;
        return Math.max(1, Math.min(8, parseInt(el.value, 10) || 3));
      }

      const drones = [
        { base: { x: 0.07, y: 0.12 }, accIdx: 0, t: 0 },
        { base: { x: 0.93, y: 0.16 }, accIdx: 1, t: 0.4 },
      ];

      function smoothstep(u) {
        const x = Math.max(0, Math.min(1, u));
        return x * x * (3 - 2 * x);
      }

      let ambulanceT = 0;
      const trail = [];

      function drawGrid(w, h, t) {
        ctx.save();
        ctx.strokeStyle = "rgba(0, 209, 255, 0.06)";
        ctx.lineWidth = 1;
        const step = 40;
        const off = (t * 20) % step;
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
        ctx.restore();
      }

      function drawStreets(w, h) {
        ctx.save();
        ctx.strokeStyle = "rgba(232, 244, 255, 0.08)";
        ctx.lineWidth = 3;
        const roads = [
          [[0.08 * w, 0.75 * h], [0.92 * w, 0.25 * h]],
          [[0.15 * w, 0.9 * h], [0.88 * w, 0.15 * h]],
          [[0.5 * w, 0], [0.5 * w, h]],
          [[0, 0.55 * h], [w, 0.55 * h]],
        ];
        roads.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        });
        ctx.restore();
      }

      function drawHeatmap(w, h, t) {
        const gain = 0.35 + demoSettings.edgeGain * 0.9;
        ctx.save();
        heatZones.forEach((z, i) => {
          const pulse = 0.88 + 0.12 * Math.sin(t * 1.15 + i * 0.7);
          const rad = z.r * Math.min(w, h);
          const g = ctx.createRadialGradient(z.x * w, z.y * h, 0, z.x * w, z.y * h, rad);
          const a0 = z.a * pulse * gain;
          g.addColorStop(0, `rgba(255, 59, 59, ${a0})`);
          g.addColorStop(0.4, `rgba(255, 130, 70, ${z.a * 0.45 * pulse * gain})`);
          g.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        });
        ctx.restore();
      }

      function drawStaging(w, h, t) {
        const n = stagingCountLive();
        stagingPoints.slice(0, n).forEach((p, i) => {
          const x = p.x * w;
          const y = p.y * h;
          const b = 0.65 + 0.35 * Math.sin(t * 2.2 + i);
          ctx.save();
          ctx.strokeStyle = `rgba(0, 209, 255, ${0.35 * b})`;
          ctx.fillStyle = `rgba(0, 209, 255, ${0.12 * b})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x - 7, y + 6);
          ctx.lineTo(x + 7, y + 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = COL.blue;
          ctx.font = "bold 8px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText("STG-" + (i + 1), x, y + 18);
          ctx.restore();
        });
      }

      function tickDrones(dt) {
        if (!demoSettings.dronesEnabled) return;
        drones.forEach((d) => {
          d.t += dt * 0.1;
          if (d.t >= 1) d.t = 0;
        });
      }

      function drawDrones(w, h) {
        if (!demoSettings.dronesEnabled) return;
        drones.forEach((d) => {
          const acc = accidents[d.accIdx];
          const u = smoothstep(d.t);
          const x = d.base.x + (acc.x - d.base.x) * u;
          const y = d.base.y + (acc.y - d.base.y) * u;
          const px = x * w;
          const py = y * h;
          ctx.save();
          ctx.strokeStyle = `rgba(0, 209, 255, ${0.2 + 0.25 * u})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(d.base.x * w, d.base.y * h);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowColor = COL.blue;
          ctx.shadowBlur = 16;
          ctx.font = "17px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("🚁", px, py + 6);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(0, 209, 255, 0.95)";
          ctx.font = "8px JetBrains Mono, monospace";
          ctx.fillText("UAV", px, py - 14);
          ctx.restore();
        });
      }

      function drawCorridor(w, h, t) {
        ctx.save();
        ctx.shadowColor = COL.green;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = COL.green;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.85 + Math.sin(t * 2) * 0.08;
        ctx.beginPath();
        corridorPath.forEach((p, i) => {
          const x = p.x * w;
          const y = p.y * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = "rgba(0, 255, 156, 0.35)";
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.restore();
      }

      function posOnCorridor(t) {
        const n = corridorPath.length - 1;
        const seg = t * n;
        const i = Math.min(Math.floor(seg), n - 1);
        const f = seg - i;
        const a = corridorPath[i];
        const b = corridorPath[i + 1];
        return {
          x: a.x + (b.x - a.x) * f,
          y: a.y + (b.y - a.y) * f,
        };
      }

      function drawAccidents(w, h, t) {
        accidents.forEach((acc, idx) => {
          const x = acc.x * w;
          const y = acc.y * h;
          const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + idx * 1.4);
          ctx.save();
          for (let ring = 0; ring < 3; ring++) {
            const phase = (t * 0.85 + idx * 0.31 + ring * 0.34) % 1;
            const rad = 10 + phase * 42;
            const a = (1 - phase) * 0.42;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 59, 59, ${a})`;
            ctx.lineWidth = 1.5 + (1 - phase) * 1.5;
            ctx.shadowColor = COL.red;
            ctx.shadowBlur = (1 - phase) * 16;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          ctx.beginPath();
          ctx.arc(x, y, 14 + pulse * 10, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 59, 59, ${0.18 + pulse * 0.2})`;
          ctx.fill();
          ctx.strokeStyle = COL.red;
          ctx.lineWidth = 2;
          ctx.shadowColor = COL.red;
          ctx.shadowBlur = 22 + pulse * 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(x, y, 5 + pulse * 2, 0, Math.PI * 2);
          ctx.fillStyle = COL.red;
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 11px Exo 2, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("!", x, y + 4);
          ctx.restore();
        });
      }

      function drawTrafficLights(w, h, t, ambNorm) {
        trafficLights.forEach((tl) => {
          const cycle = (t + tl.phase * 4) % 4;
          let green = cycle < 2.2;
          if (demoSettings.signalPreempt && ambNorm) {
            const d = Math.hypot(ambNorm.x - tl.x, ambNorm.y - tl.y);
            if (d < 0.13) green = true;
          }
          const x = tl.x * w;
          const y = tl.y * h;
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.strokeStyle = COL.dim;
          ctx.lineWidth = 1;
          ctx.fillRect(x - 8, y - 22, 16, 44);
          ctx.strokeRect(x - 8, y - 22, 16, 44);
          ctx.beginPath();
          ctx.arc(x, y - 12, 5, 0, Math.PI * 2);
          ctx.fillStyle = green ? "#333" : COL.red;
          if (!green) {
            ctx.shadowColor = COL.red;
            ctx.shadowBlur = 14 + 6 * Math.sin(t * 5 + tl.phase * 8);
          }
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(x, y + 12, 5, 0, Math.PI * 2);
          ctx.fillStyle = green ? COL.green : "#333";
          if (green) {
            ctx.shadowColor = COL.green;
            ctx.shadowBlur = 14 + 8 * Math.sin(t * 4 + tl.phase * 6);
          }
          ctx.fill();
          ctx.shadowBlur = 0;
          if (green && demoSettings.solarCorridor) {
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(255, 200, 80, 0.8)";
            ctx.shadowBlur = 8;
            ctx.fillText("☀", x + 14, y - 20);
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        });
      }

      function drawRailway(w, h, t, ambNorm) {
        const x = railway.x * w;
        const y = railway.y * h;
        let barrierPhase = (Math.sin(t * 0.8) + 1) / 2;
        if (demoSettings.railSync && ambNorm) {
          const d = Math.hypot(ambNorm.x - railway.x, ambNorm.y - railway.y);
          if (d < 0.14) barrierPhase = Math.max(barrierPhase, 0.82);
        }
        railway.barrier = barrierPhase;
        const ambNear =
          demoSettings.railSync &&
          ambNorm &&
          Math.hypot(ambNorm.x - railway.x, ambNorm.y - railway.y) < 0.14;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(0, 209, 255, 0.08)";
        ctx.fillRect(0, y - 6, w, 12);
        if (ambNear) {
          const flash = 0.45 + 0.55 * Math.sin(t * 11);
          ctx.fillStyle = `rgba(255, 59, 59, ${flash * 0.35})`;
          ctx.fillRect(0, y - 8, w, 16);
          ctx.beginPath();
          ctx.arc(x, y - 22, 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 59, 59, ${0.5 + flash * 0.45})`;
          ctx.shadowColor = COL.red;
          ctx.shadowBlur = 20;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        const down = barrierPhase > 0.5;
        const angle = down ? Math.PI * 0.42 : Math.PI * 0.08;
        [-40, 40].forEach((ox) => {
          ctx.save();
          ctx.translate(x + ox, y);
          ctx.rotate(angle * (ox < 0 ? 1 : -1));
          ctx.fillStyle = "rgba(255, 200, 80, 0.9)";
          ctx.fillRect(-3, -50, 6, 50);
          ctx.strokeStyle = COL.blue;
          ctx.strokeRect(-3, -50, 6, 50);
          ctx.restore();
        });
        ctx.fillStyle = COL.blue;
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(down ? "GATE: CLOSED" : "GATE: OPEN", x - 36, y - 14);
        ctx.font = "16px sans-serif";
        ctx.fillText("🚆", x - 10, y + 28);
        ctx.restore();
      }

      function drawEdgeNodes(w, h, t) {
        const nodes = [
          { x: 0.2, y: 0.3 },
          { x: 0.8, y: 0.4 },
          { x: 0.42, y: 0.7 },
        ];
        nodes.forEach((n, i) => {
          const x = n.x * w;
          const y = n.y * h;
          const a = 0.4 + 0.4 * Math.sin(t * 2.5 + i);
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, 20 * a, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 209, 255, ${0.3 + a * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(0, 255, 156, ${0.15})`;
          ctx.fill();
          ctx.fillStyle = COL.green;
          ctx.font = "9px JetBrains Mono";
          ctx.fillText("AI", x - 6, y + 3);
          ctx.restore();
        });
      }

      function drawAmbulance(w, h, t) {
        if (trail.length < 2) return;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 0; i < trail.length - 1; i++) {
          const alpha = (i / trail.length) * 0.28;
          ctx.strokeStyle = `rgba(0, 255, 156, ${alpha})`;
          ctx.lineWidth = 18 - (i / trail.length) * 9;
          ctx.beginPath();
          ctx.moveTo(trail[i].x * w, trail[i].y * h);
          ctx.lineTo(trail[i + 1].x * w, trail[i + 1].y * h);
          ctx.stroke();
        }
        for (let i = 0; i < trail.length - 1; i++) {
          const alpha = (i / trail.length) * 0.62;
          ctx.strokeStyle = `rgba(0, 209, 255, ${alpha})`;
          ctx.lineWidth = 10 - (i / trail.length) * 5;
          ctx.shadowColor = COL.blue;
          ctx.shadowBlur = 14 * (i / trail.length);
          ctx.beginPath();
          ctx.moveTo(trail[i].x * w, trail[i].y * h);
          ctx.lineTo(trail[i + 1].x * w, trail[i + 1].y * h);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        const last = trail[trail.length - 1];
        const prev = trail[trail.length - 2] || last;
        const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
        const ax = last.x * w;
        const ay = last.y * h;
        const headPulse = 0.5 + 0.5 * Math.sin(t * 7);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, 22 + headPulse * 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 156, ${0.1 + headPulse * 0.12})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ax, ay, 16 + headPulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 209, 255, ${0.35 + headPulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = COL.blue;
        ctx.shadowBlur = 18 + headPulse * 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.shadowColor = COL.blue;
        ctx.shadowBlur = 16 + headPulse * 8;
        ctx.fillStyle = "#fff";
        ctx.fillRect(-14, -8, 28, 16);
        ctx.fillStyle = COL.red;
        ctx.fillRect(6, -7, 8, 6);
        ctx.fillStyle = COL.blue;
        ctx.font = "12px sans-serif";
        ctx.shadowBlur = 0;
        ctx.fillText("🚑", -8, 5);
        ctx.restore();
      }

      let lastTs = performance.now();
      function frame(ts) {
        const rawDt = (ts - lastTs) / 1000;
        lastTs = ts;
        const dt = Math.min(Math.max(rawDt, 0), 0.12);
        const t = ts / 1000;

        ambulanceT += dt * 0.08;
        if (ambulanceT > 1) ambulanceT -= 1;
        const ap = posOnCorridor(ambulanceT);
        trail.push({ x: ap.x, y: ap.y });
        if (trail.length > 45) trail.shift();

        tickDrones(dt);

        const w = canvas._w;
        const h = canvas._h;

        const etaSec = Math.max(60, Math.floor((1 - ambulanceT) * 360));
        const min = Math.floor(etaSec / 60);
        const sec = etaSec % 60;
        const droneEta = demoSettings.dronesEnabled
          ? Math.min(...drones.map((d) => Math.floor((1 - d.t) * 95) + 15))
          : 0;
        const stg = stagingCountLive();
        const droneBit = demoSettings.dronesEnabled
          ? ` · 🚁 First-response drones ~${droneEta}s`
          : "";
        const solarBit = demoSettings.solarCorridor ? " · ☀ Solar-backed signals" : "";
        if (routeText) {
          routeText.textContent =
            `AI route: ${min}m ${sec.toString().padStart(2, "0")}s${droneBit}${solarBit} · ${stg} STG nodes standby`;
        }

        const ambEta = document.getElementById("ambStripEta");
        if (ambEta) ambEta.textContent = `${min}m ${sec.toString().padStart(2, "0")}s`;
        const ambCopy = document.getElementById("ambRouteCopy");
        if (ambCopy) ambCopy.textContent = routeText.textContent;
        const trailFill = document.getElementById("ambTrailFill");
        if (trailFill) trailFill.style.width = `${Math.round(ambulanceT * 100)}%`;
        const lis = document.querySelectorAll("#ambHandoffList li");
        if (lis.length >= 3) {
          lis.forEach((li) => li.classList.remove("active", "done"));
          if (ambulanceT < 0.22) {
            lis[0].classList.add("done");
            lis[1].classList.add("active");
          } else if (ambulanceT < 0.55) {
            lis[0].classList.add("done");
            lis[1].classList.add("done");
            lis[2].classList.add("active");
          } else {
            lis.forEach((li) => li.classList.add("done"));
          }
        }

        if (!w || !h) {
          requestAnimationFrame(frame);
          return;
        }

        ctx.clearRect(0, 0, w, h);
        drawGrid(w, h, t);
        drawHeatmap(w, h, t);
        drawStreets(w, h);
        drawCorridor(w, h, t);
        drawStaging(w, h, t);
        drawEdgeNodes(w, h, t);
        drawRailway(w, h, t, ap);
        drawTrafficLights(w, h, t, ap);
        drawAccidents(w, h, t);
        drawDrones(w, h);
        drawAmbulance(w, h, t);

        requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);

      function updateClock() {
        const now = new Date();
        const opts = { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
        document.getElementById("clock").textContent = now.toLocaleTimeString("en-IN", opts);
      }
      setInterval(updateClock, 1000);
      updateClock();

      const baseLogs = [
        { cls: "warn", msg: "Accident detected — multi-sensor fusion (Sector 4)" },
        { cls: "", msg: "Ambulance dispatched — AMB-204 · crew notified" },
        { cls: "ok", msg: "Signals turned green — corridor GH-7 priority window" },
        { cls: "ok", msg: "Hospital alerted — OR-2 reserved · triage AI standby" },
        { cls: "ok", msg: "🚁 UAV-02 dispatched — first-aid kit + AED · ETA under 90s" },
        { cls: "ok", msg: "⌚ Wearable cascade: vitals anomaly → auto-SOS (encrypted BLE→5G)" },
        { cls: "", msg: "🌐 SOS voice synthesized: हिन्दी · ਪੰਜਾਬੀ · தமிழ் · বাংলা" },
        { cls: "ok", msg: "🌱 Green corridor: solar nodes powering 94% junction load on route" },
        { cls: "", msg: "🔐 Zero Trust token issued for hospital stream · mTLS verified" },
        { cls: "warn", msg: "Accident detected — CV fusion + citizen report (Sector 4)" },
        { cls: "", msg: "Ambulance AMB-204 dispatched · Green corridor reserved" },
        { cls: "ok", msg: "Traffic signals pre-cleared along Route GH-7" },
        { cls: "ok", msg: "Hospital AIIMS link established · bed OR-2 allocated" },
        { cls: "", msg: "Railway crossing RC-12 barrier cycle synced with convoy" },
        { cls: "ok", msg: "Edge model v3.2 — incident confidence 0.97" },
        { cls: "", msg: "Women safety: silent SOS session encrypted · responder pinged" },
        { cls: "warn", msg: "Predictive model: reposition STG-2 → +6% faster coverage" },
        { cls: "ok", msg: "5G slice QoS: UL 120 Mbps · latency stable" },
      ];

      function buildLog() {
        const dup = [...baseLogs, ...baseLogs];
        const logInnerAmb = document.getElementById("logInnerAmb");
        function appendItem(container, item, i) {
          const el = document.createElement("div");
          el.className = "log-item " + item.cls;
          const time = new Date(Date.now() - i * 4000);
          el.innerHTML = `<div class="log-time">${time.toLocaleTimeString("en-IN", { hour12: false })}</div>${item.msg}`;
          container.appendChild(el);
        }
        dup.forEach((item, i) => {
          appendItem(logInner, item, i);
          if (logInnerAmb) appendItem(logInnerAmb, item, i);
        });
      }
      buildLog();

      openModal.addEventListener("click", () => modalBackdrop.classList.add("open"));
      closeModal.addEventListener("click", () => modalBackdrop.classList.remove("open"));
      modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) modalBackdrop.classList.remove("open");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") modalBackdrop.classList.remove("open");
      });

      function tickVitals() {
        const hr = 78 + Math.floor(Math.random() * 12);
        const spo = 96 + Math.floor(Math.random() * 3);
        const sys = 112 + Math.floor(Math.random() * 14);
        const dia = 72 + Math.floor(Math.random() * 8);
        const rr = 14 + Math.floor(Math.random() * 5);
        const lat = 8 + Math.floor(Math.random() * 10);
        const v = (id) => document.getElementById(id);
        const set = (id, val) => {
          const n = v(id);
          if (n) n.textContent = val;
        };
        set("vHr", hr);
        set("vSpo", spo);
        set("vBp", `${sys}/${dia}`);
        set("vLat", lat);
        set("ambVHr", hr);
        set("ambVSpo", spo);
        set("ambVBp", `${sys}/${dia}`);
        set("ambVRr", rr);
      }
      setInterval(tickVitals, 1800);
      tickVitals();

      let lives = 127;
      function tickMetrics() {
        if (Math.random() > 0.7) lives++;
        document.getElementById("metricLives").textContent = lives;
        const eff = 92 + Math.floor(Math.random() * 4);
        document.getElementById("metricEff").textContent = eff + "%";
        const rps = (2.1 + Math.random() * 0.6).toFixed(1);
        document.getElementById("metricRps").textContent = rps + "k";
        document.getElementById("metricLat").textContent =
          14 + Math.floor(Math.random() * 12) + "ms";
        document.getElementById("solarStat").textContent =
          "Solar + battery buffers power " +
          (91 + Math.floor(Math.random() * 6)) +
          "% of smart junctions on this corridor.";
        document.getElementById("stagingText").textContent =
          2 +
          Math.floor(Math.random() * 3) +
          " ambulance staging points pre-positioned within SLA.";
      }
      setInterval(tickMetrics, 4000);
      tickMetrics();

      (function flowAnimator() {
        const nodes = document.querySelectorAll(".flow-row .flow-node");
        let step = 0;
        setInterval(() => {
          nodes.forEach((n, i) => {
            n.classList.toggle("active", i === step);
          });
          step = (step + 1) % nodes.length;
        }, 1100);
      })();

      const toastStack = document.getElementById("toastStack");
      const toastMsgs = [
        { text: "🚦 Corridor sync: 3 intersections cleared", cls: "ok" },
        { text: "🚁 Drone UAV-02: kit deployed · descending to hotspot", cls: "ok" },
        { text: "🤖 Edge AI: new trajectory + heatmap weighting", cls: "" },
        { text: "📡 V2X handshake · ambulance priority lane", cls: "ok" },
        { text: "🚨 Incident severity upgraded — NDRF notified", cls: "warn" },
        { text: "🛤️ Railway gate: convoy window locked", cls: "" },
        { text: "👩‍⚕️ Women SOS: safe corridor verified", cls: "ok" },
        { text: "⌚ Wearable vitals: anomaly packet sealed (E2E)", cls: "" },
        { text: "🌱 Solar signal nodes: grid-independent backup online", cls: "ok" },
        { text: "🔐 Zero Trust: policy engine approved clinical peering", cls: "" },
      ];
      let toastIdx = 0;
      function showToast() {
        const t = toastMsgs[toastIdx % toastMsgs.length];
        toastIdx++;
        const el = document.createElement("div");
        el.className = "toast " + (t.cls || "");
        el.textContent = t.text;
        toastStack.appendChild(el);
        setTimeout(() => {
          el.classList.add("hide");
          setTimeout(() => el.remove(), 400);
        }, 4200);
        while (toastStack.children.length > 4) toastStack.removeChild(toastStack.firstChild);
      }
      setInterval(showToast, 5200);
      setTimeout(showToast, 800);

      (function storyNarrative() {
        const steps = document.querySelectorAll("#storyFlow .story");
        const lifeSegs = document.querySelectorAll("#lifecycleBar .life-seg");
        let i = 0;
        function syncPhase() {
          steps.forEach((el) => el.classList.remove("active"));
          if (steps[i]) steps[i].classList.add("active");
          lifeSegs.forEach((seg, idx) => {
            seg.classList.remove("active", "done");
            if (idx < i) seg.classList.add("done");
            else if (idx === i) seg.classList.add("active");
          });
        }
        syncPhase();
        setInterval(() => {
          i = (i + 1) % steps.length;
          syncPhase();
        }, 3000);
      })();

      const langLines = [
        { lang: "हिन्दी", text: "सुरक्षा अलर्ट: एम्बुलेंस मार्ग साफ़ है। कृपया शांत रहें।" },
        { lang: "ਪੰਜਾਬੀ", text: "ਸੁਰੱਖਿਆ ਅਲਰਟ: ਐਂਬੁਲੈਂਸ ਲਈ ਰਸਤਾ ਸਾਫ਼ ਕੀਤਾ ਗਿਆ ਹੈ।" },
        { lang: "தமிழ்", text: "பாதுகாப்பு: ஆம்புலன்ஸ் பாதை திறக்கப்பட்டது — அமைதியாக இருங்கள்." },
        { lang: "বাংলা", text: "নিরাপত্তা সতর্কতা: অ্যাম্বুলেন্সের পথ মুক্ত করা হয়েছে।" },
        { lang: "മലയാളം", text: "സുരക്ഷാ അലേർട്ട്: ആംബുലൻസ് പാത വ്യക്തമാക്കി." },
        { lang: "తెలుగు", text: "భద్రతా హెచ్చరిక: అంబులెన్స్ మార్గం తెరవబడింది — ప్రశాంతంగా ఉండండి." },
        { lang: "ಕನ್ನಡ", text: "ಸುರಕ್ಷತೆ ಎಚ್ಚರಿಕೆ: ಆಂಬ್ಯುಲೆನ್ಸ್ ಮಾರ್ಗ ತೆರೆಯಲಾಗಿದೆ — ಶಾಂತವಾಗಿರಿ." },
        { lang: "English", text: "Safety alert: ambulance corridor active — stay clear." },
      ];
      const langLine = document.getElementById("langLine");
      let li = 0;
      function tickLang() {
        const bc = document.getElementById("setLangBroadcast");
        if (bc && !bc.checked) {
          langLine.textContent = "Multi-language broadcast paused (Settings).";
          langLine.style.opacity = "1";
          return;
        }
        const L = langLines[li % langLines.length];
        langLine.style.opacity = "0";
        setTimeout(() => {
          langLine.innerHTML =
            "<strong style='color:var(--neon-blue)'>" +
            L.lang +
            "</strong> — " +
            L.text;
          langLine.style.opacity = "1";
        }, 200);
        li++;
      }
      tickLang();
      setInterval(tickLang, 4500);

      const navHints = {
        dashboard: { title: "Dashboard", hint: "Hero map · system flow · analytics" },
        ambulance: { title: "Ambulance", hint: "Live trail · ETA · vitals · handoff" },
        sos: { title: "Women Safety SOS", hint: "Wearables · languages · responder chain" },
        ai: { title: "AI Prediction", hint: "Risk heat · staging sliders" },
        settings: { title: "Settings", hint: "Signals · drones · security toggles" },
      };

      document.querySelectorAll(".nav a").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          document.querySelectorAll(".nav a").forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
          const view = link.getAttribute("data-view") || "dashboard";
          setView(view);
          const key = link.getAttribute("data-nav") || "dashboard";
          const { title, hint } = navHints[key] || navHints.dashboard;
          const el = document.createElement("div");
          el.className = "toast ok";
          el.textContent = "● " + title + " — " + hint;
          toastStack.appendChild(el);
          setTimeout(() => {
            el.classList.add("hide");
            setTimeout(() => el.remove(), 400);
          }, 2600);
          while (toastStack.children.length > 5) toastStack.removeChild(toastStack.firstChild);
        });
      });

      document.getElementById("ambOpenEr")?.addEventListener("click", () => {
        modalBackdrop?.classList.add("open");
      });

      (function bindDemoSettings() {
        const toggles = [
          ["setSignalPreempt", "signalPreempt"],
          ["setRailSync", "railSync"],
          ["setSolarCorridor", "solarCorridor"],
          ["setDrones", "dronesEnabled"],
          ["setWearableUplink", "wearableUplink"],
          ["setLangBroadcast", "langBroadcast"],
          ["setZeroTrustHud", "zeroTrustHud"],
          ["setAuditChain", "auditChain"],
        ];
        toggles.forEach(([id, key]) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.checked = demoSettings[key];
          el.addEventListener("change", () => {
            demoSettings[key] = el.checked;
          });
        });
        const edge = document.getElementById("setEdgeGain");
        if (edge) {
          edge.value = String(Math.round(demoSettings.edgeGain * 100));
          edge.addEventListener("input", () => {
            demoSettings.edgeGain = parseInt(edge.value, 10) / 100;
          });
        }
      })();

      const rngStaging = document.getElementById("rngStaging");
      const stagingMeta = document.getElementById("stagingMeta");
      const aiStatZones = document.getElementById("aiStatZones");
      function syncStagingUi() {
        if (!rngStaging) return;
        const n = rngStaging.value;
        if (stagingMeta) stagingMeta.textContent = `${n} staging nodes within SLA corridor`;
        if (aiStatZones) aiStatZones.textContent = String(8 + parseInt(n, 10));
      }
      rngStaging?.addEventListener("input", syncStagingUi);
      syncStagingUi();

      (function sosPanel() {
        const status = document.getElementById("sosStatusLine");
        const gauge = document.getElementById("wearGaugeFill");
        const preview = document.getElementById("langPreview");
        const langBtns = document.getElementById("langButtons");
        if (langBtns) {
          langLines.forEach((L, idx) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "lang-btn" + (idx === 0 ? " active" : "");
            b.textContent = L.lang;
            b.addEventListener("click", () => {
              langBtns.querySelectorAll(".lang-btn").forEach((x) => x.classList.remove("active"));
              b.classList.add("active");
              if (preview) {
                preview.innerHTML =
                  "<strong style='color:var(--neon-blue)'>" + L.lang + "</strong><br/>" + L.text;
              }
            });
            langBtns.appendChild(b);
          });
        }
        document.getElementById("btnSosDemo")?.addEventListener("click", () => {
          if (status) {
            status.textContent =
              "SOS SESSION LIVE · Zero Trust token issued · nearest unit + hospital corridor locked · audit hash chained";
          }
          if (gauge) gauge.style.width = "96%";
        });
        document.getElementById("btnSosSilent")?.addEventListener("click", () => {
          if (status) {
            status.textContent =
              "SILENT SOS · Stress-classifier tripped · location visible only to verified responders · legal hold active";
          }
          if (gauge) gauge.style.width = "88%";
        });
        document.querySelectorAll(".wear-sim-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const kind = btn.getAttribute("data-wear");
            const pct = kind === "fall" ? 92 : kind === "spo2" ? 78 : 85;
            if (gauge) gauge.style.width = pct + "%";
            if (status) {
              status.textContent =
                "⌚ Wearable packet sealed · " +
                (kind === "fall"
                  ? "Fall detected · BLE → edge → 5G"
                  : kind === "spo2"
                    ? "SpO₂ drop · auto-escalation"
                    : "HR spike · fusion with corridor cameras") +
                (demoSettings.wearableUplink ? "" : " (uplink disabled in Settings)");
            }
          });
        });
      })();

      (function aiHeatmapLoop() {
        const c = document.getElementById("heatmapCanvas");
        if (!c) return;
        const x = c.getContext("2d");
        let spots = [];
        function seed() {
          spots = Array.from({ length: 16 }, () => ({
            x: 0.08 + Math.random() * 0.84,
            y: 0.08 + Math.random() * 0.84,
            r: 0.05 + Math.random() * 0.14,
            i: Math.random(),
          }));
        }
        seed();
        document.getElementById("btnHeatRefresh")?.addEventListener("click", seed);

        function draw() {
          requestAnimationFrame(draw);
          const viewAi = document.getElementById("view-ai");
          if (!viewAi?.classList.contains("view--active")) return;
          const t = performance.now() * 0.001;
          const w = c.width;
          const h = c.height;
          x.fillStyle = "#060d18";
          x.fillRect(0, 0, w, h);
          x.strokeStyle = "rgba(0, 209, 255, 0.06)";
          for (let gx = 0; gx < w; gx += 32) {
            x.beginPath();
            x.moveTo(gx, 0);
            x.lineTo(gx, h);
            x.stroke();
          }
          for (let gy = 0; gy < h; gy += 32) {
            x.beginPath();
            x.moveTo(0, gy);
            x.lineTo(w, gy);
            x.stroke();
          }
          const sens = (parseInt(document.getElementById("rngHeat")?.value || "6", 10) || 6) / 10;
          spots.forEach((s) => {
            const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + s.i * 6);
            const rad = s.r * Math.min(w, h);
            const g = x.createRadialGradient(s.x * w, s.y * h, 0, s.x * w, s.y * h, rad);
            const a = s.i * pulse * sens * 0.55;
            g.addColorStop(0, `rgba(255, 59, 59, ${a})`);
            g.addColorStop(0.45, `rgba(255, 160, 80, ${a * 0.45})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
            x.fillStyle = g;
            x.fillRect(0, 0, w, h);
          });
          x.fillStyle = "rgba(0, 209, 255, 0.9)";
          x.font = "bold 9px JetBrains Mono, monospace";
          stagingPoints.slice(0, stagingCountLive()).forEach((p, i) => {
            const px = p.x * w;
            const py = p.y * h;
            x.beginPath();
            x.moveTo(px, py - 7);
            x.lineTo(px - 6, py + 5);
            x.lineTo(px + 6, py + 5);
            x.closePath();
            x.fill();
            x.fillText("STG-" + (i + 1), px - 14, py + 18);
          });
        }
        requestAnimationFrame(draw);
      })();

      setView("dashboard");
    })();

(function heroScreen() {
  const hero = document.getElementById("heroScreen");
  const canvas = document.getElementById("heroCanvas");
  if (!hero || !canvas) return;

  if (window.location.hash === "#live") {
    hero.classList.add("hero--dismissed");
    hero.setAttribute("aria-hidden", "true");
    hero.style.display = "none";
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return;
  }

  const ctx = canvas.getContext("2d");
  let running = true;
  let animId = 0;
  const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);

  function size() {
    const d = dprCap();
    canvas.width = Math.floor(innerWidth * d);
    canvas.height = Math.floor(innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  const trail = [];
  const spots = [
    { x: 0.22, y: 0.35 },
    { x: 0.78, y: 0.42 },
    { x: 0.55, y: 0.68 },
  ];

  function draw(ts) {
    if (!running) return;
    animId = requestAnimationFrame(draw);
    const t = ts * 0.001;
    const w = innerWidth;
    const h = innerHeight;
    ctx.fillStyle = "#050a12";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 209, 255, 0.07)";
    ctx.lineWidth = 1;
    const step = 48;
    const off = (t * 18) % step;
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

    const cx = w * (0.5 + 0.38 * Math.sin(t * 0.35));
    const cy = h * (0.45 + 0.22 * Math.cos(t * 0.42));
    trail.push({ x: cx, y: cy });
    if (trail.length > 90) trail.shift();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < trail.length - 1; i++) {
      const a = (i / trail.length) * 0.35;
      ctx.strokeStyle = "rgba(0, 255, 156, " + a + ")";
      ctx.lineWidth = 12 - (i / trail.length) * 6;
      ctx.beginPath();
      ctx.moveTo(trail[i].x, trail[i].y);
      ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
      ctx.stroke();
    }
    for (let i = 0; i < trail.length - 1; i++) {
      const a = (i / trail.length) * 0.55;
      ctx.strokeStyle = "rgba(0, 209, 255, " + a + ")";
      ctx.lineWidth = 5 - (i / trail.length) * 2.5;
      ctx.shadowColor = "#00d1ff";
      ctx.shadowBlur = 8 * (i / trail.length);
      ctx.beginPath();
      ctx.moveTo(trail[i].x, trail[i].y);
      ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    spots.forEach((s, idx) => {
      const x = s.x * w;
      const y = s.y * h;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + idx);
      ctx.beginPath();
      ctx.arc(x, y, 20 + pulse * 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 59, 59, " + (0.12 + pulse * 0.12) + ")";
      ctx.fill();
      ctx.strokeStyle = "#ff3b3b";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ff3b3b";
      ctx.fill();
    });

    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillStyle = "rgba(0, 255, 156, 0.85)";
    const labels = [
      ["EDGE-AI", w * 0.12, h * 0.2],
      ["CLOUD", w * 0.85, h * 0.25],
      ["UAV-LINK", w * 0.7, h * 0.75],
    ];
    labels.forEach(([txt, x, y]) => {
      ctx.fillText(txt, x, y);
    });
  }

  size();
  window.addEventListener("resize", () => {
    if (running) size();
  });
  animId = requestAnimationFrame(draw);

  function dismiss() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(animId);
    hero.classList.add("hero--dismissed");
    hero.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      hero.style.display = "none";
    }, 700);
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  const launch = document.getElementById("heroLaunch");
  const skip = document.getElementById("heroSkip");
  if (launch) launch.addEventListener("click", dismiss);
  if (skip) skip.addEventListener("click", dismiss);
})();
