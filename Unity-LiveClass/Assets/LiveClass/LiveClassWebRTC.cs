using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using Unity.WebRTC; // Package: com.unity.webrtc

/// <summary>
/// WebRTC student side: handle offer, create answer, exchange ICE, render remote video to RawImage.
/// Uses multiple free STUN servers. Requires LiveClassSocketClient for signaling.
/// </summary>
[RequireComponent(typeof(LiveClassSocketClient))]
public class LiveClassWebRTC : MonoBehaviour
{
    [Header("Video output")]
    [Tooltip("Assign a RawImage to show the teacher's screen.")]
    public RawImage remoteVideoTarget;

    [Header("STUN servers (free)")]
    public string[] stunUrls = new[]
    {
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302"
    };

    private LiveClassSocketClient socketClient;
    private RTCPeerConnection peerConnection;
    private RTCConfiguration config;
    private bool answerCreated;

    private void Awake()
    {
        socketClient = GetComponent<LiveClassSocketClient>();
        if (socketClient == null) return;

        var servers = new RTCIceServer[stunUrls.Length];
        for (int i = 0; i < stunUrls.Length; i++)
            servers[i] = new RTCIceServer { urls = new[] { stunUrls[i] } };
        config = new RTCConfiguration { iceServers = servers };

        socketClient.OnOffer += HandleOffer;
        socketClient.OnIceCandidate += HandleRemoteIceCandidate;
        socketClient.OnLiveClassEnded += HandleLiveClassEnded;
        socketClient.OnError += (msg) => Debug.LogWarning("[LiveClassWebRTC] " + msg);
    }

    private void OnDestroy()
    {
        if (socketClient != null)
        {
            socketClient.OnOffer -= HandleOffer;
            socketClient.OnIceCandidate -= HandleRemoteIceCandidate;
            socketClient.OnLiveClassEnded -= HandleLiveClassEnded;
        }
        ClosePeerConnection();
    }

    private void Update()
    {
        WebRTC.Update(); // Required by Unity WebRTC each frame
    }

    /// <summary>Call after socket is connected. Joins the live class and waits for offer.</summary>
    public void JoinLiveClass(string classId)
    {
        socketClient.JoinLiveClass(classId);
    }

    private void HandleOffer(string teacherSocketId, string classId, string sdpJson)
    {
        StartCoroutine(HandleOfferCoroutine(teacherSocketId, classId, sdpJson));
    }

    private IEnumerator HandleOfferCoroutine(string teacherSocketId, string classId, string sdpJson)
    {
        ClosePeerConnection();
        answerCreated = false;

        var desc = ParseSessionDescription(sdpJson);
        if (desc == null) { Debug.LogError("[LiveClassWebRTC] Failed to parse offer SDP"); yield break; }

        peerConnection = new RTCPeerConnection(ref config);

        peerConnection.OnTrack = (RTCTrackEvent e) =>
        {
            if (e.Track.Kind == TrackKind.Video && e.Track is VideoStreamTrack videoTrack)
            {
                if (remoteVideoTarget != null)
                    remoteVideoTarget.texture = videoTrack.Texture;
            }
        };

        peerConnection.OnIceCandidate = (candidate) =>
        {
            if (candidate.Candidate != null && !string.IsNullOrEmpty(socketClient.TeacherSocketId))
                socketClient.SendIceCandidate(socketClient.TeacherSocketId, SerializeIceCandidate(candidate));
        };

        RTCSetRemoteDescriptionOperation setRemote = peerConnection.SetRemoteDescription(ref desc);
        yield return setRemote;
        if (setRemote.IsError) { Debug.LogError("[LiveClassWebRTC] SetRemoteDescription failed: " + setRemote.Error.message); yield break; }

        RTCAnswerOptions options = default;
        RTCCreateAnswerOperation createAnswer = peerConnection.CreateAnswer(ref options);
        yield return createAnswer;
        if (createAnswer.IsError) { Debug.LogError("[LiveClassWebRTC] CreateAnswer failed: " + createAnswer.Error.message); yield break; }

        RTCSetLocalDescriptionOperation setLocal = peerConnection.SetLocalDescription(ref createAnswer.Desc);
        yield return setLocal;
        if (setLocal.IsError) { Debug.LogError("[LiveClassWebRTC] SetLocalDescription failed: " + setLocal.Error.message); yield break; }

        answerCreated = true;
        socketClient.SendAnswer(teacherSocketId, SerializeSessionDescription(createAnswer.Desc));
    }

    private void HandleRemoteIceCandidate(string fromSocketId, string classId, string candidateJson)
    {
        if (peerConnection == null || !answerCreated) return;
        var init = ParseIceCandidate(candidateJson);
        if (init != null)
        {
            RTCAddIceCandidateOperation op = peerConnection.AddIceCandidate(ref init);
            op.MoveNext(); // Fire and forget; check op.IsError in production
        }
    }

    private void HandleLiveClassEnded(string classId)
    {
        ClosePeerConnection();
        if (remoteVideoTarget != null) remoteVideoTarget.texture = null;
    }

    private void ClosePeerConnection()
    {
        if (peerConnection != null)
        {
            peerConnection.Close();
            peerConnection.Dispose();
            peerConnection = null;
        }
        answerCreated = false;
    }

    private static RTCSessionDescription? ParseSessionDescription(string json)
    {
        try
        {
            var d = JsonUtility.FromJson<SdpJson>(json);
            if (string.IsNullOrEmpty(d.type) || string.IsNullOrEmpty(d.sdp)) return null;
            return new RTCSessionDescription { type = MapSdpType(d.type), sdp = d.sdp };
        }
        catch { return null; }
    }

    private static string SerializeSessionDescription(RTCSessionDescription desc)
    {
        return JsonUtility.ToJson(new SdpJson { type = desc.type.ToString().ToLower(), sdp = desc.sdp });
    }

    private static RTCIceCandidateInit? ParseIceCandidate(string json)
    {
        try
        {
            var d = JsonUtility.FromJson<IceCandidateJson>(json);
            return new RTCIceCandidateInit { candidate = d.candidate, sdpMid = d.sdpMid, sdpMLineIndex = d.sdpMLineIndex };
        }
        catch { return null; }
    }

    private static string SerializeIceCandidate(RTCIceCandidate c)
    {
        return JsonUtility.ToJson(new IceCandidateJson { candidate = c.Candidate, sdpMid = c.SdpMid, sdpMLineIndex = c.SdpMLineIndex });
    }

    private static RTCSdpType MapSdpType(string type)
    {
        if (type == "offer") return RTCSdpType.Offer;
        if (type == "answer") return RTCSdpType.Answer;
        return RTCSdpType.Offer;
    }

    [Serializable] private class SdpJson { public string type; public string sdp; }
    [Serializable] private class IceCandidateJson { public string candidate; public string sdpMid; public int sdpMLineIndex; }
}
