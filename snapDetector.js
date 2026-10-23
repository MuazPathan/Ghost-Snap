// snapDetector.js
(function () {
  window.__ThanosSnap = window.__ThanosSnap || {};

  class SnapDetector {
    constructor(onSnapCallback) {
      this.onSnap = onSnapCallback;
      this.enabled = true;
      this.lastTriggerTime = 0;
      this.cooldownMs = 3500; // 3.5s debounce

      // Audio transient analysis state
      this.audioCtx = null;
      this.analyser = null;
      this.rollingEnergy = 15;

      // Visual motion gate (prevents random keyboard clicks from triggering without hand motion)
      this.motionCanvas = document.createElement('canvas');
      this.motionCanvas.width = 64;
      this.motionCanvas.height = 36;
      this.motionCtx = this.motionCanvas.getContext('2d', { willReadFrequently: true });
      this.prevFrame = null;
      this.recentMotionScore = 0;

      this.initKeyboardShortcut();
    }

    initKeyboardShortcut() {
      window.addEventListener('keydown', (e) => {
        // Alt + S instant fallback trigger
        if (e.altKey && e.code === 'KeyS') {
          e.preventDefault();
          this.fireTrigger('Keyboard Shortcut (Alt+S)');
        }
      });
    }

    /**
     * Attaches to the user's audio stream (or requests a silent analyser) to detect finger snap transients
     */
    attachAudioStream(mediaStream) {
      try {
        const audioTracks = mediaStream.getAudioTracks();
        if (!audioTracks || audioTracks.length === 0) return;

        if (!this.audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          this.audioCtx = new AudioContextClass();
          this.analyser = this.audioCtx.createAnalyser();
          this.analyser.fftSize = 512;
          this.analyser.smoothingTimeConstant = 0.2;

          const source = this.audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
          source.connect(this.analyser);

          this.startAudioLoop();
          console.log('[ThanosSnap] Acoustic Snap Detector attached to microphone track.');
        }
      } catch (err) {
        console.warn('[ThanosSnap] Audio snap listener skipped:', err);
      }
    }

    /**
     * Computes localized frame motion so acoustic spikes only trigger when a hand/gesture moves
     */
    updateVisualMotion(videoElement) {
      if (!this.enabled || !videoElement || videoElement.readyState < 2) return;

      this.motionCtx.drawImage(videoElement, 0, 0, 64, 36);
      const curr = this.motionCtx.getImageData(0, 0, 64, 36).data;

      if (this.prevFrame) {
        let diffSum = 0;
        for (let i = 0; i < curr.length; i += 16) {
          diffSum += Math.abs(curr[i] - this.prevFrame[i]);
        }
        this.recentMotionScore = diffSum / (curr.length / 16);
      }
      this.prevFrame = curr;
    }

    startAudioLoop() {
      const freqData = new Uint8Array(this.analyser.frequencyBinCount);

      const checkTransient = () => {
        if (this.enabled && this.analyser) {
          this.analyser.getByteFrequencyData(freqData);

          // Finger snaps peak sharply between 2000Hz and 4800Hz (bins ~22 to ~55 at 48kHz, 512 FFT)
          let highBandSum = 0;
          const startBin = 20;
          const endBin = 58;
          for (let i = startBin; i < endBin; i++) {
            highBandSum += freqData[i];
          }
          const avgHighBand = highBandSum / (endBin - startBin);

          // Compare sharp transient against rolling background noise floor
          const spikeRatio = avgHighBand / Math.max(10, this.rollingEnergy);

          // Trigger if sharp high-frequency snap transient + active hand movement in camera
          if (avgHighBand > 85 && spikeRatio > 2.65 && this.recentMotionScore > 3.2) {
            this.fireTrigger('Finger Snap Detected');
          }

          // Smoothly update rolling ambient floor
          this.rollingEnergy = this.rollingEnergy * 0.92 + avgHighBand * 0.08;
        }
        requestAnimationFrame(checkTransient);
      };

      requestAnimationFrame(checkTransient);
    }

    fireTrigger(sourceReason) {
      const now = Date.now();
      if (now - this.lastTriggerTime < this.cooldownMs) return;
      this.lastTriggerTime = now;
      console.log(`[ThanosSnap] Snap triggered via: ${sourceReason}`);
      if (typeof this.onSnap === 'function') {
        this.onSnap(sourceReason);
      }
    }
  }

  window.__ThanosSnap.SnapDetector = SnapDetector;
})();   