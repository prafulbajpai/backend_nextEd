using System;
using UnityEngine;

/// <summary>
/// Socket.IO client for Live Class signaling.
/// Connect → JoinLiveClass → receive offer/ICE, send answer/ICE.
/// Implement ILiveClassTransport (e.g. with SocketIOUnity) and assign to transport.
/// </summary>
public class LiveClassSocketClient : MonoBehaviour
{
    [Header("Connection")]
    public string serverUrl = "http://localhost:5000";
    public string jwtToken = "";

    [Header("State")]
    [SerializeField] private bool isConnected;
    [SerializeField] private string currentClassId;
    [SerializeField] private string teacherSocketId;

    /// <summary>Assign a transport (e.g. SocketIOUnityTransport). If null, Connect() will log an error.</summary>
    public ILiveClassTransport transport;

    public event Action OnConnected;
    public event Action<string> OnError;
    public event Action<string, string, string> OnOffer;       // teacherSocketId, classId, sdpJson
    public event Action<string, string, string> OnIceCandidate; // fromSocketId, classId, candidateJson
    public event Action<string> OnLiveClassEnded;
    public event Action OnDisconnected;

    public bool IsConnected => isConnected;
    public string TeacherSocketId => teacherSocketId;
    public string CurrentClassId => currentClassId;

    public void Connect()
    {
        if (transport == null)
        {
            OnError?.Invoke("No transport assigned. Add a component that implements ILiveClassTransport (e.g. SocketIOUnityTransport).");
            return;
        }
        if (string.IsNullOrEmpty(jwtToken))
        {
            OnError?.Invoke("JWT token is empty");
            return;
        }

        transport.OnConnected -= HandleConnected;
        transport.OnConnected += HandleConnected;
        transport.OnError -= HandleError;
        transport.OnError += HandleError;
        transport.OnDisconnected -= HandleDisconnected;
        transport.OnDisconnected += HandleDisconnected;
        transport.On("errorMessage", HandleErrorMessage);
        transport.On("offer", HandleOffer);
        transport.On("iceCandidate", HandleIceCandidate);
        transport.On("liveClassEnded", HandleLiveClassEnded);

        transport.Connect(serverUrl.TrimEnd('/'), jwtToken);
    }

    private void HandleConnected() { isConnected = true; OnConnected?.Invoke(); }
    private void HandleError(string msg) { OnError?.Invoke(msg); }
    private void HandleDisconnected() { isConnected = false; teacherSocketId = null; OnDisconnected?.Invoke(); }

    private void HandleErrorMessage(string json)
    {
        var d = JsonUtility.FromJson<MessageData>(json);
        if (!string.IsNullOrEmpty(d.message)) OnError?.Invoke(d.message);
    }

    private void HandleOffer(string json)
    {
        var d = JsonUtility.FromJson<OfferData>(json);
        if (string.IsNullOrEmpty(d.fromSocketId) || d.sdp == null) return;
        teacherSocketId = d.fromSocketId;
        OnOffer?.Invoke(d.fromSocketId, d.classId ?? "", JsonUtility.ToJson(d.sdp));
    }

    private void HandleIceCandidate(string json)
    {
        var d = JsonUtility.FromJson<IceCandidateData>(json);
        if (d.candidate == null) return;
        OnIceCandidate?.Invoke(d.fromSocketId ?? "", d.classId ?? "", JsonUtility.ToJson(d.candidate));
    }

    private void HandleLiveClassEnded(string json)
    {
        var d = JsonUtility.FromJson<ClassIdData>(json);
        OnLiveClassEnded?.Invoke(d.classId ?? "");
    }

    public void JoinLiveClass(string classId)
    {
        if (!isConnected || transport == null) { OnError?.Invoke("Not connected"); return; }
        currentClassId = classId;
        transport.Emit("joinLiveClass", new ClassIdData { classId = classId });
    }

    public void SendAnswer(string toSocketId, string sdpJson)
    {
        if (!isConnected || transport == null) return;
        var sdpObj = JsonUtility.FromJson<SdpDesc>(sdpJson);
        transport.Emit("answer", new AnswerEmit { classId = currentClassId, toSocketId = toSocketId, sdp = sdpObj });
    }

    public void SendIceCandidate(string toSocketId, string candidateJson)
    {
        if (!isConnected || transport == null) return;
        var c = JsonUtility.FromJson<CandidateDesc>(candidateJson);
        transport.Emit("iceCandidate", new IceEmit { classId = currentClassId, toSocketId = toSocketId, candidate = c });
    }

    public void Disconnect()
    {
        transport?.Disconnect();
        isConnected = false;
        currentClassId = null;
        teacherSocketId = null;
        OnDisconnected?.Invoke();
    }

    private void OnDestroy() { Disconnect(); }

    [Serializable] private class MessageData { public string message; }
    [Serializable] private class SdpDesc { public string type; public string sdp; }
    [Serializable] private class OfferData { public string fromSocketId; public string classId; public SdpDesc sdp; }
    [Serializable] private class CandidateDesc { public string candidate; public string sdpMid; public int sdpMLineIndex; }
    [Serializable] private class IceCandidateData { public string fromSocketId; public string classId; public CandidateDesc candidate; }
    [Serializable] private class ClassIdData { public string classId; }
    [Serializable] private class AnswerEmit { public string classId; public string toSocketId; public SdpDesc sdp; }
    [Serializable] private class IceEmit { public string classId; public string toSocketId; public CandidateDesc candidate; }
}

/// <summary>Implement this with your Socket.IO client (e.g. SocketIOUnity).</summary>
public interface ILiveClassTransport
{
    void Connect(string url, string token);
    void Emit(string eventName, object data);
    void On(string eventName, Action<string> callback);
    void Disconnect();
    event Action OnConnected;
    event Action<string> OnError;
    event Action OnDisconnected;
}
