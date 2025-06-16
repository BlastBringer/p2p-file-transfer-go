let socket;
let peerConnection;
let dataChannel;
let localPeerID;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function log(msg) {
  const logBox = document.getElementById("log");
  logBox.textContent += msg + "\n";
}

function register() {
  localPeerID = document.getElementById("peerID").value;
  socket = new WebSocket("ws://" + window.location.host + "/ws");

  socket.onopen = () => {
    log("🔌 WebSocket connected.");
    socket.send(JSON.stringify({ action: "register", peerID: localPeerID }));
  };

  socket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.action === "signal") {
      const data = msg.data;

      if (data.type === "offer") {
        log("📨 Offer received.");
        await createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendSignal(msg.from, peerConnection.localDescription);
      }

      else if (data.type === "answer") {
        log("📨 Answer received.");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      }

      else if (data.candidate) {
        log("📨 ICE candidate received.");
        try {
          await peerConnection.addIceCandidate(data);
        } catch (err) {
          console.error("❌ Error adding ICE: ", err);
        }
      }
    }
  };
}

function sendSignal(toID, data) {
  socket.send(JSON.stringify({
    action: "signal",
    to: toID,
    from: localPeerID,
    data: data
  }));
}

async function connectToPeer() {
  const targetID = document.getElementById("targetID").value;
  await createPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendSignal(targetID, offer);
}

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(document.getElementById("targetID").value, event.candidate);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    log("🔄 Connection state: " + peerConnection.connectionState);
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };

  dataChannel = peerConnection.createDataChannel("chat");
  setupDataChannel();
}

function setupDataChannel() {
let incomingFileMeta = null;
let incomingFileBuffer = [];
let incomingFileSize = 0;

dataChannel.onmessage = (event) => {
  if (typeof event.data === "string") {
    try {
      const json = JSON.parse(event.data);
      if (json.fileMeta) {
        incomingFileMeta = json.fileMeta;
        incomingFileBuffer = [];
        incomingFileSize = 0;
        log(`📥 Receiving file: ${incomingFileMeta.name} (${incomingFileMeta.size} bytes)`);
      }
    } catch (e) {
      log("📩 Text: " + event.data);
    }
  } else if (event.data instanceof ArrayBuffer) {
    incomingFileBuffer.push(event.data);
    incomingFileSize += event.data.byteLength;

    if (incomingFileMeta && incomingFileSize >= incomingFileMeta.size) {
      const blob = new Blob(incomingFileBuffer, { type: incomingFileMeta.type });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = incomingFileMeta.name;
      a.textContent = `⬇ Download ${incomingFileMeta.name}`;
      document.body.appendChild(a);

      log(`✅ File ${incomingFileMeta.name} received.`);

      // Reset
      incomingFileMeta = null;
      incomingFileBuffer = [];
      incomingFileSize = 0;
    }
  }
};

}

function sendFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const progressBar = document.getElementById("fileProgress");
  const progressText = document.getElementById("progressText");

  if (!file || !dataChannel || dataChannel.readyState !== "open") {
    log("⚠️ File or data channel unavailable.");
    return;
  }

  const chunkSize = 16 * 1024; // 16KB
  let offset = 0;

  // Send metadata first
  const meta = {
    fileMeta: {
      name: file.name,
      size: file.size,
      type: file.type,
    }
  };
  dataChannel.send(JSON.stringify(meta));

  log(`📤 Sending ${file.name} (${file.size} bytes)...`);

  const reader = new FileReader();

  reader.onload = (e) => {
    dataChannel.send(e.target.result);
    offset += e.target.result.byteLength;

    // Update progress bar
    const percent = Math.floor((offset / file.size) * 100);
    progressBar.value = percent;
    progressText.innerText = percent + "%";

    if (offset < file.size) {
      readSlice(offset);
    } else {
      log("✅ File sent successfully.");
      progressBar.value = 100;
      progressText.innerText = "100% ✅";
    }
  };

  reader.onerror = (e) => {
    log("❌ Read error: " + e);
  };

  function readSlice(o) {
    const slice = file.slice(o, o + chunkSize);
    setTimeout(() => reader.readAsArrayBuffer(slice), 10); // Add a short delay if needed
  }

  readSlice(0);
}
