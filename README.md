# AetherMeet — Secure Real-Time Video Conferencing Website Using WebRTC

A modern, secure, and responsive real-time video conferencing application built with **WebRTC**, **Socket.IO**, **Node.js/Express (TypeScript)**, **React (Vite + TypeScript)**, and **Tailwind CSS**.

AetherMeet supports multiple simultaneous independent meetings running concurrently, with real-time video/audio calling, screen sharing, in-meeting chat, host controls (waiting rooms, participant admission/removal, room locking), live emoji reaction bursts, and audio visualizer meters.

---

## 🌟 Key Features

### 1. Real-Time Video & Audio Communication (WebRTC)
- **Zero plugins required:** Pure WebRTC standard browser APIs (`RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`).
- **Dynamic Track Control:** Mute/unmute microphone, turn camera on/off, and switch between video and audio-only mode.
- **Active Speaker Visualizer:** Real-time Web Audio API frequency analysis highlighting speaking participants with a green glow.
- **Screen Sharing:** HD desktop/window/tab sharing with seamless track replacement without renegotiation dropping.
- **Hardware Selection:** Test and select input microphones, cameras, and audio outputs before and during meetings.

### 2. Multi-Meeting Concurrency & Room Isolation
- **Strict Isolation:** Independent signaling channels, chat rooms, and participant state pools for every meeting.
- **Cryptographic Room IDs:** Collision-resistant identifiers formatted like `abc-defg-hij` generated via `crypto.randomBytes`.
- **Automatic Cleanup:** Empty rooms, disconnected peer connections, and media tracks are automatically cleaned up on departure.

### 3. Pre-Join Preview Lobby
- Camera & microphone hardware preview before entering.
- Real-time audio meter gauge (0–100%) showing live voice detection.
- Display name customization and instant device switching.

### 4. In-Meeting Text Chat
- Real-time messaging isolated strictly to the meeting room.
- Sender names, timestamps, and auto-scrolling message history.
- XSS protection via server and client sanitization.
- Rate limiting against spamming.

### 5. Host & Participant Management
- **Role-Based Access Control:** Host privileges are authenticated on both REST APIs and Socket.IO events.
- **Waiting Room:** Host-controlled waiting room holding participants until the host admits or rejects them.
- **Room Lock:** Prevents anyone else from entering the meeting.
- **Remote Mute & Kick:** Host can remotely mute noisy participants or remove disruptive users.
- **Leave vs End for Everyone:** Host has distinct controls to either leave the meeting individually or terminate it for all participants.

### 6. Interactive Experience & UI Aesthetics
- **Floating Emoji Reaction Bursts:** Instant emoji reactions (👍, 👏, ❤️, 🎉, 😂, 🔥) with particle animations and celebratory confetti.
- **Raise Hand:** Visual hand-raising indicator for participants.
- **Pinned / Spotlight Layout:** Toggle between responsive grid (1, 2, 4, 6, 9+ tiles) and spotlight speaker mode.
- **Dark / Light Theme:** Persistent theme toggling.
- **Keyboard Shortcuts:**
  - `M` or `Space`: Toggle microphone
  - `V`: Toggle video
  - `C`: Toggle in-meeting chat drawer
  - `P`: Toggle participants drawer
  - `Esc`: Close open drawers/modals

---

## 🏗 Architecture & WebRTC Scalability

```
┌──────────────────────────────────────────────────────────────────┐
│                           Client Browser                         │
│   (React + Vite + TypeScript + WebRTC PeerConnection Pool)        │
└───────────────▲──────────────────────────────────▲───────────────┘
                │ WebRTC P2P Media                 │ Socket.IO
                │ (SRTP / DTLS encrypted)          │ Signaling (WSS)
                ▼                                  ▼
┌───────────────────────────────────┐    ┌─────────────────────────┐
│     Peer Browser / WebRTC Peer    │    │ Node.js Signaling Server│
└───────────────────────────────────┘    │ (Express + Socket.IO)   │
                                         └────────────┬────────────┘
                                                      │
                       ┌──────────────────────────────┴───────────────┐
                       ▼                                              ▼
            ┌──────────────────────┐                       ┌─────────────────────┐
            │ SQLite (Dev) /       │                       │ Redis (Scaling)     │
            │ PostgreSQL (Prod)    │                       │ Multi-server sync   │
            └──────────────────────┘                       └─────────────────────┘
```

