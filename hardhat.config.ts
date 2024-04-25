import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import '@openzeppelin/hardhat-upgrades';
import * as dotenv from 'dotenv';
dotenv.config();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    base: {
      url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY!],
    },
    base_sepolia: {
      url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY!, USER_PRIVATE_KEY!],
    },
  },
};

export default config;
