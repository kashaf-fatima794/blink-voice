# BlinkVoice
### Blink-Controlled Assistive Communication System

**Giving everyone a voice, one blink at a time.**

**Team:** Bit Wizard  
**Event:** Minhaj University Lahore, STCS AI Hackathon & Startup Pitch 2026  
**Niche:** AI for Accessible Healthcare & Well-Being (UN SDG 3: Good Health and Well-Being)

---

## Problem

People who lose the ability to speak or move their hands (for example due to ALS, stroke, spinal injury or paralysis) often cannot call a nurse, say they are in pain, or ask for water. Dedicated eye-tracking communication devices cost roughly $1,000 to $5,000, which puts them out of reach for most families, hospitals and rehabilitation centres in Pakistan and similar regions.

## Users

- **Patients** who cannot speak or use their hands but can control their eyelids
- **Caregivers and family members** who need to understand the patient quickly
- **Hospitals, ICUs and rehabilitation centres** that need a low-cost communication aid

## Solution

BlinkVoice turns deliberate eye blinks into selections and spoken messages, using only an ordinary webcam. A scanning keyboard highlights options automatically, so the user needs just one signal (a sustained blink) to type, pick quick phrases, speak aloud, or trigger an emergency alert. It works in English and Urdu.

## Key Features

- **Blink-based interaction:** detects deliberate, sustained eye closures to select items, with no mouse or keyboard needed
- **Scanning keyboard:** automatic scanning through letters and characters, with word suggestions
- **Quick phrases:** Yes, No, Water, Pain, Washroom, Thank You and more
- **English and Urdu:** Urdu script and Roman Urdu options
- **Text-to-speech:** spoken output through the browser's speech engine
- **Personalised calibration:** measures the user's own open and closed eye values for reliable blink detection
- **Accessibility settings:** dark mode and adjustable text size
- **Emergency alert:** confirmation-based SOS with a cancel window, optional location, notification (ntfy) and phone-call link
- **Privacy-friendly:** face processing runs in the browser; video is not uploaded

## AI Stack

| Component | Role |
|---|---|
| **MediaPipe Face Landmarker** (pretrained neural network, runs in the browser via WebAssembly) | Detects the face and eye landmarks from the live webcam feed |
| **Eye Aspect Ratio (EAR) blink classifier with per-user calibration** | Converts landmarks into reliable blink and sustained-blink events |
| **Adaptive word suggestions** (learned word frequency stored locally) | Predicts words while typing to reduce the number of blinks needed |

BlinkVoice uses real, live AI inference on every video frame. No responses are hardcoded or simulated.

## Startup and Sustainability Model

- **Free tier** for individual patients and families, since the product runs in a browser with no special hardware
- **Subscription for hospitals, ICUs and rehabilitation centres:** multi-patient management, caregiver dashboard, usage reports, and support
- **Partnerships and grants:** disability NGOs, health-tech programmes and SDG 3 funding
- **Roadmap:** gaze-point tracking for faster typing, an LLM-based sentence predictor, more regional languages, and clinical validation with speech therapists

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5, CSS3, JavaScript | Interface and application logic |
| Vite | Development server and build tool |
| MediaPipe Tasks Vision | Facial and eye landmark detection |
| Web Speech API | Text-to-speech |
| Browser APIs | Webcam, local storage, geolocation |
| ntfy | Notification for the SOS prototype |

## Local Setup

**Requirements:** Node.js (with npm), Google Chrome or Microsoft Edge, a webcam, and good lighting.

1. Download or clone this repository and open the folder that contains `package.json`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the URL shown in the terminal (usually `http://localhost:5173`) and allow webcam access

No API key is required to run the app. `.env.example` is included for reference only; never commit a real `.env` file.

**Production build (optional):**
```bash
npm run build
npm run preview
```

## First-Time Use

1. Allow webcam permission when asked
2. Complete the short blink calibration, keeping your face visible and the lighting steady
3. Wait for the highlight to reach the option you want, then blink and hold briefly to select it
4. Use the speak option to say your message aloud
5. Recalibrate if blink detection becomes unreliable

## Privacy and Security

- Face and eye processing happens in the browser using MediaPipe; webcam video is not intentionally uploaded
- Preferences and learned word frequencies are stored in the browser's local storage
- Location is optional and only requested when an alert is triggered
- The SOS notification uses a configured ntfy topic; do not publish private topics or personal contact details
- Only synthetic or non-sensitive data is used; no confidential patient information is stored

## Limitations

BlinkVoice is a hackathon prototype.

- Blink detection can be affected by lighting, camera position, glasses and individual differences
- Selection speed depends on the scanning interval
- Speech voices depend on the browser and operating system; Urdu voices may be unavailable on some devices
- Notification and phone-call features are not guaranteed to be delivered
- It uses blink-controlled scanning, not precise gaze-point tracking

**BlinkVoice is an assistive communication aid, not a medical diagnostic tool or a certified medical device. It does not diagnose conditions and must not replace professional care or reliable emergency systems.**

## Project Structure

```text
BlinkVoice/
├── index.html
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── assets/
    ├── counter.js
    ├── main.js
    └── style.css
```

## Team: Bit Wizard

- Kashaf Fatima
- Sidra Sajjad
- Sadia Mazher

## Acknowledgements

- [Google MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
- [Vite](https://vite.dev/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [ntfy](https://ntfy.sh/)

---

**BlinkVoice: making communication more accessible, one blink at a time.**
