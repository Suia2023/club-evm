// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract SuiaClub is OwnableUpgradeable {
    // data structures
    struct Club {
        // id is the unique identifier of the club, start from 0
        uint id;
        address owner;
        bytes name;
        bytes description;
        bytes logo;
        // threshold_type is the type of asset required to join the club
        // e.g. "ETH", "ERC20:0x...", "ERC721:0x...", "ERC1155:0x..."
        bytes threshold_type;
        // threshold is the minimum number of assets required to join the club
        uint threshold;
        bytes announcement;
        uint channel_count;
        mapping(address => bool) admins;
    }

    struct Channel {
        bytes name;
        bool deleted;
    }

    struct Message {
        address sender;
        bytes content;
        uint timestamp;
        bool deleted;
    }

    // fee is the amount of native token required to create a club
    uint public fee;
    // clubs
    mapping(uint => Club) public clubs;
    // club_count is the number of clubs created
    uint public club_count;
    // channels, club_id => channel_index => channel
    mapping(uint => mapping(uint => Channel)) public channels;
    // messages
    mapping(uint => mapping(uint => Message[])) public messages;

    // events
    event ClubCreated(
        uint indexed id,
        address indexed owner,
        bytes indexed name,
        bytes description,
        bytes logo,
        bytes threshold_type,
        uint threshold
    );

    event ChannelCreated(
        uint indexed club_id,
        uint indexed channel_index,
        bytes indexed name
    );

    // functions

    function initialize(uint _fee) public initializer {
        OwnableUpgradeable.__Ownable_init(msg.sender);
        fee = _fee;
    }

    function create_club(
        bytes memory _name,
        bytes memory _logo,
        bytes memory _description,
        bytes memory _announcement,
        bytes memory _threshold_type,
        uint _threshold,
        bytes memory _default_channel_name
    ) payable public {
        require(msg.value >= fee, "Insufficient funds to create club");
        require(_name.length > 0, "invalid club name");
        require(_threshold_type.length > 0, "invalid threshold type");
        require(_default_channel_name.length > 0, "invalid default channel name");
        uint clubId = club_count;
        club_count++;
        // create club
        Club storage club = clubs[clubId];
        club.id = clubId;
        club.owner = msg.sender;
        club.name = _name;
        club.description = _description;
        club.logo = _logo;
        club.threshold_type = _threshold_type;
        club.threshold = _threshold;
        club.announcement = _announcement;
        club.channel_count = 1;
        // create default channel
        Channel storage default_channel = channels[clubId][0];
        default_channel.name = _default_channel_name;
        // emit ClubCreated event
        emit ClubCreated(
            clubId,
            msg.sender,
            _name,
            _description,
            _logo,
            _threshold_type,
            _threshold
        );
        // emit ChannelCreated event
        emit ChannelCreated(
            clubId,
            0,
            _default_channel_name
        );
    }

    function is_authorized_for_club(uint _club_id, address _user) public view returns (bool) {
        Club storage club = clubs[_club_id];
        return _user == club.owner || club.admins[_user];
    }

    function add_club_admin(uint _club_id, address _admin) public {
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.admins[_admin] = true;
    }

    function remove_club_admin(uint _club_id, address _admin) public {
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.admins[_admin] = false;
    }

    function update_club_name(uint _club_id, bytes memory _name) public {
        require(_name.length > 0, "invalid club name");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.name = _name;
    }

    function update_club_description(uint _club_id, bytes memory _description) public {
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.description = _description;
    }

    function update_club_logo(uint _club_id, bytes memory _logo) public {
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.logo = _logo;
    }

    function update_club_announcement(uint _club_id, bytes memory _announcement) public {
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.announcement = _announcement;
    }

    function update_club_threshold(uint _club_id, bytes memory _threshold_type, uint _threshold) public {
        require(_threshold_type.length > 0, "invalid threshold type");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.threshold_type = _threshold_type;
        club.threshold = _threshold;
    }

    function add_club_channel(uint _club_id, bytes memory _name) public {
        require(_name.length > 0, "invalid channel name");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        uint channel_index = club.channel_count;
        club.channel_count++;
        Channel storage channel = channels[_club_id][channel_index];
        channel.name = _name;
        emit ChannelCreated(_club_id, channel_index, _name);
    }

    function update_club_channel_name(uint _club_id, uint _channel_index, bytes memory _name) public {
        require(_name.length > 0, "invalid channel name");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        require(_channel_index < club.channel_count, "Channel does not exist");
        Channel storage channel = channels[_club_id][_channel_index];
        channel.name = _name;
    }

    function delete_club_channel(uint _club_id, uint _channel_index) public {
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        require(_channel_index < club.channel_count, "Channel does not exist");
        Channel storage channel = channels[_club_id][_channel_index];
        channel.deleted = true;
    }

    function new_message(uint _club_id, uint _channel_index, bytes memory _content) public {
        Channel storage channel = channels[_club_id][_channel_index];
        require(channel.name.length > 0, "Club or Channel does not exist");
        require(!channel.deleted, "Channel is deleted");
        Message[] storage channel_messages = messages[_club_id][_channel_index];
        channel_messages.push(Message({
            sender: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            deleted: false
        }));
    }

    function delete_message(uint _club_id, uint _channel_index, uint _message_index) public {
        Message[] storage channel_messages = messages[_club_id][_channel_index];
        require(_message_index < channel_messages.length, "Message does not exist");
        Message storage message = channel_messages[_message_index];
        require(message.sender == msg.sender, "Unauthorized to delete message");
        message.deleted = true;
    }
}
