import Web3 from "web3";

export async function getWeb3() {
  if (!window.ethereum) throw new Error("MetaMask not detected");
  const web3 = new Web3(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });
  return web3;
}
