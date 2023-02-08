const { ethers } = require("hardhat");
const { expect } = require("chai");
const getFactories = require("../utils/factories");
const {
  UNISWAP_INITIAL_TOKEN_RESERVE,
  USER_INITIAL_TOKEN_BALANCE,
  UNISWAP_INITIAL_WETH_RESERVE,
  USER_LIQUIDITY_SUSHI,
  USER_LIQUIDITY_WETH,
} = require("../utils/config");
const { deploy, deposit, balanceOf } = require("../utils");

describe("[Sushi Liquidity mining Wallet]", function () {
  let deployer, user;

  before(async function () {
    [deployer, user] = await ethers.getSigners();
    const {
      SushiFactory,
      Weth9,
      SushiToken,
      SushiRouter,
      SushiPair,
      MasterChef,
    } = await getFactories();

    // SushiWallet Factory
    this.SushiWallet = await ethers.getContractFactory("SushiSwapWallet", user);

    this.factory = await deploy(SushiFactory, [ethers.constants.AddressZero]);

    // Deploy tokens
    this.weth = await deploy(Weth9);
    this.sushi = await deploy(SushiToken);

    // Mint SUSHI
    await this.sushi.mint(deployer.address, UNISWAP_INITIAL_TOKEN_RESERVE);
    await this.sushi.mint(user.address, USER_INITIAL_TOKEN_BALANCE);

    this.router = await deploy(SushiRouter, [
      this.factory.address,
      this.weth.address,
    ]);

    // Create Uniswap pair against WETH and add liquidity
    await this.sushi.approve(
      this.router.address,
      UNISWAP_INITIAL_TOKEN_RESERVE
    );

    await this.router.addLiquidityETH(
      this.sushi.address,
      UNISWAP_INITIAL_TOKEN_RESERVE, // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      deployer.address, // to
      (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
      { value: UNISWAP_INITIAL_WETH_RESERVE }
    );

    this.pair = await SushiPair.attach(
      await this.factory.getPair(this.sushi.address, this.weth.address)
    );
    expect(await balanceOf(this.pair, deployer.address)).to.be.gt("0");

    // Deploy MasterChef
    this.chef = await deploy(MasterChef, [
      this.sushi.address,
      deployer.address,
      ethers.utils.parseEther("10"),
      0,
      1000,
    ]);
    await this.chef.deployed();
    await this.sushi.transferOwnership(this.chef.address);
    expect(await this.sushi.owner()).to.be.eq(this.chef.address);

    await this.chef.add("100", this.pair.address, true);
  });

  describe("[Deployment]", function () {
    it("must set Router, MasterChef, Weth and Owner addresses", async function () {
      // Deploy wallet
      const router = this.router.address;
      const chef = this.chef.address;
      const weth = this.weth.address;

      const wallet = await deploy(this.SushiWallet, [router, chef, weth]);
      await wallet.deployed();

      expect(await wallet.router()).to.be.eq(router);
      expect(await wallet.chef()).to.be.eq(chef);
      expect(await wallet.WETH()).to.be.eq(weth);

      // Check that deployer became owner
      expect(await wallet.owner()).to.be.eq(user.address);
    });
  });

  describe("[Deposit]", function () {
    beforeEach(async function () {
      // Deploy wallet
      this.wallet = await deploy(this.SushiWallet, [
        this.router.address,
        this.chef.address,
        this.weth.address,
      ]);
      await this.wallet.deployed();

      await this.weth.connect(user).deposit({ value: USER_LIQUIDITY_WETH });
    });

    it("should Add liquidity and stake LPs in a single transaction", async function () {
      await this.weth
        .connect(user)
        .approve(this.wallet.address, USER_LIQUIDITY_WETH);
      await this.sushi
        .connect(user)
        .approve(this.wallet.address, USER_LIQUIDITY_SUSHI);

      const pendingSushiBefore = await this.wallet.pending(0);
      const sushiBalBefore = await balanceOf(this.sushi, user.address);
      const wethBalBefore = await balanceOf(this.weth, user.address);

      const tx = await deposit.call(this);
      await user.sendTransaction(tx);

      // Check that user has less tokens
      expect(await balanceOf(this.sushi, user.address)).to.be.eq(
        sushiBalBefore.sub(USER_LIQUIDITY_SUSHI)
      );
      expect(await balanceOf(this.weth, user.address)).to.be.eq(
        wethBalBefore.sub(USER_LIQUIDITY_WETH)
      );

      // Ensure LPs are staked in the Chef contract
      const staked = await this.wallet.staked(0);
      expect(staked).to.be.gt("0");
      expect(await balanceOf(this.pair, this.chef.address)).to.be.gte(staked);
      expect(await balanceOf(this.pair, this.wallet.address)).to.be.eq("0");

      // Get pending sushi
      ethers.provider.send("evm_mine", []);
      expect(await this.wallet.pending(0)).to.be.gt(pendingSushiBefore);
    });
    it("reverts if user has no enough balance", async function () {
      await expect(
        user.sendTransaction(
          await deposit.call(this, {
            amounts: [USER_INITIAL_TOKEN_BALANCE, USER_LIQUIDITY_WETH],
          })
        )
      ).to.be.revertedWith("Insufficient token balance");
    });
    it("reverts if user hasn't approved enough tokens", async function () {
      await expect(
        user.sendTransaction(await deposit.call(this))
      ).to.be.revertedWith("SushiWallet: Insufficient allowance");
    });
  });
});
