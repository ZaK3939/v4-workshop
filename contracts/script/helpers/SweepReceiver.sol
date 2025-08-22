// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SweepReceiver
/// @notice Helper contract that can receive ETH from SWEEP action and forward it to EOA
/// @dev Solves the Forge script gas accounting issue with SWEEP to EOA
contract SweepReceiver {
    address public immutable owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Receive ETH from SWEEP action
    receive() external payable {}
    
    // Forward ETH to owner
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Get balance
    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}