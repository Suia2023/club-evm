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
  // add admin
  const [ownerAddr, adminAddr] = await ownerWalletClient.getAddresses();
  console.log(`ownerAddr: ${ownerAddr}`);
  console.log(`adminAddr: ${adminAddr}`);
  let isAdmin = await club.read.is_authorized_for_club([clubId, ownerAddr]);
  console.log(`isAdmin: ${isAdmin}`);
  const addAdminTx = await club.write.add_club_admin([clubId, ownerAddr]);
  await publicClient.waitForTransactionReceipt({ hash: addAdminTx });
  isAdmin = await club.read.is_authorized_for_club([clubId, ownerAddr]);
  assert(isAdmin, 'add admin failed');
  // get club admins
  const clubAdmins = await club.read.get_club_admins([clubId]);
  console.log('clubAdmins:', clubAdmins);
  assert(clubAdmins.length === 1, 'club admins length is not 1');
  assert(clubAdmins[0] === ownerAddr, 'club admins is not owner');
  // add one more admin
  const addAnotherAdminTx = await club.write.add_club_admin([clubId, adminAddr]);
  await publicClient.waitForTransactionReceipt({ hash: addAnotherAdminTx });
  const clubAdmins1 = await club.read.get_club_admins([clubId]);
  console.log('clubAdmins1:', clubAdmins1);
  assert(clubAdmins1.length === 2, 'club admins length is not 2');
  assert(clubAdmins1.includes(adminAddr), 'club admins does not include admin');
  // remove admin
  const removeAdminTx = await club.write.remove_club_admin([clubId, ownerAddr]);
  await publicClient.waitForTransactionReceipt({ hash: removeAdminTx });
  isAdmin = await club.read.is_authorized_for_club([clubId, ownerAddr]);
  assert(!isAdmin, 'remove admin failed');
  // update club name
  const newClubName = 'new club name';
  const updateNameTx = await club.write.update_club_name([clubId, newClubName]);
  await publicClient.waitForTransactionReceipt({ hash: updateNameTx });
  const newClubName1 = await club.read.get_club_name([clubId]);
  console.log('newClubName1:', newClubName1);
  assert(newClubName1 === newClubName, 'update club name failed');
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
  assert(clubMembers.length === 10, 'club members length is not 10');
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
  // get club name
  const clubName = await club.read.get_club_name([2n]);
  console.log('clubName:', clubName);
  // get club owner
  const clubOwner = await club.read.get_club_owner([2n]);
  console.log('clubOwner:', clubOwner);
  // get clubs with owner
  for (let i = 0n; i <= 5n; i++) {
    const info = await club.read.get_club_owner([i]);
    console.log(`club ${i} owner:`, info);
  }
  // get clubs by owner
  const ownerAddr = await wallets[1].account.address;
  console.log(`ownerAddr: ${ownerAddr}`);
  const ownerClubIds = await club.read.get_clubs_by_owner([ownerAddr]);
  console.log('ownerClubIds:', ownerClubIds);
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
  // await queries(clubAddr);
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
