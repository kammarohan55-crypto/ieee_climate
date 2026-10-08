// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Tamper-evident evidence registry. Does not certify environmental claims.
contract ClimateEvidenceRegistry {
    address public immutable publisher;
    mapping(bytes32 => bytes32) public observationDigest;
    mapping(bytes32 => bool) public digestRecorded;
    mapping(bytes32 => uint256) public recordedAt;
    error Unauthorized();
    error EmptyIdentifier();
    error ObservationAlreadyRecorded();
    error DigestAlreadyRecorded();
    error InvalidURI();
    event EvidenceRecorded(bytes32 indexed observationId, bytes32 indexed digest, address indexed publisher, uint256 timestamp, string evidenceURI);
    constructor() { publisher = msg.sender; }
    function record(bytes32 observationId, bytes32 evidenceDigest, string calldata evidenceURI) external {
        if (msg.sender != publisher) revert Unauthorized();
        if (observationId == bytes32(0) || evidenceDigest == bytes32(0)) revert EmptyIdentifier();
        if (observationDigest[observationId] != bytes32(0)) revert ObservationAlreadyRecorded();
        if (digestRecorded[evidenceDigest]) revert DigestAlreadyRecorded();
        if (bytes(evidenceURI).length == 0 || bytes(evidenceURI).length > 2048) revert InvalidURI();
        observationDigest[observationId] = evidenceDigest;
        digestRecorded[evidenceDigest] = true;
        recordedAt[observationId] = block.timestamp;
        emit EvidenceRecorded(observationId, evidenceDigest, msg.sender, block.timestamp, evidenceURI);
    }
}
