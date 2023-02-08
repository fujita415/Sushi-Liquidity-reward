const { ethers } = require("hardhat");

exports.UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther("10000");
exports.UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther("100");
exports.USER_LIQUIDITY_WETH = ethers.utils.parseEther("1");
exports.USER_LIQUIDITY_SUSHI = ethers.utils.parseEther("100");
exports.USER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther("1000");
exports.UNISWAP_INITIAL_WETH_RESERVE_ROPSTEN = ethers.utils.parseEther("0.25");
