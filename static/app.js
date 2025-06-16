let ws;
let peerID;

function log(msg) {
  const pre = document.getElementById("log");
  pre.textContent += msg + "\n";
}

document.getElementById("registerBtn").onclick = () => {
  peerID = document.getElementById("peerIDInput").value;
  ws = new WebSocket("ws://localhost:8080/ws");

  ws.onopen = () => {
    log("WebSocket connected");
    ws.send(JSON.stringify({ action: "register", peerID: peerID }));
    log(`Registered as ${peerID}`);
  };

  ws.onmessage = (event) => {
    log("Received: " + event.data);
  };
};

document.getElementById("signalBtn").onclick = () => {
  const targetID = document.getElementById("targetIDInput").value;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: "signal",
      to: targetID,
      from: peerID,
      data: `Hello from ${peerID}`
    }));
    log(`Signal sent to ${targetID}`);
  } else {
    log("WebSocket not connected.");
  }
};
