import { parseEther, formatEther } from 'viem';
import hre from 'hardhat';
import { ethers, upgrades } from 'hardhat';

const DEFAULT_FEE: bigint = parseEther('0.001');

export async function deploy(): Promise<string> {
  const SuiaClub = await ethers.getContractFactory('SuiaClub');
  const club = await SuiaClub.deploy(DEFAULT_FEE);
  await club.waitForDeployment();
  const clubAddr = await club.getAddress();
  return clubAddr;
}
