import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const ONE_GWEI: bigint = parseEther("0.001");

const SuiaClubModule = buildModule("SuiaClubModule", (m) => {
  const createClubFee = m.getParameter("createClubFee", ONE_GWEI);

  const club = m.contract("SuiaClub", []);

  return { club };
});

export default SuiaClubModule;
