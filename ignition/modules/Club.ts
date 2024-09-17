import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const default_fee: bigint = 1n;

const SuiaClubModule = buildModule("SuiaClubModule", (m) => {
  const createClubFee = m.getParameter("createClubFee", default_fee);

  const club = m.contract("SuiaClub", []);

  return { club };
});

export default SuiaClubModule;
