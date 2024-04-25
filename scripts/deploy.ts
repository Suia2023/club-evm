import hre from 'hardhat';
import { deploy } from './utils';

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  console.log(`deployer: ${await deployer.account.address}`);
  // deploy
  const clubAddr = await deploy();
  console.log(`clubAddr: ${clubAddr}`);
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
