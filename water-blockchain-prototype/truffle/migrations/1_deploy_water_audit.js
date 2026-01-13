const WaterAudit = artifacts.require("WaterAudit");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(WaterAudit, accounts[0]);
};
