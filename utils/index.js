const { USER_LIQUIDITY_SUSHI, USER_LIQUIDITY_WETH } = require("./config");

module.exports = {
  // @ts-ignore:
  deposit: async function (overrides = {}) {
    const defaultParams = {
      // @ts-ignore:
      tokens: [this.sushi.address, this.weth.address],
      amounts: [USER_LIQUIDITY_SUSHI, USER_LIQUIDITY_WETH],
      amountAMin: USER_LIQUIDITY_SUSHI.mul(95).div(100), //min 95% of desired
      amountBMin: USER_LIQUIDITY_WETH.mul(95).div(100), //min 95% of desired
      pid: 0,
      value: 0,
      ...overrides,
    };

    // @ts-ignore:
    const tx = await this.wallet.populateTransaction.deposit(
      defaultParams.tokens,
      defaultParams.amounts,
      defaultParams.amountAMin,
      defaultParams.amountBMin,
      defaultParams.pid,
      { value: defaultParams.value }
    );
    return tx;
  },

  deploy: async (factory, params = []) => await factory.deploy(...params),
  balanceOf: async (token, owner) => await token.balanceOf(owner),
};
