import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      // Local development network (in-memory)
      chainId: 31337
    },
    localhost: {
      // Local development network (persistent)
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    sepolia: {
      url: process.env.ETH_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.ETH_WALLET_PRIVATE_KEY ? [process.env.ETH_WALLET_PRIVATE_KEY] : [],
      chainId: 11155111
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};

export default config;
