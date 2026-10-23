// inject.js
(function () {
  if (window.__ThanosSnapInitialized) return;
  window.__ThanosSnapInitialized = true;

  const { DissolveEngine, SnapDetector } = window.__ThanosSnap;
  const engine = new DissolveEngine(640, 360);

  let activeVideoEl = null;
  let hudStatusEl = null;

  const detector = new SnapDetector((reason) => {
    if (!activeVideoEl) return;
    if (engine.state === 'NORMAL') {
      engine.triggerSnap(activeVideoEl);
      updateHudState('DISSOLVING...');
      setTimeout(() => {
        if (engine.state !== 'NORMAL') updateHudState('VANISHED (Invisible)');
      }, 2200);
    } else {
      engine.reset();
      updateHudState('LIVE (Ready to Snap)');
    }
  });

  // Keep reference to original getUserMedia
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getUserMedia = async function (constraints) {
    const realStream = await originalGetUserMedia(constraints);

    // Always attach audio stream to our acoustic snap detector if present
    if (realStream.getAudioTracks().length > 0) {
      detector.attachAudioStream(realStream);
    }

    // Only hijack if the web app requested a video stream
    if (!constraints || !constraints.video || realStream.getVideoTracks().length === 0) {
      return realStream;
    }

    try {
      console.log('[ThanosSnap] Intercepting video stream for:', window.location.hostname);
      return await createHijackedStream(realStream);
    } catch (err) {
      console.error('[ThanosSnap] Fallback to real stream due to error:', err);
      return realStream;
    }
  };

  async function createHijackedStream(realStream) {
    const realVideoTrack = realStream.getVideoTracks()[0];
    const settings = realVideoTrack.getSettings ? realVideoTrack.getSettings() : {};
    const width = settings.width || 640;
    const height = settings.height || 360;
    const frameRate = settings.frameRate || 30;

    engine.resize(width, height);

    // Hidden video element playing the hardware webcam
    const hiddenVideo = document.createElement('video');
    hiddenVideo.autoplay = true;
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;
    hiddenVideo.srcObject = new MediaStream([realVideoTrack]);
    await hiddenVideo.play().catch(() => {});
    activeVideoEl = hiddenVideo;

    // Also try opening a background mic listener if the app requested video & audio separately
    if (realStream.getAudioTracks().length === 0 && !detector.audioCtx) {
      originalGetUserMedia({ audio: true, video: false })
        .then((micStream) => detector.attachAudioStream(micStream))
        .catch(() => {});
    }

    // Output canvas that feeds WebRTC
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outCtx = outputCanvas.getContext('2d', { alpha: false });

    let animationActive = true;
    const renderLoop = () => {
      if (!animationActive) return;
      if (hiddenVideo.readyState >= 2) {
        if ( outputCanvas.width !== hiddenVideo.videoWidth && hiddenVideo.videoWidth > 0) {
          outputCanvas.width = hiddenVideo.videoWidth;
          outputCanvas.height = hiddenVideo.videoHeight;
        }
        detector.updateVisualMotion(hiddenVideo);
        engine.render(outCtx, hiddenVideo);
      }
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    // Capture 30fps MediaStream from canvas
    const virtualStream = outputCanvas.captureStream(frameRate);
    const virtualVideoTrack = virtualStream.getVideoTracks()[0];

    // Spoof track metadata so Google Meet / Teams accept it as a hardware camera
    if (realVideoTrack.getSettings) {
      virtualVideoTrack.getSettings = () => realVideoTrack.getSettings();
    }
    if (realVideoTrack.getCapabilities) {
      virtualVideoTrack.getCapabilities = () => realVideoTrack.getCapabilities();
    }

    // Ensure stopping the virtual track (hanging up call) releases the physical webcam light
    const origStop = virtualVideoTrack.stop.bind(virtualVideoTrack);
    virtualVideoTrack.stop = function () {
      animationActive = false;
      realVideoTrack.stop();
      origStop();
    };

    // Pass through original audio tracks untouched
    realStream.getAudioTracks().forEach((audioTrack) => {
      virtualStream.addTrack(audioTrack);
    });

    mountFloatingHUD();
    return virtualStream;
  }

  function updateHudState(text) {
    if (hudStatusEl) hudStatusEl.textContent = text;
  }

  function mountFloatingHUD() {
    if (document.getElementById('thanos-snap-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'thanos-snap-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background: rgba(18, 18, 24, 0.92);
      backdrop-filter: blur(8px);
      color: #f3f4f6;
      padding: 10px 14px;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      border: 1px solid rgba(255, 185, 50, 0.35);
      display: flex;
      flex-direction: column;
      gap: 8px;
      user-select: none;
      min-width: 215px;
    `;

    hud.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <span style="font-weight:700; color:#fbbf24;">🧤 Infinity Snap FX</span>
        <span id="thanos-status-badge" style="font-size:11px; color:#34d399;">LIVE (Ready)</span>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button id="thanos-btn-snap" style="flex:1; background:#d97706; color:#fff; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-weight:600; font-size:11px;">
          ✨ Snap Now (Alt+S)
        </button>
        <button id="thanos-btn-bg" title="Step out of frame for 1 sec and click so your room stays visible when you turn to dust!" style="background:#374151; color:#e5e7eb; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11px;">
          📷 Capture Empty BG
        </button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#9ca3af;">
        <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
          <input type="checkbox" id="thanos-chk-auto" checked />
          Auto-Snap Mic/Motion
        </label>
        <span id="thanos-btn-reset" style="cursor:pointer; color:#60a5fa; text-decoration:underline;">Reset</span>
      </div>
    `;

    document.documentElement.appendChild(hud);
    hudStatusEl = hud.querySelector('#thanos-status-badge');

    hud.querySelector('#thanos-btn-snap').addEventListener('click', () => {
      detector.fireTrigger('Manual HUD Button');
    });

    hud.querySelector('#thanos-btn-bg').addEventListener('click', (e) => {
      if (activeVideoEl) {
        engine.captureBackgroundPlate(activeVideoEl);
        e.target.textContent = '✅ Empty BG Saved';
        e.target.style.background = '#065f46';
      }
    });

    hud.querySelector('#thanos-chk-auto').addEventListener('change', (e) => {
      detector.enabled = e.target.checked;
    });

    hud.querySelector('#thanos-btn-reset').addEventListener('click', () => {
      engine.reset();
      updateHudState('LIVE (Ready)');
    });
  }
})();