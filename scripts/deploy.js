const { ethers } = require("hardhat");
const { deploy } = require("../utils");
const {
  UNISWAP_INITIAL_TOKEN_RESERVE,
  USER_INITIAL_TOKEN_BALANCE,
} = require("../utils/config");
const getFactories = require("../utils/factories");

const printContractAddress = (contract, name) =>
  console.log(`${name} contract deployed at address: ${contract.address}`);

async function main() {
  console.log("Running deploy.js...");
  const [deployer, user] = await ethers.getSigners();
  
  // We get the contracts to deploy
  const { SushiFactory, SushiRouter, MasterChef, SushiToken, Weth9 } =
  await getFactories();

  // SushiWallet Factory
  const SushiWallet = await ethers.getContractFactory("SushiWallet", user);

  // Deploy factory
  const factory = await deploy(SushiFactory, [ethers.constants.AddressZero]);
  printContractAddress(factory, "Factory");
  
  // Deploy tokens
  const weth = await deploy(Weth9);
  printContractAddress(weth, "WETH");
  
  const sushi = await deploy(SushiToken);
  printContractAddress(sushi, "SUSHI");
  
  // Deploy Router
  const router = await deploy(SushiRouter, [factory.address, weth.address]);
  printContractAddress(router, "Router");

  // Deploy MasterChef
  const chef = await deploy(MasterChef, [
    sushi.address,
    deployer.address,
    ethers.utils.parseEther("10"),
    0,
    1000,
  ]);
  printContractAddress(chef, "MasterChef");

  // Deploy wallet
  const wallet = await deploy(SushiWallet, [
    router.address,
    chef.address,
    weth.address,
  ]);
  printContractAddress(wallet, "Sushi Wallet");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
