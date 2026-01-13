const WaterAudit = artifacts.require("WaterAudit");

contract("WaterAudit", (accounts) => {
  const admin = accounts[0];
  const operator = accounts[1];

  it("should register device and anchor event", async () => {
    const c = await WaterAudit.deployed();

    const OP = await c.OPERATOR_ROLE();
    await c.grantRole(OP, operator, { from: admin });

    await c.registerDevice("DEV-PS-003", "Station_Pompage_3", "Zone_Nord", { from: admin });

    const payloadHash = web3.utils.padRight("0x1234", 66); // dummy bytes32
    const ts = Math.floor(Date.now() / 1000);

    const tx = await c.anchorEvent("DEV-PS-003", 2, ts, payloadHash, "offchain://x", { from: operator });
    assert(tx.logs.length > 0);

    const total = await c.totalEvents();
    assert.equal(total.toNumber(), 1);

    const id0 = await c.getEventIdAt(0);
    const ev = await c.getEvent(id0);
    assert.equal(ev.deviceId, "DEV-PS-003");
    assert.equal(ev.eventType.toNumber(), 2);
  });
});
