// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleTest {
    uint256 public number;
    
    constructor() {
        number = 42;
    }
    
    function setNumber(uint256 _number) external {
        number = _number;
    }
    
    function getNumber() external view returns (uint256) {
        return number;
    }
} 