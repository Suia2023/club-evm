import {
  parseEther,
  formatEther,
  createPublicClient,
  getContract,
  decodeEventLog,
  parseEventLogs,
  bytesToHex,
  fromHex, Address,
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
  const [ownerWalletClient, userWalletClient] = await hre.viem.getWalletClients();
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
  const createTx = await club.write.create_club(
    [
      'club name',
      'club logo',
      'club desc with 中文 and 😁',
      'announcement',
      'erc20:0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      1000000n,
      'default channel name',
    ],
    {
      value: fee,
    },
  );
  console.log(`createClubTx: ${createTx}`);
  const createClubReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
  console.log(createClubReceipt.logs);
  const createClubEvents = parseEventLogs({
    abi,
    logs: createClubReceipt.logs,
  });
  console.log('createClubEvents:', createClubEvents);
  // test withdraw fee
  let contractBalance = await publicClient.getBalance({ address: clubAddr as Address});
  console.log(`contractBalance: ${formatEther(contractBalance)}`);
  const withdrawFeeTx = await clubOwner.write.withdraw();
  await publicClient.waitForTransactionReceipt({ hash: withdrawFeeTx });
  contractBalance = await publicClient.getBalance({ address: clubAddr as Address});
  console.log(`contractBalance: ${formatEther(contractBalance)}`);
  // get club info
  const clubId = createClubEvents[0].args.id;
  const channelIndex = createClubEvents[1].args.channel_index;
  console.log(`clubId: ${clubId}, channelIndex: ${channelIndex}`);
  const clubInfo = await club.read.clubs([clubId]);
  console.log('clubInfo:', clubInfo);
  // add admin
  const [ownerAddr] = await ownerWalletClient.getAddresses();
  console.log(`ownerAddr: ${ownerAddr}`);
  let isAdmin = await club.read.is_authorized_for_club([clubId, ownerAddr]);
  console.log(`isAdmin: ${isAdmin}`);
  const addAdminTx = await club.write.add_club_admin([clubId, ownerAddr]);
  await publicClient.waitForTransactionReceipt({ hash: addAdminTx });
  isAdmin = await club.read.is_authorized_for_club([clubId, ownerAddr]);
  assert(isAdmin, 'add admin failed');
  // remove admin
  const removeAdminTx = await club.write.remove_club_admin([clubId, ownerAddr]);
  await publicClient.waitForTransactionReceipt({ hash: removeAdminTx });
  isAdmin = await club.read.is_authorized_for_club([clubId, ownerAddr]);
  assert(!isAdmin, 'remove admin failed');
  // update club name
  const newClubName = 'new club name';
  const updateNameTx = await club.write.update_club_name([clubId, newClubName]);
  await publicClient.waitForTransactionReceipt({ hash: updateNameTx });
  const newClubInfo = await club.read.clubs([clubId]);
  console.log('newClubInfo:', newClubInfo);
  assert(newClubInfo[2] === newClubName, 'update club name failed');
  // update club desc
  const newClubDesc = 'new club desc';
  const updateDescTx = await club.write.update_club_description([clubId, newClubDesc]);
  await publicClient.waitForTransactionReceipt({ hash: updateDescTx });
  const newClubInfo1 = await club.read.clubs([clubId]);
  console.log('newClubInfo1:', newClubInfo1);
  assert(newClubInfo1[3] === newClubDesc, 'update club desc failed');
  // update club logo
  const newClubLogo = 'new club logo';
  const updateLogoTx = await club.write.update_club_logo([clubId, newClubLogo]);
  await publicClient.waitForTransactionReceipt({ hash: updateLogoTx });
  const newClubInfo2 = await club.read.clubs([clubId]);
  console.log('newClubInfo2:', newClubInfo2);
  assert(newClubInfo2[4] === newClubLogo, 'update club logo failed');
  // update club announcement
  const newAnnouncement = 'new announcement';
  const updateAnnouncementTx = await club.write.update_club_announcement([clubId, newAnnouncement]);
  await publicClient.waitForTransactionReceipt({ hash: updateAnnouncementTx });
  const newClubInfo3 = await club.read.clubs([clubId]);
  console.log('newClubInfo3:', newClubInfo3);
  assert(newClubInfo3[7] === newAnnouncement, 'update club announcement failed');
  // update club threshold
  const newThreshold = 2000000n;
  const thresholdType = newClubInfo3[5];
  const updateThresholdTx = await club.write.update_club_threshold([clubId, thresholdType, newThreshold]);
  await publicClient.waitForTransactionReceipt({ hash: updateThresholdTx });
  const newClubInfo4 = await club.read.clubs([clubId]);
  console.log('newClubInfo4:', newClubInfo4);
  assert(newClubInfo4[6] === newThreshold, 'update club threshold failed');
  // add channel
  const currentChannelCount = newClubInfo4[8];
  const newChannelName = 'new channel name';
  const addChannelTx = await club.write.add_club_channel([clubId, newChannelName]);
  await publicClient.waitForTransactionReceipt({ hash: addChannelTx });
  const newClubInfo5 = await club.read.clubs([clubId]);
  console.log('newClubInfo5:', newClubInfo5);
  assert(newClubInfo5[8] === currentChannelCount + 1n, 'add channel failed');
  // get channel info
  const channelInfo = await club.read.channels([clubId, 0n]);
  console.log('channelInfo:', channelInfo);
  // update channel name
  const newChannelName1 = 'new channel name1';
  const updateChannelNameTx = await club.write.update_club_channel_name([clubId, 0n, newChannelName1]);
  await publicClient.waitForTransactionReceipt({ hash: updateChannelNameTx });
  const newChannelInfo = await club.read.channels([clubId, 0n]);
  console.log('newChannelInfo:', newChannelInfo);
  assert(newChannelInfo[0] === newChannelName1, 'update channel name failed');
  // delete club channel
  const deleteChannelTx = await club.write.delete_club_channel([clubId, 0n]);
  await publicClient.waitForTransactionReceipt({ hash: deleteChannelTx });
  const newChannelInfo1 = await club.read.channels([clubId, 0n]);
  console.log('newChannelInfo1:', newChannelInfo1);
  assert(newChannelInfo1[1], 'delete channel failed');
  // new message
  const message = 'hello world';
  const encodedMessage = messageEncoder.encode(message, MessageType.RAW);
  const encodedMessageHex = bytesToHex(encodedMessage);
  // const newMessageTx = await club.write.new_message([clubId, 1n, encodedMessageHex]);
  // const newMessageTxReceipt = await publicClient.waitForTransactionReceipt({ hash: newMessageTx });
  // const newMessageEvents = parseEventLogs({
  //   abi,
  //   logs: newMessageTxReceipt.logs,
  // });
  // console.log('newMessageEvents:', newMessageEvents);
  // // new 100 messages
  // const txns = [];
  // for (let i = 0; i < 100; i++) {
  //   const message = `message ${i}`;
  //   const encodedMessage = messageEncoder.encode(message, MessageType.XOR);
  //   const encodedMessageHex = bytesToHex(encodedMessage);
  //   const newMessageTx = await club.write.new_message([clubId, 1n, encodedMessageHex]);
  //   txns.push(newMessageTx);
  // }
  // await Promise.all(txns.map((tx) => publicClient.waitForTransactionReceipt({ hash: tx })));
  // // query messages
  // const [messages, total_num] = await club.read.get_club_channel_messages([clubId, 1n, -10n, 10n]);
  // console.log('total_num:', total_num);
  // console.log('messages:', messages);
  // console.log(
  //   'decodedMessages:',
  //   messages.map((m: any) => messageEncoder.decode(Uint8Array.from(Buffer.from(m.content.slice(2), 'hex')))),
  // );
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
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
