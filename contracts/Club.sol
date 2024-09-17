// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract SuiaClub is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    // Data structures
    struct Club {
        // id is the unique identifier of the club, starting from 0
        uint id;
        // name is the name of the club
        string name;
        // owner is the owner of the club
        address owner;
        // admins is the admins of the club
        EnumerableSet.AddressSet admins;
        // members is the members of the club
        EnumerableSet.AddressSet members;
    }

    // fee is the amount of native token required to create a club
    uint public fee;
    // clubs
    mapping(uint => Club) private clubs;
    // club_count is the number of clubs created
    uint public club_count;
    // index
    mapping(address => uint[]) public club_owner_to_ids;

    // ======== events ========
    event ClubCreated(
        uint indexed id,
        address indexed owner,
        string indexed name
    );

    event ClubAdminAdded(
        uint indexed club_id,
        address indexed admin
    );

    event ClubAdminRemoved(
        uint indexed club_id,
        address indexed admin
    );

    event ClubMemberJoined(
        uint indexed club_id,
        address indexed member
    );

    event ClubMemberExited(
        uint indexed club_id,
        address indexed member
    );
    // ======== functions ========
    constructor(uint _fee) Ownable(msg.sender) {
        fee = _fee;
    }

    function set_fee(uint _fee) public onlyOwner {
        fee = _fee;
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function create_club(
        string memory _name
    ) payable public {
        require(msg.value >= fee, "Insufficient funds to create club");
        require(bytes(_name).length > 0, "invalid club name");
        uint clubId = club_count;
        club_count++;
        // create club
        Club storage club = clubs[clubId];
        club.id = clubId;
        club.owner = msg.sender;
        club.name = _name;
        // add to index
        club_owner_to_ids[msg.sender].push(clubId);
        // emit ClubCreated event
        emit ClubCreated(
            clubId,
            msg.sender,
            _name
        );
    }

    function is_authorized_for_club(uint _club_id, address _user) public view returns (bool) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return _user == club.owner || club.admins.contains(_user);
    }

    function add_club_admin(uint _club_id, address _admin) public {
        require(_club_id < club_count, "Club does not exist");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.admins.add(_admin);
    }

    function remove_club_admin(uint _club_id, address _admin) public {
        require(_club_id < club_count, "Club does not exist");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.admins.remove(_admin);
    }

    function update_club_name(uint _club_id, string memory _name) public {
        require(_club_id < club_count, "Club does not exist");
        require(bytes(_name).length > 0, "invalid club name");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.name = _name;
    }

    function get_clubs_by_owner(address _owner) public view returns (uint[] memory) {
        return club_owner_to_ids[_owner];
    }

    function join_club(uint _club_id) public returns (bool) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        bool success = club.members.add(msg.sender);
        if (success) {
            emit ClubMemberJoined(_club_id, msg.sender);
        }
        return success;
    }

    function exit_club(uint _club_id) public returns (bool) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        bool success = club.members.remove(msg.sender);
        if (success) {
            emit ClubMemberExited(_club_id, msg.sender);
        }
        return success;
    }

    function get_club_admins(uint _club_id) public view returns (address[] memory) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.admins.values();
    }

    function get_club_members(uint _club_id) public view returns (address[] memory) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.members.values();
    }

    function get_club_member_count(uint _club_id) public view returns (uint) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.members.length();
    }

    function get_club_members_paged(uint _club_id, uint _offset, uint _limit) public view returns (address[] memory) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        uint length = club.members.length();
        uint end = _offset + _limit;
        if (end > length) {
            end = length;
        }
        if(end <= _offset) {
            return new address[](0);
        }
        address[] memory members = new address[](end - _offset);
        for (uint i = _offset; i < end; i++) {
            members[i - _offset] = club.members.at(i);
        }
        return members;
    }

    function get_club_name(uint _club_id) public view returns (string memory) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.name;
    }

    function get_club_owner(uint _club_id) public view returns (address) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.owner;
    }
}