### Media Architecture Evaluation: Mesh vs SFU
- **Full Mesh (Current Implementation):** Each peer establishes an `RTCPeerConnection` with other peers in the room.
  - *Advantages:* Zero native C++ compilation dependencies, runs effortlessly cross-platform on Windows/macOS/Linux/Docker, lowest latency, and no expensive media server cloud hosting costs for typical small-to-medium rooms (up to 4–6 active participants).
  - *Bandwidth Considerations:* Uplink and downlink increase with $N-1$ participants.
- **Selective Forwarding Unit (SFU) Transition:** For large conferences (10–100+ participants), media routing can be transitioned to an open-source SFU (such as **mediasoup** or **LiveKit**). AetherMeet's signaling abstraction (`join-meeting`, `update-media-state`, `room-lock`, etc.) is structured so that WebRTC senders/receivers can route tracks to an SFU router without modifying the UI layer.

---

## 🔒 Security Architecture

| Security Domain | Implementation Details |
|---|---|
| **Authentication** | Secure JWT with bcrypt password hashing (12 rounds) and user profile storage. |
| **Meeting Authorization** | Cryptographically random meeting codes (`abc-defg-hij`). Server-side validation on every socket event. |
| **Transport Security** | WSS (WebSocket Secure) and HTTPS in production. DTLS-SRTP for all WebRTC audio/video streams. |
| **Rate Limiting** | Sliding window rate limiting on authentication, meeting creation, and socket chat events. |
| **Input Sanitization** | HTML and script sanitization to prevent Stored and Reflected XSS. |
| **Room Isolation** | Server verifies that signaling offers/answers and chat messages originate and terminate within the exact same meeting room ID. |
| **Transport vs E2EE** | WebRTC media packets are encrypted hop-by-hop using DTLS-SRTP. WebRTC standard transport encryption protects streams in transit against interception. |

---

## 🚀 Quick Start (Windows & VS Code)

### Prerequisites
- **Node.js** v18+ (tested on Node.js v22/v25)
- **npm** v10+

### Step 1: Clone or Open Workspace
Open the project directory in VS Code or PowerShell:
```powershell
cd "c:\Users\saiso\OneDrive\Sowmya\WEB RTC website"
```

### Step 2: Install Dependencies
Install dependencies across the root, backend, and frontend:
```powershell
npm install
npm install --prefix server
npm install --prefix client
```

### Step 3: Initialize Database
The backend is pre-configured with a zero-config SQLite database (`dev.db`):
```powershell
npm run prisma:push --prefix server
```

### Step 4: Run the Application Locally
Start both backend (Port 5000) and frontend (Port 5173) concurrently:
```powershell
npm run dev
```
Alternatively, in two separate terminal windows:
- **Terminal 1 (Backend):**
  ```powershell
  npm run dev:server
  ```
- **Terminal 2 (Frontend):**
  ```powershell
  npm run dev:client
  ```

Open your browser at:
👉 **`http://localhost:5173`**

---

## 🧪 Testing with Two Users on Separate Devices

To test live audio/video calls between two users:

### Option A: Testing on the Same Machine (Two Browser Windows)
1. Open `http://localhost:5173` in **Google Chrome**.
2. Click **Get Started** or **Sign In** -> Click **"Demo Host"** (1-click sign-in).
3. Click **"Start Instant Meeting"**.
4. In the pre-join screen, allow camera and microphone, enter your display name, and click **"Join Meeting Now"**.
5. Copy the meeting link from the top bar (e.g., `http://localhost:5173/meet/abc-defg-hij`).
6. Open an **Incognito Window** or **Firefox / Edge**.
7. Paste the meeting link -> Click **"Demo Guest"** or enter a guest name.
8. Allow camera/mic and click **"Join Meeting Now"**.
9. Both users will now see each other's live video, hear audio, see speaking visualizers, exchange chat messages, and send emoji reactions!

### Option B: Testing Across Two Separate Devices (e.g., Laptop & Phone on Local Wi-Fi)
1. Find your machine's local IP address (in PowerShell, run `ipconfig`, e.g. `192.168.1.15`).
2. Vite is already configured with `host: true`.
3. Open `http://192.168.1.15:5173` on your second device (smartphone or tablet).
4. *Note on WebRTC Permissions:* Modern mobile browsers (iOS Safari and Android Chrome) require HTTPS or `localhost` to allow camera/microphone access. For local network cross-device testing with camera permissions, run with an HTTPS tunnel such as `ngrok http 5173` or configure self-signed certificates.

---

