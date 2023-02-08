const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");

const masterChefJson = require("@sushiswap/core/artifacts/contracts/MasterChef.sol/MasterChef.json");
const sushiTokenJson = require("@sushiswap/core/artifacts/contracts/SushiToken.sol/SushiToken.json");
const wethJson = require("@uniswap/v2-periphery/build/WETH9.json");

const { ethers } = require("hardhat");

module.exports = async () => {
  [deployer] = await ethers.getSigners();

  return {
    SushiFactory: new ethers.ContractFactory(
      factoryJson.abi,
      factoryJson.bytecode,
      deployer
    ),
    SushiRouter: new ethers.ContractFactory(
      routerJson.abi,
      routerJson.bytecode,
      deployer
    ),
    SushiPair: new ethers.ContractFactory(
      pairJson.abi,
      pairJson.bytecode,
      deployer
    ),
    MasterChef: new ethers.ContractFactory(
      masterChefJson.abi,
      masterChefJson.bytecode,
      deployer
    ),

    // tokens
    SushiToken: new ethers.ContractFactory(
      sushiTokenJson.abi,
      sushiTokenJson.bytecode,
      deployer
    ),
    Weth9: new ethers.ContractFactory(
      wethJson.abi,
      wethJson.bytecode,
      deployer
    ),
  };
};
