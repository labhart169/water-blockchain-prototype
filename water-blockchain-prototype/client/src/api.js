const API_BASE = "http://localhost:4000";

export async function createOffchainEvent(payloadObj) {
  const res = await fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadObj)
  });
  if (!res.ok) throw new Error(`Off-chain create failed: ${await res.text()}`);
  return res.json(); // {id, uri, hash, canonical}
}

export async function getOffchainEvent(id) {
  const res = await fetch(`${API_BASE}/events/${id}`);
  if (!res.ok) throw new Error(`Off-chain get failed: ${await res.text()}`);
  return res.json();
}

export async function verifyOffchainEvent(id, onChainHash) {
  const res = await fetch(`${API_BASE}/verify/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ onChainHash })
  });
  if (!res.ok) throw new Error(`Off-chain verify failed: ${await res.text()}`);
  return res.json(); // {ok, computedHash, onChainHash}
}
