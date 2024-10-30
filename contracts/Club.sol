// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract SuiaClub is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;
    // Data structures
    struct Club {
        // id is the unique identifier of the club, starting from 0
        uint id;
        // name is the name of the club
        string name;
        // creator is the creator of the club
        address creator;
        // members is the members of the club
        EnumerableSet.AddressSet members;
    }

    // fee is the amount of native token required to create a club
    uint public fee;
    // club_count is the number of clubs created
    uint public club_count;
    // clubs
    mapping(uint => Club) private clubs;
    // index
    mapping(address => EnumerableSet.UintSet) private joined_club_ids;

    // view struct
    struct ClubView {
        uint id;
        string name;
        address creator;
        uint member_count;
    }

    // ======== events ========
    event ClubCreated(
        uint indexed id,
        address indexed creator,
        string indexed name
    );

    event ClubMemberJoined(
        uint indexed club_id,
        address indexed member
    );

    event ClubMemberExited(
        uint indexed club_id,
        address indexed member
    );

    event ClubNameUpdated(
        uint indexed club_id,
        string indexed name
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
        club.creator = msg.sender;
        club.name = _name;
        // join club
        club.members.add(msg.sender);
        joined_club_ids[msg.sender].add(clubId);
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
        return _user == club.creator;
    }

    function update_club_name(uint _club_id, string memory _name) public {
        require(_club_id < club_count, "Club does not exist");
        require(bytes(_name).length > 0, "invalid club name");
        require(is_authorized_for_club(_club_id, msg.sender), "Unauthorized for club");
        Club storage club = clubs[_club_id];
        club.name = _name;
        emit ClubNameUpdated(_club_id, _name);
    }

    function join_club(uint _club_id) public returns (bool) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        bool success = club.members.add(msg.sender);
        if (success) {
            emit ClubMemberJoined(_club_id, msg.sender);
            joined_club_ids[msg.sender].add(_club_id);
        }
        return success;
    }

    function exit_club(uint _club_id) public returns (bool) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        bool success = club.members.remove(msg.sender);
        if (success) {
            emit ClubMemberExited(_club_id, msg.sender);
            joined_club_ids[msg.sender].remove(_club_id);
        }
        return success;
    }

    // ======== view functions ========

    function get_club_members(uint _club_id) public view returns (address[] memory) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.members.values();
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

    function get_club_view(uint _club_id) public view returns (ClubView memory) {
        Club storage club = clubs[_club_id];
        return ClubView(
            club.id,
            club.name,
            club.creator,
            club.members.length()
        );
    }

    function get_club_view_by_ids(uint[] memory _club_ids) public view returns (ClubView[] memory) {
        ClubView[] memory club_views = new ClubView[](_club_ids.length);
        for (uint i = 0; i < _club_ids.length; i++) {
            club_views[i] = get_club_view(_club_ids[i]);
        }
        return club_views;
    }

    function get_joined_club_ids(address _user) public view returns (uint[] memory) {
        return joined_club_ids[_user].values();
    }

    function is_club_member(uint _club_id, address _user) public view returns (bool) {
        require(_club_id < club_count, "Club does not exist");
        Club storage club = clubs[_club_id];
        return club.members.contains(_user);
    }
}
