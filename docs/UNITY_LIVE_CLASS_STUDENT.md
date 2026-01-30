# Unity – Student Live Class (WebRTC + Socket.IO)

## Signaling flow (overview)

1. **Teacher** connects Socket.IO with JWT → emits **startLiveClass** `{ classId }` → server stores `classId → teacherSocketId`, teacher joins room.
2. **Student** connects Socket.IO with JWT → emits **joinLiveClass** `{ classId }` → server joins student to room and emits **studentJoined** `{ classId, studentSocketId }` to teacher.
3. **Teacher** (browser): gets display stream, creates `RTCPeerConnection`, creates offer → emits **offer** `{ classId, toSocketId: studentSocketId, sdp }` → server forwards to student.
4. **Student** (Unity): receives **offer** → creates `RTCPeerConnection`, sets remote description (offer), creates answer, sets local description → emits **answer** `{ classId, toSocketId: teacherSocketId, sdp }` → server forwards to teacher.
5. **ICE**: both sides gather ICE candidates and emit **iceCandidate** `{ classId, toSocketId, candidate }`; server forwards to the other peer. Each side calls `AddIceCandidate` on its peer connection.
6. When connection is established, student receives the teacher’s stream (e.g. on `OnTrack`) and shows it (e.g. on a `VideoPlayer` or RenderTexture).

---

## Step-by-step student workflow

| Step | Action | Socket event | Your code |
|------|--------|--------------|-----------|
| 1 | Connect to backend | – | Connect Socket.IO with JWT (from login). |
| 2 | Join live class | **joinLiveClass** `{ classId }` | Emit after connect; use class ID from your class list API. |
| 3 | Wait for offer | Listen **offer** | Payload: `{ fromSocketId, classId, sdp }`. Save `fromSocketId` (teacher). |
| 4 | Create peer connection | – | Create `RTCPeerConnection`, set up `OnTrack` to receive stream. |
| 5 | Set remote description | – | `SetRemoteDescription(offerSdp)`. |
| 6 | Create and send answer | **answer** `{ classId, toSocketId: teacherSocketId, sdp }` | Create answer, set local description, emit answer. |
| 7 | Exchange ICE | **iceCandidate** `{ classId, toSocketId, candidate }` | On local ICE candidate, emit to teacher; on **iceCandidate** from server, `AddIceCandidate`. |
| 8 | Receive stream | – | In `OnTrack`, attach remote track to your video renderer (e.g. `VideoPlayer` / RenderTexture). |
| 9 | End | **liveClassEnded** | Close peer connection, stop video. |

---

## Unity C# pseudocode (student)

