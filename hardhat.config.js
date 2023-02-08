require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

const { DEPLOYER_PRIVATE_KEY, USER_PRIVATE_KEY, ROPSTEN_RPC } = process.env;

module.exports = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  solidity: {
    compilers: [
      { version: "0.8.4" },
      { version: "0.7.6" },
      { version: "0.6.12" },
      { version: "0.6.6" },
      { version: "0.5.0" },
    ],
  },
};
