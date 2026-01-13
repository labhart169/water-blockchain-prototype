import React, { useEffect, useMemo, useState } from "react";
import { getWeb3 } from "./web3";
import { createOffchainEvent, getOffchainEvent, verifyOffchainEvent } from "./api";
import WaterAuditArtifact from "./contracts/WaterAudit.json";
import "./styles.css";

function parseOffchainIdFromUri(uri) {
  // expects http://localhost:4000/events/<id>
  const m = uri.match(/\/events\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function eventTypeLabel(t) {
  const n = Number(t);
  if (n === 1) return "TelemetryAnchor";
  if (n === 2) return "Alarm";
  if (n === 3) return "ControlAction";
  if (n === 4) return "Maintenance";
  return `Unknown(${t})`;
}

export default function App() {
  const [status, setStatus] = useState("Booting...");
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [netId, setNetId] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractAddr, setContractAddr] = useState("");
  const [total, setTotal] = useState(0);

  // Form
  const [deviceId, setDeviceId] = useState("DEV-PS-003");
  const [eventType, setEventType] = useState(2);
  const [payloadText, setPayloadText] = useState(JSON.stringify({
    station: "PS-003",
    zone: "Zone_Nord",
    pressure_bar: 3.1,
    flow_m3h: 88,
    quality_ph: 7.1,
    alarm: "PRESSURE_DROP",
    note: "sudden drop detected"
  }, null, 2));

  // last anchored
  const [last, setLast] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [offchainRec, setOffchainRec] = useState(null);

  const canRun = useMemo(() => !!contract && accounts.length > 0, [contract, accounts]);

  useEffect(() => {
    (async () => {
      try {
        setStatus("Connecting MetaMask...");
        const w = await getWeb3();
        const acc = await w.eth.getAccounts();
        const nid = await w.eth.net.getId();

        setWeb3(w);
        setAccounts(acc);
        setNetId(nid);

        const deployed = WaterAuditArtifact.networks[nid];
        if (!deployed) {
          setStatus(`Contract not found on network ${nid}. Re-deploy and copy WaterAudit.json from truffle/build.`);
          return;
        }

        const c = new w.eth.Contract(WaterAuditArtifact.abi, deployed.address);
        setContract(c);
        setContractAddr(deployed.address);

        const t = await c.methods.totalEvents().call();
        setTotal(Number(t));
        setStatus("Ready");
      } catch (e) {
        setStatus(e.message || String(e));
      }
    })();
  }, []);

  async function refreshTotal() {
    const t = await contract.methods.totalEvents().call();
    setTotal(Number(t));
  }

  async function loadLastEvent() {
    setVerifyResult(null);
    setOffchainRec(null);

    const t = await contract.methods.totalEvents().call();
    const n = Number(t);
    setTotal(n);
    if (n === 0) {
      setLast(null);
      return;
    }
    const id = await contract.methods.getEventIdAt(n - 1).call();
    const ev = await contract.methods.getEvent(id).call();
    setLast(ev);
  }

  async function anchorFlow() {
    try {
      if (!canRun) return;

      setVerifyResult(null);
      setOffchainRec(null);
      setStatus("1/3 Parse payload...");

      let payloadObj;
      try {
        payloadObj = JSON.parse(payloadText);
      } catch {
        throw new Error("Payload is not valid JSON");
      }

      setStatus("2/3 Store off-chain & compute SHA-256...");
      const off = await createOffchainEvent(payloadObj);
      // off.hash is SHA-256(canonical JSON) produced by server
      // store on-chain bytes32: must be 32 bytes => server returns 0x + 64 hex OK
      const ts = Math.floor(Date.now() / 1000);

      setStatus("3/3 Send blockchain transaction (MetaMask)...");
      await contract.methods
        .anchorEvent(deviceId, Number(eventType), ts, off.hash, off.uri)
        .send({ from: accounts[0] });

      setStatus("Anchored successfully");
      await refreshTotal();
      await loadLastEvent();
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function verifyLastEvent() {
    try {
      if (!last) throw new Error("No last event loaded");

      const onChainHash = last.payloadHash;
      const uri = last.uri;
      const offchainId = parseOffchainIdFromUri(uri);
      if (!offchainId) throw new Error("URI does not match off-chain server format");

      setStatus("Fetching off-chain payload...");
      const rec = await getOffchainEvent(offchainId);
      setOffchainRec(rec);

      setStatus("Verifying integrity (server recompute SHA-256)...");
      const v = await verifyOffchainEvent(offchainId, onChainHash);
      setVerifyResult(v);

      setStatus(v.ok ? "Verification OK" : "Verification FAILED");
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Smart Water Infrastructure — Blockchain Audit Prototype</h2>
        <div><b>Status:</b> {status}</div>
        <div><b>Network ID:</b> {netId ?? "-"}</div>
        <div><b>Account:</b> {accounts[0] ?? "-"}</div>
        <div><b>Contract:</b> {contractAddr || "-"}</div>
        <div><b>Total anchored events:</b> {total}</div>
        <p style={{ color: "#666" }}>
          If you see "requires OPERATOR_ROLE", assign OPERATOR_ROLE to your MetaMask account via Truffle console.
        </p>
      </div>

      <div className="card">
        <h3>1) Anchor a Water Event (Off-chain → On-chain)</h3>
        <div className="row">
          <label>
            Device ID
            <input value={deviceId} onChange={e => setDeviceId(e.target.value)} />
          </label>
          <label>
            Event Type
            <select value={eventType} onChange={e => setEventType(Number(e.target.value))}>
              <option value={1}>1 — TelemetryAnchor</option>
              <option value={2}>2 — Alarm</option>
              <option value={3}>3 — ControlAction</option>
              <option value={4}>4 — Maintenance</option>
            </select>
          </label>

          <label style={{ gridColumn: "1 / span 2" }}>
            Payload JSON (stored off-chain; SHA-256 anchored on-chain)
            <textarea rows={10} value={payloadText} onChange={e => setPayloadText(e.target.value)} />
          </label>
        </div>

        <button onClick={anchorFlow} disabled={!canRun} style={{ marginTop: 12 }}>
          Store Off-chain + Anchor On-chain (MetaMask)
        </button>
      </div>

      <div className="card">
        <h3>2) Load & Verify Last Anchored Event</h3>
        <div className="row">
          <button onClick={loadLastEvent} disabled={!canRun}>Load Last On-chain Event</button>
          <button onClick={verifyLastEvent} disabled={!last}>Verify Integrity (Off-chain vs On-chain)</button>
        </div>

        {last && (
          <>
            <h4>Last On-chain Event</h4>
            <div className="badge">{eventTypeLabel(last.eventType)}</div>
            <pre>{JSON.stringify(last, null, 2)}</pre>
          </>
        )}

        {verifyResult && (
          <>
            <h4>Verification Result</h4>
            <div className={`badge ${verifyResult.ok ? "ok" : "ko"}`}>
              {verifyResult.ok ? "OK — Payload matches on-chain hash" : "FAILED — Payload differs"}
            </div>
            <pre>{JSON.stringify(verifyResult, null, 2)}</pre>
          </>
        )}

        {offchainRec && (
          <>
            <h4>Off-chain Stored Record</h4>
            <pre>{JSON.stringify(offchainRec, null, 2)}</pre>
          </>
        )}
      </div>

      <div className="card">
        <h3>Operational Roles (Practical)</h3>
        <ul>
          <li><b>Operator:</b> anchors alarms/control/maintenance events (requires OPERATOR_ROLE)</li>
          <li><b>Regulator:</b> reads audit trail and verifies integrity (read-only)</li>
          <li><b>Hybrid storage:</b> bulk telemetry stays off-chain; blockchain stores hash+metadata</li>
        </ul>
      </div>
    </div>
  );
}
