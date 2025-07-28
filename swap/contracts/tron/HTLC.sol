// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TRC20 Interface
 * @dev Interface for TRC-20 tokens on Tron
 */
interface ITRC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/**
 * @title HTLC - Hash Time Locked Contract for Tron
 * @dev Minimal HTLC implementation for cross-chain atomic swaps
 * @dev Mirrors EVM HTLC exactly - same function signatures, events, and logic
 */
contract HTLC {
    
    struct Lock {
        address sender;
        address beneficiary;
        ITRC20 token;
        uint256 amount;
        bytes32 hashLock;
        uint256 timelock;
        bool withdrawn;
        bool refunded;
    }

    mapping(bytes32 => Lock) public locks;
    mapping(address => bool) private _reentrancyGuard;

    modifier nonReentrant() {
        require(!_reentrancyGuard[msg.sender], "ReentrancyGuard: reentrant call");
        _reentrancyGuard[msg.sender] = true;
        _;
        _reentrancyGuard[msg.sender] = false;
    }

    event Locked(
        bytes32 indexed hash,
        address indexed sender,
        address indexed token,
        uint256 amount,
        address beneficiary,
        uint256 timelock
    );

    event Withdrawn(bytes32 indexed hash, bytes32 secret);

    event Refunded(bytes32 indexed hash);

    /**
     * @dev Lock tokens with hash and time constraints
     * @param _hashLock Hash of the secret (keccak256)
     * @param _token TRC20 token contract address
     * @param _amount Amount of tokens to lock
     * @param _beneficiary Address that can withdraw with secret
     * @param _timelock Unix timestamp when refund becomes available
     */
    function lock(
        bytes32 _hashLock,
        address _token,
        uint256 _amount,
        address _beneficiary,
        uint256 _timelock
    ) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_token != address(0), "Invalid token address");
        require(_timelock > block.timestamp, "Timelock must be in the future");
        require(locks[_hashLock].sender == address(0), "Lock already exists");

        ITRC20 token = ITRC20(_token);
        
        // Transfer tokens from sender to this contract
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        // Store lock details
        locks[_hashLock] = Lock({
            sender: msg.sender,
            beneficiary: _beneficiary,
            token: token,
            amount: _amount,
            hashLock: _hashLock,
            timelock: _timelock,
            withdrawn: false,
            refunded: false
        });

        emit Locked(_hashLock, msg.sender, _token, _amount, _beneficiary, _timelock);
    }

    /**
     * @dev Withdraw locked tokens by revealing the secret
     * @param _secret The secret that when hashed equals the hashLock
     */
    function withdraw(bytes32 _secret) external nonReentrant {
        bytes32 hashLock = keccak256(abi.encodePacked(_secret));
        Lock storage lockData = locks[hashLock];

        require(lockData.sender != address(0), "Lock does not exist");
        require(!lockData.withdrawn, "Already withdrawn");
        require(!lockData.refunded, "Already refunded");
        require(msg.sender == lockData.beneficiary, "Only beneficiary can withdraw");
        require(block.timestamp < lockData.timelock, "Lock has expired");

        lockData.withdrawn = true;

        // Transfer tokens to beneficiary
        require(lockData.token.transfer(lockData.beneficiary, lockData.amount), "Transfer failed");

        emit Withdrawn(hashLock, _secret);
    }

    /**
     * @dev Refund locked tokens after timelock expiration
     * @param _hashLock The hash used in the original lock
     */
    function refund(bytes32 _hashLock) external nonReentrant {
        Lock storage lockData = locks[_hashLock];

        require(lockData.sender != address(0), "Lock does not exist");
        require(!lockData.withdrawn, "Already withdrawn");
        require(!lockData.refunded, "Already refunded");
        require(msg.sender == lockData.sender, "Only sender can refund");
        require(block.timestamp >= lockData.timelock, "Lock has not expired");

        lockData.refunded = true;

        // Transfer tokens back to sender
        require(lockData.token.transfer(lockData.sender, lockData.amount), "Transfer failed");

        emit Refunded(_hashLock);
    }

    /**
     * @dev Get lock details
     * @param _hashLock The hash used in the lock
     */
    function getLock(bytes32 _hashLock) external view returns (
        address sender,
        address beneficiary,
        address token,
        uint256 amount,
        uint256 timelock,
        bool withdrawn,
        bool refunded
    ) {
        Lock storage lockData = locks[_hashLock];
        return (
            lockData.sender,
            lockData.beneficiary,
            address(lockData.token),
            lockData.amount,
            lockData.timelock,
            lockData.withdrawn,
            lockData.refunded
        );
    }
} 