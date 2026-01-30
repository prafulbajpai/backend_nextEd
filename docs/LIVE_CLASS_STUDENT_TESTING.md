# Live Class – Student Side: Signaling Flow & Testing Guide

## 1. Signaling flow (text diagram)

```
TEACHER (Web)                    SERVER (Socket.IO)                 STUDENT (Web / Unity)
     |                                    |                                    |
     |  connect + JWT                     |                                    |
     |----------------------------------->|                                    |
     |  startLiveClass { classId }         |                                    |
     |----------------------------------->|  classId -> teacherSocketId          |
     |  liveClassStarted                  |                                    |
     |<-----------------------------------|                                    |
     |                                    |  connect + JWT                     |
     |                                    |<-----------------------------------|
     |                                    |  joinLiveClass { classId }         |
     |                                    |<-----------------------------------|
     |  studentJoined { studentSocketId } |                                    |
     |<-----------------------------------|                                    |
     |                                    |                                    |
     |  getDisplayMedia()                 |                                    |
     |  createOffer()                     |                                    |
     |  offer { toSocketId, classId, sdp } |                                    |
     |----------------------------------->|  offer { fromSocketId, classId, sdp }|
     |                                    |----------------------------------->|
     |                                    |         setRemoteDescription(sdp)    |
     |                                    |         createAnswer()              |
     |                                    |  answer { toSocketId, classId, sdp }|
     |                                    |<-----------------------------------|
     |  answer { fromSocketId, sdp }      |                                    |
     |<-----------------------------------|                                    |
     |  setRemoteDescription(sdp)         |                                    |
     |                                    |                                    |
     |  ICE candidates (both sides)       |                                    |
     |<===================================>|  iceCandidate { toSocketId, ... }  |
     |                                    |<===================================>|
     |                                    |                                    |
     |  <========= WebRTC media (teacher screen) =========>                     |
     |                                    |                                    |
     |  endLiveClass { classId }          |  liveClassEnded { classId }        |
     |----------------------------------->|----------------------------------->|
```

- **Teacher** starts class → server stores `classId → teacherSocketId`.
- **Student** joins → server notifies teacher with `studentSocketId`.
- **Teacher** sends **offer** (SDP) → server forwards to student.
- **Student** sends **answer** (SDP) → server forwards to teacher.
- **Both** send **iceCandidate** → server forwards to the other peer.
- After ICE completes, media flows over WebRTC; no media through server.
- **Teacher** ends class → server emits **liveClassEnded** to room.

---

## 2. STUN / ICE configuration

All student implementations use these free STUN servers:

- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

No TURN or paid services required for basic testing (same network or simple NAT).

---

## 3. Web student (student.html) – step-by-step testing

### Prerequisites

- Backend running: `npm run dev` (e.g. `http://localhost:5000`).
- Teacher page: open `teacher-liveclass.html`, connect, start a live class for a **classId** (e.g. a MongoDB Class `_id`).
- JWT: get a token via `POST /api/auth/login` (student or any user).

### Steps

1. **Get JWT**
   - e.g. `POST http://localhost:5000/api/auth/login`  
     Body: `{ "email": "student@test.com", "password": "123456" }`
   - Copy the `token` from the response.

2. **Open student page**
   - Open `student.html` in a browser (same machine or replace URL with server IP).

3. **Fill inputs**
   - **Socket server URL:** `http://localhost:5000` (or your server URL).
   - **JWT token:** paste the token from step 1.
   - **Class ID:** same `classId` the teacher used when starting the live class.

4. **Join**
   - Click **Join Live Class**.
   - Status should show: Connected → Joining class → (if teacher is live) Received offer → Answer sent → Receiving teacher stream.

5. **Verify**
   - Teacher’s shared screen should appear in the `<video>` on the student page.
   - If teacher clicks “Stop Live Class”, student should see “Live class ended” and video stop.

### Troubleshooting (web student)

- **“Class not live”:** Teacher must click “Start Live Class” with the same **classId** before student joins.
- **No video:** Check browser console; ensure teacher allowed screen share and that no firewall blocks WebRTC.
- **Connection failed:** Check URL, CORS, and that backend is running; use same JWT as for API.

---

## 4. Unity student – step-by-step testing

### Prerequisites

- Unity project with:
  - **com.unity.webrtc** (Package Manager).
  - A Socket.IO client (e.g. SocketIOUnity) and an `ILiveClassTransport` implementation (e.g. `SocketIOUnityTransport` with real Socket.IO calls).
- Backend and teacher same as above.

### Scene setup

1. Create an empty GameObject (e.g. “LiveClass”).
2. Add **LiveClassSocketClient**.
3. Add **LiveClassWebRTC** (requires LiveClassSocketClient).
4. Assign a **transport** on LiveClassSocketClient:
   - Add **SocketIOUnityTransport** (or your transport) to the same GameObject.
   - In LiveClassSocketClient, set **Transport** to that component.
5. In LiveClassWebRTC, assign **Remote Video Target** to a **RawImage** (UI).
6. Set **Server Url** and **Jwt Token** on LiveClassSocketClient (or set from code after login).

### Flow in code

1. **Connect**
   - Call `LiveClassSocketClient.Connect()` (e.g. after user logs in and you have a JWT).
2. **When connected**
   - Subscribe to `OnConnected`, then call `LiveClassWebRTC.JoinLiveClass(classId)` (same classId as teacher).
3. **Signaling**
   - LiveClassSocketClient receives **offer** → LiveClassWebRTC creates answer and sends it.
   - ICE is exchanged automatically; teacher stream is rendered to **Remote Video Target** (RawImage).

### Minimal test script (attach to same GameObject)

```csharp
public class LiveClassTester : MonoBehaviour
{
    public LiveClassSocketClient socketClient;
    public LiveClassWebRTC webrtc;
    public string classId = "YOUR_CLASS_ID";

    void Start()
    {
        socketClient.OnConnected += () => webrtc.JoinLiveClass(classId);
        socketClient.Connect();
    }
}
```

### STUN in Unity

- **LiveClassWebRTC** uses the **STUN servers** listed in the “STUN / ICE configuration” section (same as web student).
- You can edit the list in the inspector (**Stun Urls** on LiveClassWebRTC).

### Troubleshooting (Unity)

- **No transport:** Assign **Transport** on LiveClassSocketClient; implement **ILiveClassTransport** (e.g. complete SocketIOUnityTransport with your Socket.IO client).
- **No video on RawImage:** Ensure **remoteVideoTarget** is assigned and that **com.unity.webrtc** is set up (e.g. WebRTC.Update() is called; LiveClassWebRTC does this in Update).
- **Offer/answer errors:** Check that backend and teacher use the same **classId** and that teacher has started the live class before student joins.

---

## 5. File summary

| File | Role |
|------|------|
| **student.html** | Web student: connect, join, offer/answer/ICE, show stream in `<video>`. |
| **LiveClassSocketClient.cs** | Socket client: connect, joinLiveClass, send answer/ICE, expose OnOffer / OnIceCandidate / OnLiveClassEnded. |
| **LiveClassWebRTC.cs** | WebRTC student: handle offer, create answer, ICE, render teacher stream to RawImage; uses multiple STUN servers. |
| **SocketIOUnityTransport.cs** | Placeholder **ILiveClassTransport**; implement with your Socket.IO client (e.g. SocketIOUnity). |
| **LIVE_CLASS_STUDENT_TESTING.md** | This file: signaling diagram, STUN config, web + Unity testing steps. |

All logic is minimal; no backend or liveClassSocket.js changes required.
