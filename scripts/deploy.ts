import { parseEther, formatEther } from 'viem';
import hre from 'hardhat';
import { ethers, upgrades } from 'hardhat';

const ONE_GWEI: bigint = parseEther('0.001');

export async function deploy(): Promise<string> {
  const SuiaClub = await ethers.getContractFactory('SuiaClub');
  const club = await upgrades.deployProxy(SuiaClub, [ONE_GWEI]);
  await club.waitForDeployment();
  const clubAddr = await club.getAddress();
  return clubAddr;
}