## 🐳 Docker & Docker Compose Deployment

A complete production-ready Docker setup is included, featuring PostgreSQL 16, Redis 7, the Node.js backend, and Nginx for the frontend:

```powershell
# Build and run all services in background
docker compose up -d --build

# View container logs
docker compose logs -f

# Stop all containers
docker compose down
```

Services exposed:
- **Frontend & Reverse Proxy:** `http://localhost:80`
- **Backend API & WebSockets:** `http://localhost:5000`
- **PostgreSQL Database:** `localhost:5432`
- **Redis Cache:** `localhost:6379`

---

## 🧪 Automated Testing

Both backend and frontend contain automated test suites:

### Run Backend Tests (Auth, Room Isolation, RoomManager, Security)
```powershell
npm run test:server
```
*(12 tests passing)*

### Run Frontend Tests (VideoTile, LeaveModal, ChatDrawer)
```powershell
npm run test:client
```
*(6 tests passing)*

### Run All Workspace Tests
```powershell
npm test
```
*(All 18 tests passing)*

---

## 🌐 STUN & TURN Configuration Guide

WebRTC requires ICE (Interactive Connectivity Establishment) servers to discover public IP addresses and navigate firewalls:

1. **STUN (Session Traversal Utilities for NAT):** Google's free STUN servers are configured by default in `server/src/config/index.ts`:
   ```
   stun:stun.l.google.com:19302
   stun:stun1.l.google.com:19302
   ```
2. **TURN (Traversal Using Relays around NAT):** For enterprise firewalls or symmetric NATs, configure TURN credentials in `server/.env`:
   ```env
   TURN_SERVER_URL=turn:turn.yourdomain.com:3478
   TURN_USERNAME=my_turn_username
   TURN_CREDENTIAL=my_turn_password
   ```
   Popular open-source TURN options include **coturn**.

---

## 📁 Project Structure

```
├── client/                     # Frontend Application (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/         # Navbar, VideoTile, VideoGrid, MeetingControls, ChatDrawer, etc.
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── hooks/              # useMediaDevices, useWebRTC, useKeyboardShortcuts
│   │   ├── pages/              # LandingPage, LoginPage, RegisterPage, DashboardPage, PreJoinPage, MeetingRoomPage, MeetingEndedPage
│   │   ├── services/           # api.ts, socket.ts
│   │   ├── types/              # TypeScript types
│   │   ├── App.tsx             # Route management
│   │   └── main.tsx            # React root
│   ├── tests/                  # Vitest + React Testing Library component tests
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.ts
├── server/                     # Backend Application (Node.js + Express + TypeScript + Socket.IO)
│   ├── src/
│   │   ├── config/             # Environment, STUN/TURN configuration
│   │   ├── controllers/        # AuthController, MeetingController
│   │   ├── middleware/         # Auth, RateLimiter, ErrorHandler
│   │   ├── routes/             # AuthRoutes, MeetingRoutes
│   │   ├── services/           # RoomManager (in-memory room and waiting room state)
│   │   ├── sockets/            # meetingSocket.ts (WebRTC signaling and room events)
│   │   ├── utils/              # security.ts, prisma.ts
│   │   └── index.ts            # Entry point
│   ├── prisma/                 # schema.prisma (User, Meeting, Participant, ChatMessage)
│   └── tests/                  # Backend integration tests
├── Dockerfile.backend          # Multi-stage Docker build for backend
├── Dockerfile.frontend         # Multi-stage Docker build with Nginx for frontend
├── docker-compose.yml          # Multi-container orchestration (Postgres, Redis, API, Web)
├── .env.example                # Documented configuration variables
└── package.json                # Root package with development and testing scripts
```

---

## 📋 Implemented Requirements Summary

- ✅ **Full-Stack Application:** Express + Socket.IO backend, React + Vite frontend, SQLite/PostgreSQL database via Prisma.
- ✅ **Real WebRTC Audio & Video:** Standards-compliant peer connection negotiation, SDP offers/answers, and candidate queueing.
- ✅ **Screen Sharing:** Native `getDisplayMedia` with automatic track replacement.
- ✅ **Room Isolation:** Independent room channels; participants and messages never cross boundaries.
- ✅ **Waiting Room & Host Controls:** Admit/deny users, remote mute, participant removal, and meeting lock.
- ✅ **Security:** JWT authentication, bcrypt password hashing, rate limiting, and XSS sanitization.
- ✅ **18 Automated Tests:** Full test coverage across backend and frontend.
