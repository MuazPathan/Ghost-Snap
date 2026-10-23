# 🧤 Ghost Snap

A Manifest V3 Chrome Extension that intercepts your live webcam feed across any browser-based video calling platform and disintegrates you into drifting ash—just like the *Avengers: Infinity War / Endgame* snap—whenever you snap your fingers. Because the effect modifies the outgoing WebRTC media stream directly, **everyone else on the call sees you turn into dust in real time.**

---

## ✨ Features

* **Real-Time WebRTC Stream Hijacking**: Hooks `navigator.mediaDevices.getUserMedia` in the page's `MAIN` execution world before the video app initializes, routing your hardware webcam through a 30 FPS virtual `<canvas>` stream.
* **Hardware Metadata Spoofing**: Proxies `getSettings()` and `getCapabilities()` from your physical webcam onto the virtual stream so strict apps like Google Meet and Microsoft Teams recognize it as a genuine hardware camera.
* **"Empty Room" Background Plate Mode**: Capture a 1-second snapshot of your empty chair/room before sitting down. When you snap your fingers, **only your body disintegrates into ash**, leaving your room background completely intact on the call.
* **Multi-Modal Snap Trigger**:
  * **Acoustic + Visual Motion Gate**: Listens for the sharp high-frequency transient spike ($2.0\text{ kHz} - 4.8\text{ kHz}$) of a real finger snap paired with active visual motion in the camera frame.
  * **Instant Hotkey (`Alt + S`)**: Trigger or reset the disintegration effect silently at any time.
  * **On-Screen Floating HUD**: A sleek control widget in the bottom-right corner of the call.
* **Trusted-Types & CSP Safe**: Built with 100% pure DOM creation (`document.createElement`) and zero `innerHTML` calls to bypass strict `TrustedHTML` Content Security Policies enforced by Google Meet and WhatsApp Web.

---

## 🌐 Supported Platforms

* **Google Meet** (`meet.google.com`)
* **Zoom Web Client** (`*.zoom.us`)
* **Microsoft Teams Web** (`teams.microsoft.com` & `teams.live.com`)
* **WhatsApp Web** (`web.whatsapp.com`)
* **Discord Web** (`discord.com`)

---

## 📂 Project Structure

```text
avengers-snap-cam/
├── manifest.json       # Manifest V3 config injecting scripts at document_start in MAIN world
├── dissolveEngine.js   # 2D particle physics engine for diagonal ash peel & turbulence
├── snapDetector.js     # Web Audio API FFT snap transient detector + visual motion gate + hotkey
├── inject.js           # WebRTC getUserMedia monkey-patch & CSP-safe floating HUD
└── README.md           # Project documentation
```

---

## 🚀 Installation Guide

1. **Download / Clone the Folder**:
   Ensure `manifest.json`, `dissolveEngine.js`, `snapDetector.js`, and `inject.js` are saved inside a single folder named `avengers-snap-cam`.
2. **Open Chrome Extensions**:
   Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. **Enable Developer Mode**:
   Toggle the **Developer mode** switch in the top-right corner of the page.
4. **Load Unpacked Extension**:
   Click the **Load unpacked** button in the top-left corner and select your `avengers-snap-cam` folder.
5. **Refresh Your Video Call Tab**:
   Open (or hard refresh with `Ctrl + Shift + R`) Google Meet, Zoom, Teams, or WhatsApp Web. You will see the **🧤 Infinity Snap FX** floating widget in the bottom-right corner.

---

## 🎮 How to Use

### 1. The Standard Vanish (Fade to Dark Void)
1. Join a video call and turn on your camera. The HUD status badge will switch from `⏳ Waiting for Cam...` to `🟢 LIVE (Cam Hooked)`.
2. **Snap your fingers** clearly near your microphone while moving your hand in view of the camera, press **`Alt + S`**, or click **`✨ Snap Now (Alt+S)`**.
3. Your video feed will freeze and peel away diagonally into thousands of dark drifting ash particles.

### 2. The Ultimate Illusion ("Empty Room" Mode)
For maximum realism where your background stays visible after you vanish:
1. Turn on your camera in the call.
2. Step out of the camera frame for 1 second so only your chair/wall is visible, and click **`📷 Capture Empty BG`**.
3. Sit back down in your chair.
4. Trigger the snap (**Finger Snap**, **`Alt + S`**, or **HUD Button**).
5. Pixel-difference segmentation isolates your silhouette from your room so **only you** dissolve into floating ash while your background remains live!

### 3. Returning to the Call
* Press **`Alt + S`** again or click **`Reset Video`** on the floating HUD to restore your normal live webcam feed immediately.

---

## 🧠 How It Works Under the Hood

1. **Stream Interception (`inject.js`)**:
   When the host web app calls `navigator.mediaDevices.getUserMedia({ video: true })`, the extension captures the real `MediaStreamTrack`, feeds it into an offscreen `<video>` element, and returns `outputCanvas.captureStream(30)` back to the web app's `RTCPeerConnection`.
2. **Diagonal Ash Particle Physics (`dissolveEngine.js`)**:
   Upon trigger, the current video frame is sampled into a grid of particles. Each particle is assigned a detachment delay based on its normalized diagonal coordinate:
   $$d(x, y) = \max\left(0, \left(0.55\frac{x}{W} + 0.45\frac{y}{H} + \eta\right) \times 1100\text{ ms}\right)$$
   Once detached, particles accelerate upward and rightward with sinusoidal turbulence while interpolating their RGB values toward dark ash $\text{RGB}(55, 48, 44)$ and fading in opacity.
3. **Motion-Gated Acoustic Detection (`snapDetector.js`)**:
   Uses a `Web Audio API` `AnalyserNode` ($512$-point FFT) to monitor energy in frequency bins $20$ to $58$ ($\approx 2000\text{ Hz} - 4800\text{ Hz}$). To prevent keyboard clicks or desk taps from false-triggering, an acoustic spike only fires the snap if a $64 \times 36$ downsampled frame-differencing pass confirms simultaneous visual movement in the camera feed.

---

## 🛠️ Troubleshooting

* **The floating HUD is not showing up**:
  * Make sure you clicked the **Reload (🔄)** button on `chrome://extensions/` after saving any changes, then **hard refresh (`Ctrl + Shift + R`)** the video call tab.
* **Status says `⏳ Waiting for Cam...` even though my camera is on**:
  * If your camera was already running *before* you installed or reloaded the extension, refresh the video call tab so the web app requests the camera through the hooked `getUserMedia` pipeline.
* **Finger snap isn't triggering automatically**:
  * Ensure your microphone is unmuted/active in the browser, and move your hand visibly in front of the camera when snapping (to pass the visual motion gate). You can always press **`Alt + S`** for an instant guaranteed trigger.
