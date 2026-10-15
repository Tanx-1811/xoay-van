/* Confetti on a full-window canvas. Same burst pattern as the original:
   100 particles every 200 ms for 5 s, spread 360°, start velocity 30, 60 ticks, random origin, wheel colors. */
(function () {
  'use strict';

  var canvas = null, ctx = null, W = 0, H = 0, dpr = 1;
  var parts = [];
  var running = false;
  var burstTimer = null, endTimer = null;
  var lastFrame = 0;
  var FRAME = 1000 / 60;

  function init() {
    canvas = document.getElementById('fxCanvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }

  // Particle physics modelled on canvas-confetti's defaults (decay .9, gravity 1, drift 0, scalar 1).
  function particle(x, y, o) {
    var angle = (o.angle || 90) * Math.PI / 180;
    var spread = (o.spread || 45) * Math.PI / 180;
    return {
      x: x, y: y,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
      velocity: o.startVelocity * 0.5 + Math.random() * o.startVelocity,
      angle2D: -angle + (0.5 * spread - Math.random() * spread),
      tiltAngle: (Math.random() * 0.5 + 0.25) * Math.PI,
      rgb: o.rgb, circle: Math.random() < 0.5,
      tick: 0, totalTicks: o.ticks,
      decay: 0.9, gravity: 3, random: Math.random() + 2,
      tiltSin: 0, tiltCos: 0, wobbleX: 0, wobbleY: 0
    };
  }

  function step(p) {
    p.x += Math.cos(p.angle2D) * p.velocity;
    p.y += Math.sin(p.angle2D) * p.velocity + p.gravity;
    p.velocity *= p.decay;
    p.wobble += p.wobbleSpeed;
    p.wobbleX = p.x + 10 * Math.cos(p.wobble);
    p.wobbleY = p.y + 10 * Math.sin(p.wobble);
    p.tiltAngle += 0.1;
    p.tiltSin = Math.sin(p.tiltAngle);
    p.tiltCos = Math.cos(p.tiltAngle);
    p.random = Math.random() + 2;
    var progress = p.tick++ / p.totalTicks;
    var x1 = p.x + p.random * p.tiltCos, y1 = p.y + p.random * p.tiltSin;
    var x2 = p.wobbleX + p.random * p.tiltCos, y2 = p.wobbleY + p.random * p.tiltSin;
    ctx.fillStyle = 'rgba(' + p.rgb[0] + ',' + p.rgb[1] + ',' + p.rgb[2] + ',' + (1 - progress) + ')';
    ctx.beginPath();
    if (p.circle) {
      ctx.ellipse(p.x, p.y, Math.abs(x2 - x1) * 0.6, Math.abs(y2 - y1) * 0.6, Math.PI / 10 * p.wobble, 0, 2 * Math.PI);
    } else {
      ctx.moveTo(Math.floor(p.x), Math.floor(p.y));
      ctx.lineTo(Math.floor(p.wobbleX), Math.floor(y1));
      ctx.lineTo(Math.floor(x2), Math.floor(y2));
      ctx.lineTo(Math.floor(x1), Math.floor(p.wobbleY));
    }
    ctx.closePath();
    ctx.fill();
    return p.tick < p.totalTicks;
  }

  function frame(t) {
    // one physics step per 60 Hz frame, also on faster displays
    if (t - lastFrame < FRAME - 2) { requestAnimationFrame(frame); return; }
    lastFrame = t;
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter(step);
    if (parts.length || burstTimer) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  function fireBurst(colors) {
    var x = Math.random() * W, y = (Math.random() - 0.2) * H;
    for (var i = 0; i < 100; i++) {
      parts.push(particle(x, y, { spread: 360, startVelocity: 30, ticks: 60, rgb: hexToRgb(colors[(Math.random() * colors.length) | 0]) }));
    }
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  function stopBursts() {
    clearInterval(burstTimer); clearTimeout(endTimer);
    burstTimer = null; endTimer = null;
  }

  window.Confetti = {
    launch: function (colors) {
      if (!canvas) init();
      stopBursts();
      colors = colors && colors.length ? colors : ['#CCCCCC'];
      fireBurst(colors);
      burstTimer = setInterval(function () { fireBurst(colors); }, 200);
      endTimer = setTimeout(stopBursts, 5000);
    },
    stop: function () { stopBursts(); parts.length = 0; }
  };
})();
