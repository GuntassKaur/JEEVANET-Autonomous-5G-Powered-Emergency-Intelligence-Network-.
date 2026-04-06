(function() {
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');
  const clockEl = document.getElementById('clock');
  const logContainer = document.getElementById('eventLog');
  const erModal = document.getElementById('erModal');
  const erClose = document.getElementById('erClose');
  const storyBtn = document.getElementById('storyTrig');
  
  // Simulation State
  let time = 0;
  let ambulanceT = 0;
  let dpr = window.devicePixelRatio || 1;
  let lastTs = 0;
  let currentStoryStep = 0;
  let isStoryRunning = false;
  
  // Configuration
  const COLORS = {
    blue: '#00D1FF',
    green: '#00FF9C',
    red: '#FF3B3B',
    purple: '#9D00FF',
    gold: '#FFD700',
    bg: '#010409',
    grid: 'rgba(0, 209, 255, 0.05)',
    street: 'rgba(232, 244, 255, 0.04)'
  };
  
  // Entities
  const accidents = [
    { x: 0.72, y: 0.38, active: false },
    { x: 0.28, y: 0.62, active: false }
  ];
  
  const mainRoute = [
    { x: 0.1, y: 0.82 },
    { x: 0.25, y: 0.65 },
    { x: 0.4, y: 0.55 },
    { x: 0.5, y: 0.45 },
    { x: 0.65, y: 0.35 },
    { x: 0.8, y: 0.22 },
    { x: 0.95, y: 0.1 }
  ];
  
  const trail = [];
  const maxTrail = 45;

  // STORYTELLING STEPS DEFINITION
  const storySteps = [
    {
      title: 'SCAN',
      msg: 'System scanning Sector 4. CCTV fusion + V2X mesh active.',
      action: () => {
        accidents[0].active = false;
        ambulanceT = 0;
        trail.length = 0;
      }
    },
    {
      title: 'ALERT',
      msg: 'ACCIDENT DETECTED. SOS Signal #112 confirmed by Edge AI.',
      action: () => {
        accidents[0].active = true;
        document.getElementById('hudCardA').style.display = 'none';
        document.getElementById('hudCardB').style.display = 'block';
        addLogLine('Threat ID #8421 Verified. Collision detected.', 'alert');
      }
    },
    {
      title: 'DISPATCH',
      msg: 'AMB-204 + UAV-02 Dispatched. Response time: 9s.',
      action: () => {
        addLogLine('Ambulance AMB-204 Dispatched via Corridor Alpha.', 'info');
        addLogLine('Drone Unit UAV-02 deployed from Charging Hub-3.', 'info');
      }
    },
    {
      title: 'CORRIDOR',
      msg: 'Corridor Alpha Green Wave active. Signals pre-empted.',
      action: () => {
        addLogLine('Signal Pre-emption: GH-7, RK-12 Cleared.', 'success');
        addLogLine('Railway RC-12 Gate Sync: SECURED.', 'success');
      }
    },
    {
      title: 'ER LINK',
      msg: 'Tele-surgery session initiated. AIIMS Trauma Link 5G.',
      action: () => {
        addLogLine('Zero-Trust Session #9241 established.', 'success');
        setTimeout(() => erModal.classList.add('active'), 500);
      }
    }
  ];

  function runStoryStep(stepIdx) {
    currentStoryStep = stepIdx;
    const step = storySteps[stepIdx];
    if(!step) return;

    // Update UI highlights
    document.querySelectorAll('.story-step').forEach((el, i) => {
      el.classList.toggle('active', i === stepIdx);
    });

    // Execute logic
    step.action();
    addLogLine(`STORY_NODE [${step.title}]: ${step.msg}`, 'info');
  }

  // Initialization
  function init() {
    window.addEventListener('resize', resize);
    resize();
    
    // NAV & VIEW SWITCHING
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = btn.dataset.view;
        if(!viewId) return;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        if(viewId === 'dashboard') setTimeout(resize, 0);
      });
    });

    // STORY TRIGGER
    storyBtn.addEventListener('click', () => {
      isStoryRunning = true;
      let step = 0;
      const interval = setInterval(() => {
        runStoryStep(step);
        step++;
        if(step >= storySteps.length) {
          clearInterval(interval);
          isStoryRunning = false;
        }
      }, 4000); // 4 seconds per story step for presentation flow
    });

    document.querySelectorAll('.story-step').forEach(el => {
      el.addEventListener('click', () => {
        runStoryStep(parseInt(el.dataset.step));
      });
    });

    // MODAL
    if(erClose) erClose.addEventListener('click', () => erModal.classList.remove('active'));
    
    // Start Services
    setInterval(updateClock, 1000);
    updateClock();
    requestAnimationFrame(render);
    
    if(window.lucide) lucide.createIcons();
  }
  
  function resize() {
    const parent = canvas.parentElement;
    if(!parent) return;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = parent.clientWidth + 'px';
    canvas.style.height = parent.clientHeight + 'px';
  }
  
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
  }
  
  function addLogLine(text, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timeStr = new Date().toLocaleTimeString([], { hour12: false, minute:'2-digit', second:'2-digit'});
    entry.innerHTML = `
      <div class="log-meta"><span class="log-time">${timeStr}</span><span>SECURE_CMD</span></div>
      <div class="log-msg">${text}</div>
    `;
    logContainer.prepend(entry);
    if(logContainer.children.length > 30) logContainer.lastChild.remove();
  }
  
  function getPointOnRoute(t) {
    const n = mainRoute.length - 1;
    const seg = t * n;
    const i = Math.floor(seg);
    const f = seg - i;
    if(i >= n) return { ...mainRoute[n], angle: 0 };
    return {
      x: mainRoute[i].x + (mainRoute[i+1].x - mainRoute[i].x) * f,
      y: mainRoute[i].y + (mainRoute[i+1].y - mainRoute[i].y) * f,
      angle: Math.atan2(mainRoute[i+1].y - mainRoute[i].y, mainRoute[i+1].x - mainRoute[i].x)
    };
  }
  
  function drawGrid(w, h) {
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.5;
    const step = 40; const offX = (time * 15) % step;
    for(let x = -offX; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for(let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  
  function drawAccidents(w, h) {
    accidents.forEach((acc, i) => {
      if(!acc.active) return;
      const x = acc.x * w; const y = acc.y * h;
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(255, 59, 59, ${0.1 * pulse})`;
      ctx.beginPath(); ctx.arc(x, y, 40 + pulse * 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.red; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 14 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
    });
  }

  function drawAmbulance(w, h) {
    if(currentStoryStep < 2) return; // Only show in step 3 (Dispatch) onwards
    const pos = getPointOnRoute(ambulanceT);
    const x = pos.x * w; const y = pos.y * h;
    trail.push({ x, y }); if(trail.length > maxTrail) trail.shift();
    
    for(let i = 0; i < trail.length - 1; i++) {
        const a = (i / trail.length) * 0.4;
        ctx.strokeStyle = `rgba(0, 209, 255, ${a})`;
        ctx.lineWidth = 8 - (i/trail.length)*4;
        ctx.beginPath(); ctx.moveTo(trail[i].x, trail[i].y); ctx.lineTo(trail[i+1].x, trail[i+1].y); ctx.stroke();
    }
    
    ctx.save(); ctx.translate(x, y); ctx.rotate(pos.angle);
    ctx.fillStyle = '#fff'; ctx.shadowColor = COLORS.blue; ctx.shadowBlur = 10;
    ctx.fillRect(-12, -6, 24, 12);
    ctx.fillStyle = (Math.sin(time * 20) > 0) ? COLORS.red : COLORS.blue; ctx.fillRect(8, -6, 4, 12);
    ctx.restore(); ctx.shadowBlur = 0;
  }
  
  function render(ts) {
    const dt = (ts - lastTs) / 1000 || 0; lastTs = ts;
    time += dt;
    
    // Only move ambulance if story is at least in dispatch phase
    if(currentStoryStep >= 2) {
      ambulanceT += dt * 0.04;
      if(ambulanceT > 1) { ambulanceT = 1; }
    }
    
    if(canvas.offsetParent !== null) {
      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h);
      drawGrid(w, h); drawAccidents(w, h); drawAmbulance(w, h);
      
      // AI Scanning Lines if in Scan Mode
      if(currentStoryStep === 0) {
        const scanY = (time * 150) % h;
        ctx.strokeStyle = 'rgba(0, 209, 255, 0.2)';
        ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(w, scanY); ctx.stroke();
      }
    }
    
    // VIZ Update (Bars)
    const bars = document.querySelectorAll('.viz-bar');
    bars.forEach((bar, i) => {
       if(Math.random() > 0.95) {
         bar.style.height = (20 + Math.random() * 60) + '%';
       }
    });

    // Vitals Sim
    const hr = 78 + Math.floor(Math.random() * 12);
    const spo2 = 97 + Math.floor(Math.random() * 3);
    const valHr = document.getElementById('val-bpm');
    if(valHr) valHr.textContent = hr;
    const valSpo2 = document.getElementById('val-spo2');
    if(valSpo2) valSpo2.textContent = spo2 + '%';

    requestAnimationFrame(render);
  }
  
  document.addEventListener('DOMContentLoaded', init);
})();
