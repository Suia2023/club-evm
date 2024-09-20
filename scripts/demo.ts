import {
  parseEther,
  formatEther,
  createPublicClient,
  getContract,
  decodeEventLog,
  parseEventLogs,
  bytesToHex,
  fromHex,
  Address,
  parseAbiItem,
} from 'viem';
import hre from 'hardhat';
import { deploy } from './utils';
import { MessageEncoder, MessageType } from './message_encoder';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const messageEncoder = new MessageEncoder();

async function interact(clubAddr: string) {
  // init clients
  const publicClient = await hre.viem.getPublicClient();
  const wallets = await hre.viem.getWalletClients();
  console.log(`wallets: ${wallets.length}`);
  const ownerWalletClient = wallets[0];
  const userWalletClient = wallets[1];
  // init contracts
  const clubArtifact = await hre.artifacts.readArtifact('SuiaClub');
  const abi = clubArtifact.abi;
  const club = getContract({
    address: clubAddr as any,
    abi,
    client: {
      public: publicClient,
      wallet: userWalletClient,
    },
  });
  // interact with club
  let fee = await club.read.fee();
  console.log(`fee: ${formatEther(fee)}`);
  // write new fee
  const clubOwner = getContract({
    address: clubAddr as any,
    abi,
    client: {
      public: publicClient,
      wallet: ownerWalletClient,
    },
  });
  fee = fee * 2n;
  await clubOwner.write.set_fee([fee]);
  fee = await club.read.fee();
  console.log(`new fee: ${formatEther(fee)}`);
  // create club
  const createTx = await club.write.create_club(['club name'], {
    value: fee,
  });
  console.log(`createClubTx: ${createTx}`);
  const createClubReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
  console.log(createClubReceipt.logs);
  const createClubEvents = parseEventLogs({
    abi,
    logs: createClubReceipt.logs,
  });
  console.log('createClubEvents:', createClubEvents);
  // test withdraw fee
  let contractBalance = await publicClient.getBalance({ address: clubAddr as Address });
  console.log(`contractBalance: ${formatEther(contractBalance)}`);
  const withdrawFeeTx = await clubOwner.write.withdraw();
  await publicClient.waitForTransactionReceipt({ hash: withdrawFeeTx });
  contractBalance = await publicClient.getBalance({ address: clubAddr as Address });
  console.log(`contractBalance: ${formatEther(contractBalance)}`);
  // get club info
  const clubId = createClubEvents[0].args.id;
  // update club name
  const newClubName = 'new club name';
  const updateNameTx = await club.write.update_club_name([clubId, newClubName]);
  await publicClient.waitForTransactionReceipt({ hash: updateNameTx });
  const newClubView = await club.read.get_club_view([clubId]);
  console.log('newClubView:', newClubView);
  assert(newClubView.name === newClubName, 'update club name failed');
  // join for 10 times with different users
  console.log('joining club...');
  for (let i = 0; i < 10; i++) {
    const walletClient = wallets[i + 2];
    console.log(`joining club with ${await walletClient.account.address}`);
    const joinTx = await walletClient.writeContract({
      address: clubAddr as any,
      abi,
      functionName: 'join_club',
      args: [clubId],
    });
    console.log(`joinTx: ${joinTx}`);
    await publicClient.waitForTransactionReceipt({ hash: joinTx });
  }
  // get club members
  const clubMembers = await club.read.get_club_members([clubId]);
  console.log('clubMembers:', clubMembers);
  assert(clubMembers.length === 11, 'club members length is not 11');
  // get club members by page
  const offset = 1n;
  const limit = 8n;
  const clubMembers1 = await club.read.get_club_members_paged([clubId, offset, limit]);
  console.log('clubMembers1:', clubMembers1);
  assert(clubMembers1.length === Number(limit), 'club members length is not 8');
  assert(
    clubMembers.slice(Number(offset), Number(offset) + Number(limit)).every((member) => clubMembers1.includes(member)),
    'club members is not equal',
  );
}

async function queries(clubAddr: string) {
  // init club
  const publicClient = await hre.viem.getPublicClient();
  const clubArtifact = await hre.artifacts.readArtifact('SuiaClub');
  const abi = clubArtifact.abi;
  const club = getContract({
    address: clubAddr as any,
    abi,
    client: {
      public: publicClient,
    },
  });
  // create more clubs by different users
  let wallets = await hre.viem.getWalletClients();
  wallets = wallets.slice(0, 5);
  for (let wallet of wallets) {
    console.log(`wallet: ${await wallet.account.address}`);
    const clubOwner = getContract({
      address: clubAddr as any,
      abi,
      client: {
        public: publicClient,
        wallet,
      },
    });
    await clubOwner.write.create_club([`club name ${await wallet.account.address}`], {
      value: await club.read.fee(),
    });
  }
  // get club count
  const clubCount = await club.read.club_count();
  console.log(`clubCount: ${clubCount}`);
  // get club views
  const clubView = await club.read.get_club_view([2n]);
  console.log('clubView:', clubView);
  // get club views by ids
  const clubIds = [2n, 3n, 4n];
  const clubViews = await club.read.get_club_view_by_ids([clubIds]);
  console.log('clubViews:', clubViews);
  // get joined club ids
  const user = wallets[0];
  const userAddr = await user.account.address;
  let joinedClubIds = await club.read.get_joined_club_ids([userAddr]);
  console.log('joinedClubIds:', joinedClubIds);
  // make user join clubs
  let joinTx: `0x${string}` | undefined;
  for (let i = 0n; i < clubCount; i++) {
    joinTx = await user.writeContract({
      address: clubAddr as any,
      abi,
      functionName: 'join_club',
      args: [i],
    });
    console.log(`joinTx: ${joinTx}`);
  }
  await publicClient.waitForTransactionReceipt({ hash: joinTx as any });
  // get joined club ids again
  joinedClubIds = await club.read.get_joined_club_ids([userAddr]);
  console.log('joinedClubIds:', joinedClubIds);
}

async function main() {
  // deploy
  const clubAddr = await deploy();
  console.log(`clubAddr: ${clubAddr}`);
  // interact
  const [deployer, user] = await hre.viem.getWalletClients();
  console.log(`deployer: ${await deployer.account.address}`);
  console.log(`user: ${await user.account.address}`);
  await interact(clubAddr);
  await queries(clubAddr);
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
