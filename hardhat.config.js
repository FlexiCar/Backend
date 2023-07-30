/** @type import('hardhat/config').HardhatUserConfig */
require("dotenv").config()
require("@nomiclabs/hardhat-etherscan")
require("@nomiclabs/hardhat-waffle")
require("solidity-coverage")
require("hardhat-deploy")
//require("hardhat-contract-sizer")
require("solhint")
module.exports = {
  solidity: "0.8.19",
  defaultNetwork: "hardhat",
  networks:{
  },
  namedAccounts:{
    deployer:{
      default:0,
      4:0,
    },
    player:{
      default:1,
    } 
  },

};