Use a Socket.IO client for Unity (e.g. [socket.io-unity](https://github.com/nhn/socket.io-unity) or equivalent) and a WebRTC package (e.g. **Unity WebRTC** from Package Manager or [Unity WebRTC](https://github.com/Unity-Technologies/UnityRenderStreaming)).

```csharp
// Pseudocode – adapt to your Socket.IO and WebRTC packages
using UnityEngine;
using Unity.WebRTC;  // or your WebRTC package
// + your Socket.IO client namespace

public class LiveClassStudent : MonoBehaviour
{
    // 1) Connect socket
    private void ConnectSocket(string serverUrl, string jwtToken)
    {
        // Example (syntax depends on your Socket.IO plugin):
        // socket = IO.Socket(serverUrl, new IO.Options { Auth = new { token = jwtToken } });
        socket.OnConnect(() =>
        {
            Debug.Log("Socket connected");
            JoinLiveClass(classId);
        });
    }

    // 2) Join live class
    private void JoinLiveClass(string classId)
    {
        socket.Emit("joinLiveClass", new { classId });
        // Server will notify teacher; teacher sends offer to us
    }

    // 3) Register listeners (after socket connected)
    private void RegisterSocketListeners()
    {
        socket.On("offer", (data) =>
        {
            // data: { fromSocketId, classId, sdp }
            string teacherSocketId = data.fromSocketId;
            string payloadClassId = data.classId;
            RTCSessionDescription offerSdp = ParseSdp(data.sdp);

            CreatePeerConnection(teacherSocketId);
            peerConnection.SetRemoteDescription(ref offerSdp);
            CreateAndSendAnswer(teacherSocketId, payloadClassId);
        });

        socket.On("iceCandidate", (data) =>
        {
            // data: { fromSocketId, classId, candidate }
            RTCIceCandidate candidate = ParseIceCandidate(data.candidate);
            peerConnection.AddIceCandidate(candidate);
        });

        socket.On("liveClassEnded", (data) =>
        {
            ClosePeerConnection();
            StopVideo();
        });
    }

    // 4) Create RTCPeerConnection and receive stream
    private void CreatePeerConnection(string teacherSocketId)
    {
        peerConnection = new RTCPeerConnection();
        teacherId = teacherSocketId;

        peerConnection.OnTrack = (RTCTrackEvent e) =>
        {
            // Receive teacher's screen stream
            if (e.Track.Kind == TrackKind.Video)
            {
                // Assign to your VideoPlayer / RenderTexture
                // e.Receiver (MediaStreamTrack) -> your video renderer
                ReceiveRemoteVideo(e.Track);
            }
        };

        peerConnection.OnIceCandidate = (RTCIceCandidate candidate) =>
        {
            if (candidate != null)
                socket.Emit("iceCandidate", new { classId, toSocketId = teacherSocketId, candidate = SerializeCandidate(candidate) });
        };
    }

    // 5) Create answer and send to teacher
    private async void CreateAndSendAnswer(string teacherSocketId, string payloadClassId)
    {
        RTCSessionDescription answerDesc = peerConnection.CreateAnswer();
        await peerConnection.SetLocalDescription(ref answerDesc);
        RTCSessionDescription localDesc = peerConnection.LocalDescription;
        socket.Emit("answer", new { classId = payloadClassId, toSocketId = teacherSocketId, sdp = SerializeSdp(localDesc) });
    }

    // 6) Receive stream – attach to Unity video output
    private void ReceiveRemoteVideo(MediaStreamTrack track)
    {
        // Depends on your WebRTC/Unity setup:
        // - Unity WebRTC: use VideoStreamTrack and assign to Renderer or VideoPlayer
        // - Often: create a RenderTexture, assign track to a target that renders into it, then use that texture on a RawImage or VideoPlayer
        // Example (conceptual):
        // videoStreamTrack = track as VideoStreamTrack;
        // videoStreamTrack.OnVideoReceived += (tex) => { yourRawImage.texture = tex; };
    }

    private void ClosePeerConnection()
    {
        peerConnection?.Close();
        peerConnection = null;
    }
}
```

---

## SDP / ICE serialization

- **sdp**: Your WebRTC plugin usually gives an `RTCSessionDescription` with type and sdp string. Send `{ type: desc.type, sdp: desc.sdp }` (or whatever your server/teacher expects).
- **candidate**: Send `{ candidate: candidate.Candidate, sdpMid: candidate.SdpMid, sdpMLineIndex: candidate.SdpMLineIndex }` (or the format your WebRTC stack uses).

Parse incoming `sdp` and `candidate` from JSON into your plugin’s `RTCSessionDescription` and `RTCIceCandidate` types.

---

## Summary

- **Backend**: Only forwards signaling (offer, answer, iceCandidate) and maintains `classId → teacherSocketId`.
- **Teacher (Web)**: Starts class, on **studentJoined** captures screen, creates offer, sends offer and ICE to student.
- **Student (Unity)**: Joins class, on **offer** creates PC, sets remote description, creates answer and sends it, exchanges ICE, receives stream in `OnTrack` and displays it.

No database or auth changes; only Socket.IO events and WebRTC on teacher and student.
