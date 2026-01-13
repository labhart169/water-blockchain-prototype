const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const storagePath = path.join(__dirname, "storage", "events.json");

function readStore() {
  const raw = fs.readFileSync(storagePath, "utf-8");
  return JSON.parse(raw);
}

function writeStore(store) {
  fs.writeFileSync(storagePath, JSON.stringify(store, null, 2), "utf-8");
}

// Canonical stringify: stable ordering to ensure reproducible hash
function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function sha256Hex(str) {
  return "0x" + crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// Create off-chain event payload
app.post("/events", (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const store = readStore();
  const id = store.nextId++;

  // Canonical content for hashing
  const canonical = stableStringify(payload);
  const hash = sha256Hex(canonical);

  const record = {
    id,
    createdAt: new Date().toISOString(),
    canonical,
    hash,
    payload
  };

  store.events[String(id)] = record;
  writeStore(store);

  // URI that client will store on-chain
  const uri = `http://localhost:4000/events/${id}`;
  res.json({ id, uri, hash, canonical });
});

// Read payload
app.get("/events/:id", (req, res) => {
  const store = readStore();
  const rec = store.events[String(req.params.id)];
  if (!rec) return res.status(404).json({ error: "Not found" });
  res.json(rec);
});

// Verify integrity: compare stored hash to a provided on-chain hash
app.post("/verify/:id", (req, res) => {
  const { onChainHash } = req.body;
  if (!onChainHash || typeof onChainHash !== "string") {
    return res.status(400).json({ error: "onChainHash required" });
  }

  const store = readStore();
  const rec = store.events[String(req.params.id)];
  if (!rec) return res.status(404).json({ error: "Not found" });

  const computed = sha256Hex(rec.canonical);
  const ok = computed.toLowerCase() === onChainHash.toLowerCase();

  res.json({
    id: rec.id,
    ok,
    computedHash: computed,
    onChainHash
  });
});

app.listen(4000, () => {
  console.log("Off-chain server running on http://localhost:4000");
});
