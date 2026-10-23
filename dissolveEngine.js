// dissolveEngine.js
(function () {
  window.__ThanosSnap = window.__ThanosSnap || {};

  class DissolveEngine {
    constructor(width = 640, height = 360) {
      this.width = width;
      this.height = height;
      this.state = 'NORMAL'; // 'NORMAL' | 'DISSOLVING' | 'VANISHED'
      this.particles = [];
      this.startTime = 0;

      // Offscreen buffers for pixel sampling & clean background plate
      this.snapshotCanvas = document.createElement('canvas');
      this.snapshotCtx = this.snapshotCanvas.getContext('2d', { willReadFrequently: true });

      this.bgCanvas = document.createElement('canvas');
      this.bgCtx = this.bgCanvas.getContext('2d', { willReadFrequently: true });
      this.hasCustomBackground = false;
    }

    resize(width, height) {
      if (this.width === width && this.height === height) return;
      this.width = width;
      this.height = height;
      this.snapshotCanvas.width = width;
      this.snapshotCanvas.height = height;
      if (!this.hasCustomBackground) {
        this.bgCanvas.width = width;
        this.bgCanvas.height = height;
      }
    }

    /**
     * Captures the current empty room so the background stays visible when you turn to dust
     */
    captureBackgroundPlate(videoElement) {
      this.bgCanvas.width = this.width;
      this.bgCanvas.height = this.height;
      this.bgCtx.drawImage(videoElement, 0, 0, this.width, this.height);
      this.hasCustomBackground = true;
      console.log('[ThanosSnap] Clean room background plate captured.');
    }

    /**
     * Freezes the current video frame and generates ash particles with a diagonal peel delay
     */
    triggerSnap(videoElement) {
      if (this.state !== 'NORMAL') return;

      this.snapshotCanvas.width = this.width;
      this.snapshotCanvas.height = this.height;
      this.snapshotCtx.drawImage(videoElement, 0, 0, this.width, this.height);

      const frameData = this.snapshotCtx.getImageData(0, 0, this.width, this.height).data;
      let bgData = null;

      if (this.hasCustomBackground) {
        bgData = this.bgCtx.getImageData(0, 0, this.width, this.height).data;
      }

      this.particles = [];
      // Particle grid resolution (4px balances cinematic density with 30+ FPS performance)
      const step = Math.max(3, Math.floor(this.width / 180));

      for (let y = 0; y < this.height; y += step) {
        for (let x = 0; x < this.width; x += step) {
          const idx = (y * this.width + x) * 4;
          const r = frameData[idx];
          const g = frameData[idx + 1];
          const b = frameData[idx + 2];
          const a = frameData[idx + 3];

          if (a < 20) continue;

          // If using an Empty Room Background Plate, skip pixels that haven't changed (background wall/room)
          if (bgData) {
            const diff =
              Math.abs(r - bgData[idx]) +
              Math.abs(g - bgData[idx + 1]) +
              Math.abs(b - bgData[idx + 2]);
            // Keep center silhouette or pixels significantly different from background plate
            if (diff < 42) continue;
          }

          // Diagonal wave progression (starts top-left/head and sweeps across body over ~1.1s)
          const normalizedDiag = (x / this.width) * 0.55 + (y / this.height) * 0.45;
          const noise = (Math.random() - 0.5) * 0.22;
          const delay = Math.max(0, (normalizedDiag + noise) * 1100); // ms before particle detaches

          this.particles.push({
            x,
            y,
            originX: x,
            originY: y,
            r,
            g,
            b,
            size: step + (Math.random() * 1.8),
            delay,
            // Upward and rightward wind drift like Infinity War
            vx: 1.4 + Math.random() * 2.8,
            vy: -0.8 - Math.random() * 2.4,
            turbulenceFreq: 0.02 + Math.random() * 0.04,
            turbulenceAmp: 0.6 + Math.random() * 1.5,
            life: 0,
            maxLife: 45 + Math.random() * 40, // frames after detachment
            detached: false
          });
        }
      }

      this.startTime = performance.now();
      this.state = 'DISSOLVING';
    }

    reset() {
      this.state = 'NORMAL';
      this.particles = [];
    }

    /**
     * Main render loop called at 30fps to feed the hijacked WebRTC canvas stream
     */
    render(ctx, videoElement) {
      if (videoElement.videoWidth && videoElement.videoHeight) {
        this.resize(videoElement.videoWidth, videoElement.videoHeight);
      }

      // 1. Normal State: Pass-through live webcam feed
      if (this.state === 'NORMAL') {
        ctx.drawImage(videoElement, 0, 0, this.width, this.height);
        return;
      }

      // 2. Draw Base Background (either captured empty room or pitch black)
      if (this.hasCustomBackground) {
        ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#070709';
        ctx.fillRect(0, 0, this.width, this.height);
      }

      if (this.state === 'VANISHED') {
        return;
      }

      // 3. Dissolving State: Update & render particles
      const elapsed = performance.now() - this.startTime;
      let activeParticles = 0;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        if (elapsed < p.delay) {
          // Not detached yet: render in original position
          activeParticles++;
          ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
          ctx.fillRect(p.originX, p.originY, p.size, p.size);
        } else {
          // Detached: float away as darkening ash
          p.life++;
          if (p.life >= p.maxLife) continue;

          activeParticles++;
          const progress = p.life / p.maxLife; // 0 -> 1

          // Accelerate wind and sinusoidal turbulence
          p.x += p.vx * (1 + progress * 1.3);
          p.y += p.vy + Math.sin(p.life * p.turbulenceFreq) * p.turbulenceAmp;

          // Shift color from original pixel toward dark Avengers ash (rgb 55, 48, 44)
          const ashBlend = Math.min(1, progress * 1.6);
          const curR = Math.round(p.r * (1 - ashBlend) + 55 * ashBlend);
          const curG = Math.round(p.g * (1 - ashBlend) + 48 * ashBlend);
          const curB = Math.round(p.b * (1 - ashBlend) + 44 * ashBlend);
          const alpha = Math.max(0, 1 - Math.pow(progress, 1.4));

          ctx.fillStyle = `rgba(${curR},${curG},${curB},${alpha.toFixed(2)})`;
          const shrinkSize = p.size * (1 - progress * 0.35);
          ctx.fillRect(p.x, p.y, shrinkSize, shrinkSize);
        }
      }

      if (activeParticles === 0) {
        this.state = 'VANISHED';
      }
    }
  }

  window.__ThanosSnap.DissolveEngine = DissolveEngine;
})();