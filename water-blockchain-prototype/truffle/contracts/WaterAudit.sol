// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract WaterAudit is AccessControl {
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");

    struct Device {
        bool exists;
        string label;
        string zone;
    }

    struct EventRecord {
        uint256 id;
        string deviceId;
        uint8 eventType;       // 1=TelemetryAnchor, 2=Alarm, 3=ControlAction, 4=Maintenance
        uint256 timestamp;     // epoch seconds
        bytes32 payloadHash;   // SHA-256(payload JSON)
        string uri;            // off-chain pointer (HTTP/DB/IPFS)
        address submittedBy;
    }

    mapping(string => Device) private devices;
    mapping(uint256 => EventRecord) private eventsById;
    uint256[] private eventIds;
    uint256 public nextEventId = 1;

    event DeviceRegistered(string deviceId, string label, string zone, address indexed by);
    event EventAnchored(uint256 indexed id, string deviceId, uint8 eventType, bytes32 payloadHash, string uri, address indexed by);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ----- Devices -----
    function registerDevice(
        string calldata deviceId,
        string calldata label,
        string calldata zone
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(deviceId).length > 0, "deviceId empty");
        devices[deviceId] = Device(true, label, zone);
        emit DeviceRegistered(deviceId, label, zone, msg.sender);
    }

    function deviceInfo(string calldata deviceId)
        external view
        returns (bool exists, string memory label, string memory zone)
    {
        Device memory d = devices[deviceId];
        return (d.exists, d.label, d.zone);
    }

    // ----- Anchoring -----
    function anchorEvent(
        string calldata deviceId,
        uint8 eventType,
        uint256 timestamp,
        bytes32 payloadHash,
        string calldata uri
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(devices[deviceId].exists, "Unknown device");
        require(eventType >= 1 && eventType <= 4, "Invalid eventType");
        require(timestamp > 0, "Invalid timestamp");
        require(payloadHash != bytes32(0), "Invalid hash");

        uint256 id = nextEventId++;
        EventRecord memory r = EventRecord({
            id: id,
            deviceId: deviceId,
            eventType: eventType,
            timestamp: timestamp,
            payloadHash: payloadHash,
            uri: uri,
            submittedBy: msg.sender
        });

        eventsById[id] = r;
        eventIds.push(id);

        emit EventAnchored(id, deviceId, eventType, payloadHash, uri, msg.sender);
        return id;
    }

    // ----- Queries -----
    function totalEvents() external view returns (uint256) {
        return eventIds.length;
    }

    function getEventIdAt(uint256 index) external view returns (uint256) {
        require(index < eventIds.length, "Index out of range");
        return eventIds[index];
    }

    function getEvent(uint256 id) external view returns (EventRecord memory) {
        require(eventsById[id].id != 0, "Unknown event");
        return eventsById[id];
    }

    // Pagination for UI
    function listEventIds(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        require(offset <= eventIds.length, "bad offset");
        uint256 end = offset + limit;
        if (end > eventIds.length) end = eventIds.length;

        uint256 n = end - offset;
        uint256[] memory out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = eventIds[offset + i];
        }
        return out;
    }
}
