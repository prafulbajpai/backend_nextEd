using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Implements ILiveClassTransport using SocketIOUnity (free).
/// Install: https://github.com/itisnajim/SocketIOUnity or https://github.com/trongtindev/SocketIOUnity
/// Add the package, then uncomment the socket code below and remove the #if false.
/// </summary>
public class SocketIOUnityTransport : MonoBehaviour, ILiveClassTransport
{
    public event Action OnConnected;
    public event Action<string> OnError;
    public event Action OnDisconnected;

    private object socket; // Replace with: SocketIOUnity socket;
    private Dictionary<string, Action<string>> eventHandlers = new Dictionary<string, Action<string>>();

    public void Connect(string url, string token)
    {
        // Example with SocketIOUnity (uncomment when package is installed):
        //
        // var opts = new SocketIOOptions();
        // opts.Auth = new Dictionary<string, string> { { "token", token } };
        // opts.Transports = new List<string> { "websocket", "polling" };
        // socket = new SocketIOUnity(url, opts);
        // socket.Connect();
        // socket.OnUnityThread("connect", _ => OnConnected?.Invoke());
        // socket.OnUnityThread("connect_error", data => OnError?.Invoke(data.ToString()));
        // socket.OnUnityThread("disconnect", _ => OnDisconnected?.Invoke());
        // socket.OnUnityThread("errorMessage", data => { var j = data.GetValue(); InvokeHandler("errorMessage", j); });
        // socket.OnUnityThread("offer", data => { var j = data.GetValue(); InvokeHandler("offer", j); });
        // socket.OnUnityThread("iceCandidate", data => { var j = data.GetValue(); InvokeHandler("iceCandidate", j); });
        // socket.OnUnityThread("liveClassEnded", data => { var j = data.GetValue(); InvokeHandler("liveClassEnded", j); });

        Debug.LogWarning("[SocketIOUnityTransport] Replace this with your Socket.IO client. See script comments.");
        OnError?.Invoke("Socket.IO transport not implemented - add SocketIOUnity package and uncomment code.");
    }

    public void Emit(string eventName, object data)
    {
        // socket?.Emit(eventName, data);
        // Serialize data to JSON and emit. Example: socket.Emit(eventName, new JSONObject(JsonUtility.ToJson(data)));
    }

    public void On(string eventName, Action<string> callback)
    {
        eventHandlers[eventName] = callback;
    }

    private void InvokeHandler(string eventName, string json)
    {
        if (eventHandlers.TryGetValue(eventName, out var h)) h?.Invoke(json);
    }

    public void Disconnect()
    {
        // socket?.Disconnect();
        OnDisconnected?.Invoke();
    }
}
