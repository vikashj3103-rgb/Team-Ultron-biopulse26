# HealthConnect — Connected Hospital Care Platform

> **BioPulse '26 Hackathon Submission**  
> A connected clinical care and assistive communication platform unifying real-time patient vital telemetry, hardware smart-glove gesture requests, clinical episode deduplication, family caregiver coordination, and multi-floor hospital indoor wayfinding.

---

## 🌐 Quick Evaluation Links

- **Live Web App:** [https://team-ultron-biopulse26.vercel.app](https://team-ultron-biopulse26.vercel.app)
- **Source Code Repository:** [https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26](https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26)
- **Deployment Status:** Live on Vercel with Serverless & Edge API Gateway (`/api/sync/stream`, `/api/sync/state`, `/api/sync`, `/api/patient-events`)

---

## 👨‍⚖️ Step-by-Step Judge Evaluation Walkthrough

To verify the end-to-end functionality of HealthConnect without requiring local commands or setup:

1. **Launch the Public Web App:**
   - Open [https://team-ultron-biopulse26.vercel.app](https://team-ultron-biopulse26.vercel.app) in any modern browser (desktop, tablet, or mobile).

2. **Access via Quick Demo Access Tab:**
   - On the login screen, click the **"Quick Demo Access"** tab.
   - Choose one of the pre-configured role profiles with one click (no manual credential entry needed):
     - **Clinical Administrator** (`admin@careconnect.demo`): Complete hospital oversight & simulation controls.
     - **Attending Physician** (`doctor.cardio@careconnect.demo`): Doctor workstation assigned to Ramesh Kumar.
     - **Family Attender** (`attender.vikash@careconnect.demo`): Bedside caregiver portal for Ramesh Kumar.

3. **Verify Strict Patient Isolation & Gesture Requests:**
   - Sign in as **Attender** (Vikash Kumar) in Window A. Observe Ramesh Kumar's bedside dashboard.
   - Open an incognito window or second device as **Admin** and navigate to the **Simulation Center** (`/admin/demo`).
   - Trigger a **FOOD REQUEST** for Ramesh Kumar.
   - In Window A, immediately observe the assistance card appear with exact type **"Needs food"** (strictly FOOD, never Water).
   - In the Simulation Center, select **Anitha Raj** and trigger a request.
   - Return to Window A (Ramesh Kumar): confirm **ZERO cross-contamination**—Ramesh Kumar's screen is 100% isolated.

4. **Verify Continuous Telemetry Streaming & Physiological Drift:**
   - Observe the live bedside vitals cards on the Attender Dashboard.
   - Confirm the green **`● LIVE · Updated Xs ago`** badge and dynamic clock timestamp with seconds.
   - Observe physiological readings (Pulse, Blood Pressure, SpO2, Temperature) actively drifting within bounded ranges over time without page reloads.

5. **Verify Clinical Episode Deduplication & Alert Lifecycle:**
   - In the Simulation Center, trigger **Hypertensive Crisis** (178/112 mmHg) on Ramesh Kumar.
   - In the **Doctor Workstation** (`/doctor`), observe a single authoritative Clinical Episode card appear.
   - Even as continuous telemetry ticks arrive, observe the reading counter increment (`Readings: 24 observations`) without flooding the dashboard with duplicate cards.
   - Click **`[Acknowledge Alert]`**: observe the status atomically transition to **`ACKNOWLEDGED`**.
   - On the Attender dashboard, verify emergency escalation is immediately suppressed and the acknowledged status remains 100% stable across subsequent ticks.

6. **Explore Hospital Navigation & Multilingual Interface:**
   - Navigate to **Hospital Map** (`/attender/map` or `/doctor/map`) to inspect the interactive 3D and 2D multi-floor hospital blueprint.
   - Toggle languages in the top navigation bar between **English**, **हिंदी (Hindi)**, **தமிழ் (Tamil)**, and **తెలుగు (Telugu)**.

---

## 👥 Available Demonstration Roles

| Role | Profile Name | Assigned Scope | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Doctor** | Dr. Arun Kumar | Cardiology (Ramesh Kumar) | Inpatient census, vital telemetry graphs, episode deduplication, atomic alert acknowledgement, Rx ordering |
| **Doctor** | Dr. Meena Swaminathan | Neurology (Anitha Raj) | Stroke recovery protocols, isolated neurology patient tracking |
| **Attender** | Vikash Kumar | Grandson (Ramesh Kumar) | Bedside assistance requests, live vitals guide, medication administration log, emergency call escalation |
| **Attender** | Priya Raj | Daughter (Anitha Raj) | Isolated neurology caregiver portal |
| **Admin** | Clinical Operations | System-Wide | Multi-patient telemetry scenarios, hardware event injection, staff assignments, audit logs |

---

## 🧤 Smart-Glove Hardware Integration (ESP32)

HealthConnect integrates with a physical assistive smart glove built on the **ESP32 Dev Module** with flex sensors for non-verbal or motor-impaired patients:

```
[ Bedside ESP32 Smart Glove ]
         │
         │ HTTP POST JSON (Wi-Fi)
         ▼
[ POST /api/patient-events ]
         │
         │ Broadcasts hardware mutation
         ▼
[ Real-Time SSE Stream / Cross-Device Relay ]
         │
   ┌─────┴─────────────────────┐
   ▼                           ▼
[ Doctor Workstation ]     [ Attender Portal ]
```

### Physical Flex Sensor Pin Mapping

| GPIO Pin | Sensor Type | Mapped Assistance Request | Dashboard Display |
| :---: | :---: | :---: | :---: |
| **GPIO 35** | Flex Sensor 1 | `WATER` | **Needs water** |
| **GPIO 32** | Flex Sensor 2 | `FOOD` | **Needs food** |
| **GPIO 34** | Flex Sensor 3 | `EMERGENCY` | **Emergency assistance required** |

*(Software scenarios also support `MEDICINE` and `NURSE` calls).*

### Device-to-Patient Hardware Registry

- `GLOVE-ESP32-DEV01` → **Ramesh Kumar** (Room ICU-204, Bed B)
- `GLOVE-ESP32-DEV02` → **Anitha Raj** (Room ICU-205, Bed A)
- `GLOVE-ESP32-DEV03` → **Karthik S** (Room 302, Bed 1)
- `GLOVE-ESP32-DEV04` → **Suresh Kumar** (Room Post-Op 101, Bed C)

Firmware sketches, circuit schematics, and wiring diagrams are preserved in [`firmware/`](firmware/) and [`docs/GLOVE-INTEGRATION.md`](docs/GLOVE-INTEGRATION.md).

---

## 🛠️ Technology Stack

- **Frontend Core:** React 19, TypeScript, React Router v7
- **Styling & UI:** Tailwind CSS v4, Lucide Icons, KaTeX for clinical formulas
- **Build Tool:** Vite v8
- **Synchronization & Edge API:**
  - Vercel Edge Runtime for unbuffered Server-Sent Events (`/api/sync/stream`)
  - Serverless JSON endpoints (`/api/sync`, `/api/sync/state`, `/api/sync/reset`, `/api/patient-events`)
  - Local `BroadcastChannel` for zero-latency multi-tab synchronization
- **Code Quality:** Oxlint, TypeScript strict mode, Jiti E2E automated test harness (97 verification phases)
- **Embedded Hardware:** ESP32 C++/Arduino firmware, flex sensors, DHT22 temperature sensor

---

## 🔬 Core Architectural Principles

1. **Clinical Episode Deduplication (No Alert Flooding):**
   Telemetry is not an alert. Repeated abnormal readings (e.g., persistent SpO2 88%) attach to one active clinical episode, incrementing occurrence counters and updating trends rather than generating dozens of duplicate cards.
2. **Authoritative Atomic Acknowledgement:**
   Clinician acknowledgement transitions state atomically from `ACTIVE` to `ACKNOWLEDGED`. Subsequent telemetry ticks never revert or overwrite acknowledged clinical episodes.
3. **Strict Patient Isolation:**
   Every patient's state, history, vitals, alerts, and glove gestures are strictly isolated by `patientId`. Events for Ramesh Kumar never modify or leak into Anitha Raj's state.
4. **Physiologically Bounded Drift:**
   Vital signs drift naturally and continuously within bounded clinical ranges without artificial client-only timer hacks.

---

## 💻 Local Development & Fresh Checkout

```bash
# 1. Clone the repository
git clone https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26.git
cd Team-Ultron-biopulse26

# 2. Install dependencies
npm install

# 3. Start development server with local sync relay (Port 3001)
npm run dev

# 4. Run automated test suite (all 97 phases)
npm test

# 5. Production build check
npm run build
```

---

## ⚠️ Notes & Limitations

- **Academic Demonstration Platform:** HealthConnect is an academic prototype for hackathon evaluation. Synthetic patient records are used exclusively.
- **Physical Hardware Prerequisite:** The physical ESP32 glove communicates via Wi-Fi to `/api/patient-events`. For online evaluation without physical hardware present, the built-in Clinical Operations Center (`/admin/demo`) provides 1:1 hardware event emulation.
