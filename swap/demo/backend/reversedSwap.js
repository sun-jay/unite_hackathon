require('dotenv').config({ path: '/Users/sunnyjay/Documents/VScode/eht/unite_hackathon/swap/.env' });
const { ethers } = require('ethers');
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

class ReversedSwapHandler {
  constructor(sepoliaProvider, sepoliaWallet, tronWeb, nileWallet, config, broadcastFunction) {
    this.sepoliaProvider = sepoliaProvider;
    this.sepoliaWallet = sepoliaWallet;
    this.tronWeb = tronWeb;
    this.nileWallet = nileWallet;
    this.config = config;
    this.broadcast = broadcastFunction;
  }

  async runReversedCrossChainTest() {
    try {
      this.broadcast('test_started', { 
        message: 'Reversed cross-chain test initiated (Bob initiates)',
        reversedFlow: true 
      });

      // Fixed constants for deterministic testing - with unique timestamp to avoid collisions
      const SECRET_BASE = "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e";
      const TIMESTAMP = Math.floor(Date.now() / 1000).toString(16).padStart(2, '0');
      const SECRET = SECRET_BASE + TIMESTAMP.slice(-2);
      const HASH_LOCK = ethers.keccak256(SECRET);

      // Contract addresses from config
      const SEPOLIA_HTLC = this.config.networks.sepolia.contracts.HTLC.address;
      const SEPOLIA_TOKEN = this.config.networks.sepolia.contracts.TestToken.address;
      const NILE_HTLC = this.config.networks.nile.contracts.HTLC.address;
      const NILE_TOKEN = this.config.networks.nile.contracts.TestToken.address;

      this.broadcast('constants_generated', {
        secret: SECRET,
        hashLock: HASH_LOCK,
        contracts: {
          sepolia: { htlc: SEPOLIA_HTLC, token: SEPOLIA_TOKEN },
          nile: { htlc: NILE_HTLC, token: NILE_TOKEN }
        },
        reversedFlow: true
      });

      // Step 1: Contract Setup
      this.broadcast('step_started', { step: 1, name: 'Contract Setup (Reversed)', reversedFlow: true });
      
      // Sepolia contracts
      const sepoliaHTLC = new ethers.Contract(
        SEPOLIA_HTLC,
        [
          "function lock(bytes32 _hashLock, address _token, uint256 _amount, address _beneficiary, uint256 _timelock) external",
          "function withdraw(bytes32 _secret) external",
          "function getLock(bytes32 _hashLock) external view returns (address, address, address, uint256, uint256, bool, bool)",
          "event Locked(bytes32 indexed hash, address indexed sender, address indexed token, uint256 amount, address beneficiary, uint256 timelock)",
          "event Withdrawn(bytes32 indexed hash, bytes32 secret)"
        ],
        this.sepoliaWallet
      );

      const sepoliaToken = new ethers.Contract(
        SEPOLIA_TOKEN,
        [
          "function decimals() external view returns (uint8)",
          "function balanceOf(address account) external view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)",
          "function mint(address to, uint256 amount) external"
        ],
        this.sepoliaWallet
      );

      // Tron contracts
      const nileHTLC = await this.tronWeb.contract().at(NILE_HTLC);
      const nileToken = await this.tronWeb.contract().at(NILE_TOKEN);

      this.broadcast('step_completed', { step: 1, message: 'Contract instances created', reversedFlow: true });

      // Step 2: Token Amount Calculation (REVERSED SCENARIO)
      this.broadcast('step_started', { step: 2, name: 'Token Amount Calculation (Reversed)', reversedFlow: true });

      const sepoliaDecimals = await sepoliaToken.decimals();
      const nileDecimalsRaw = await nileToken.decimals().call();
      const nileDecimals = Number(nileDecimalsRaw);

      // REVERSED: Bob (TRON user) initiates, Alice (ETH user) responds
      // Bob locks 0.001 TRON tokens on Nile 
      // Bob receives 0.001 ETH tokens on Sepolia (full amount)
      // Alice locks 0.001 ETH tokens on Sepolia
      // Alice receives 0.00099 TRON tokens on Nile (1% less due to fees)
      const amountNile = BigInt(10) ** BigInt(Math.max(nileDecimals - 3, 0)); // Bob locks 0.001 TRON
      const amountSepoliaForBob = ethers.parseUnits("0.001", sepoliaDecimals); // Bob gets 0.001 ETH (full)
      const amountSepolia = ethers.parseUnits("0.001", sepoliaDecimals); // Alice locks 0.001 ETH
      const amountNileForAlice = BigInt(10) ** BigInt(Math.max(nileDecimals - 3, 0)) * BigInt(99) / BigInt(100); // Alice gets 0.00099 TRON (1% less)

      this.broadcast('amounts_calculated', {
        nile: { 
          decimals: nileDecimals, 
          amount: amountNile.toString(),
          formatted: (Number(amountNile) / 10 ** nileDecimals).toString(),
          role: "Bob locks (initiator)"
        },
        sepolia: { 
          decimals: Number(sepoliaDecimals), 
          amountLocked: amountSepolia.toString(),
          amountForBob: amountSepoliaForBob.toString(),
          formattedLocked: ethers.formatUnits(amountSepolia, sepoliaDecimals),
          formattedForBob: ethers.formatUnits(amountSepoliaForBob, sepoliaDecimals),
          role: "Alice locks, Bob receives (full amount)"
        },
        feeStructure: "Alice (responder) receives 1% less when withdrawing from Tron",
        reversedFlow: true
      });

      this.broadcast('swap_participants', {
        bob: {
          role: "Initiator (Tron user)",
          locks: `${Number(amountNile) / 10 ** nileDecimals} TRON tokens`,
          receives: `${ethers.formatUnits(amountSepoliaForBob, sepoliaDecimals)} ETH tokens (full amount)`
        },
        alice: {
          role: "Responder (Ethereum user)", 
          locks: `${ethers.formatUnits(amountSepolia, sepoliaDecimals)} ETH tokens`,
          receives: `${Number(amountNileForAlice) / 10 ** nileDecimals} TRON tokens (1% fee deducted)`
        },
        reversedFlow: true
      });

      // Step 3: Check and mint tokens if needed
      this.broadcast('step_started', { step: 3, name: 'Token Balance Check (Reversed)', reversedFlow: true });

      const sepoliaBalance = await sepoliaToken.balanceOf(this.sepoliaWallet.address);
      const nileBalance = await nileToken.balanceOf(this.nileWallet).call();

      this.broadcast('balances_checked', {
        sepolia: ethers.formatUnits(sepoliaBalance, sepoliaDecimals),
        nile: (Number(nileBalance) / 10 ** nileDecimals).toString(),
        reversedFlow: true
      });

      if (sepoliaBalance < amountSepolia) {
        this.broadcast('minting_tokens', { chain: 'sepolia', reversedFlow: true });
        const mintTx = await sepoliaToken.mint(this.sepoliaWallet.address, ethers.parseUnits("10", sepoliaDecimals));
        await mintTx.wait(2);
        this.broadcast('tokens_minted', { chain: 'sepolia', txHash: mintTx.hash, reversedFlow: true });
      }

      if (Number(nileBalance) / 10 ** nileDecimals < 1) {
        this.broadcast('minting_tokens', { chain: 'nile', reversedFlow: true });
        const mintAmount = BigInt(10) ** BigInt(nileDecimals) * BigInt(10); // 10 tokens
        const mintTx = await nileToken.mint(this.nileWallet, mintAmount.toString()).send();
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.broadcast('tokens_minted', { chain: 'nile', txHash: mintTx, reversedFlow: true });
      }

      // Step 4: HTLC Approvals
      this.broadcast('step_started', { step: 4, name: 'HTLC Approvals (Reversed)', reversedFlow: true });

      // Nile approval (Bob's chain - he goes first)
      const nileApproveTx = await nileToken.approve(NILE_HTLC, amountNile.toString()).send();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check allowance
      const nileAllowance = await nileToken.allowance(this.nileWallet, NILE_HTLC).call();
      if (BigInt(nileAllowance) < amountNile) {
        throw new Error('Insufficient Nile allowance');
      }

      this.broadcast('approval_completed', { 
        chain: 'nile', 
        txHash: nileApproveTx,
        explorerUrl: `${this.config.networks.nile.explorer.txUrl}${nileApproveTx}`,
        reversedFlow: true
      });

      // Sepolia approval (Alice's chain - she responds)
      const sepoliaApproveTx = await sepoliaToken.approve(SEPOLIA_HTLC, amountSepolia);
      await sepoliaApproveTx.wait(2);
      
      // Check allowance
      const sepoliaAllowance = await sepoliaToken.allowance(this.sepoliaWallet.address, SEPOLIA_HTLC);
      if (sepoliaAllowance < amountSepolia) {
        throw new Error('Insufficient Sepolia allowance');
      }

      this.broadcast('approval_completed', { 
        chain: 'sepolia', 
        txHash: sepoliaApproveTx.hash,
        explorerUrl: `${this.config.networks.sepolia.explorer.txUrl}${sepoliaApproveTx.hash}`,
        reversedFlow: true
      });

      // Step 5: Creating Locks (REVERSED ORDER)
      this.broadcast('step_started', { step: 5, name: 'Creating Locks (Reversed)', reversedFlow: true });

      // REVERSED: Bob locks first (shorter timelock), Alice locks second (longer timelock)
      const now = Math.floor(Date.now() / 1000);
      const nileTimelock = now + 3600;    // 1 hour (shorter - Bob's lock)
      const sepoliaTimelock = now + 7200; // 2 hours (longer - Alice's lock)

      this.broadcast('timelocks_set', {
        nile: nileTimelock,
        sepolia: sepoliaTimelock,
        nileTime: new Date(nileTimelock * 1000).toISOString(),
        sepoliaTime: new Date(sepoliaTimelock * 1000).toISOString(),
        reversedFlow: true
      });

      // Nile lock first (Bob initiates with shorter timelock)
      this.broadcast('creating_lock', { chain: 'nile', reversedFlow: true });
      const nileLockTx = await nileHTLC.lock(
        HASH_LOCK,
        NILE_TOKEN,
        amountNile,
        this.nileWallet,
        nileTimelock
      ).send();

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for confirmations

      // Check Nile lock
      const nileLockData = await nileHTLC.getLock(HASH_LOCK).call();
      if (nileLockData.withdrawn || nileLockData.refunded) {
        throw new Error('Nile lock in wrong state');
      }

      this.broadcast('lock_created', {
        chain: 'nile',
        txHash: nileLockTx,
        explorerUrl: `${this.config.networks.nile.explorer.txUrl}${nileLockTx}`,
        timelock: nileTimelock,
        reversedFlow: true
      });

      // Sepolia lock second (Alice responds with longer timelock)
      this.broadcast('creating_lock', { chain: 'sepolia', reversedFlow: true });
      const sepoliaLockTx = await sepoliaHTLC.lock(
        HASH_LOCK,
        SEPOLIA_TOKEN,
        amountSepolia,
        this.sepoliaWallet.address,
        sepoliaTimelock
      );
      const sepoliaLockReceipt = await sepoliaLockTx.wait(2);

      // Check Sepolia lock
      const sepoliaLockedEvent = sepoliaLockReceipt.logs.find(
        log => log.topics[0] === ethers.id("Locked(bytes32,address,address,uint256,address,uint256)")
      );
      
      if (!sepoliaLockedEvent) {
        throw new Error('Sepolia Locked event not found');
      }

      const sepoliaLockData = await sepoliaHTLC.getLock(HASH_LOCK);
      const [sender, beneficiary, token, amount, timelock, withdrawn, refunded] = sepoliaLockData;

      if (withdrawn || refunded) {
        throw new Error('Sepolia lock in wrong state');
      }
      
      this.broadcast('lock_created', {
        chain: 'sepolia',
        txHash: sepoliaLockTx.hash,
        explorerUrl: `${this.config.networks.sepolia.explorer.txUrl}${sepoliaLockTx.hash}`,
        timelock: sepoliaTimelock,
        reversedFlow: true
      });

      // Step 6: Withdraw on Sepolia FIRST (Bob reveals secret - REVERSED)
      this.broadcast('step_started', { step: 6, name: 'Withdraw on Sepolia (Bob reveals secret)', reversedFlow: true });

      const sepoliaBalanceBefore = await sepoliaToken.balanceOf(this.sepoliaWallet.address);

      const sepoliaWithdrawTx = await sepoliaHTLC.withdraw(SECRET);
      const sepoliaWithdrawReceipt = await sepoliaWithdrawTx.wait(2);

      // Check Sepolia withdraw
      const sepoliaWithdrawnEvent = sepoliaWithdrawReceipt.logs.find(
        log => log.topics[0] === ethers.id("Withdrawn(bytes32,bytes32)")
      );

      if (!sepoliaWithdrawnEvent) {
        throw new Error('Sepolia Withdrawn event not found');
      }

      const sepoliaLockDataAfter = await sepoliaHTLC.getLock(HASH_LOCK);
      const [senderAfter, beneficiaryAfter, tokenAfter, amountAfter, timelockAfter, withdrawnAfter, refundedAfter] = sepoliaLockDataAfter;
      const sepoliaBalanceAfter = await sepoliaToken.balanceOf(this.sepoliaWallet.address);

      if (!withdrawnAfter || refundedAfter) {
        throw new Error('Sepolia lock not properly withdrawn');
      }

      if (sepoliaBalanceAfter - sepoliaBalanceBefore < amountSepolia * 99n / 100n) { // Allow for small precision
        throw new Error('Sepolia balance did not increase correctly');
      }

      this.broadcast('withdrawal_completed', {
        chain: 'sepolia',
        txHash: sepoliaWithdrawTx.hash,
        explorerUrl: `${this.config.networks.sepolia.explorer.txUrl}${sepoliaWithdrawTx.hash}`,
        secretRevealed: true,
        reversedFlow: true
      });

      // Step 7: Withdraw on Nile SECOND (Alice uses revealed secret - REVERSED)
      this.broadcast('step_started', { step: 7, name: 'Withdraw on Nile (Alice uses revealed secret)', reversedFlow: true });

      const nileBalanceBefore = await nileToken.balanceOf(this.nileWallet).call();

      // Convert secret to proper format for TronWeb
      const secretBytes32 = SECRET;
      const nileWithdrawTx = await nileHTLC.withdraw(secretBytes32).send();

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for confirmations

      // Check Nile withdraw
      const nileLockDataAfter = await nileHTLC.getLock(HASH_LOCK).call();
      const nileBalanceAfter = await nileToken.balanceOf(this.nileWallet).call();

      if (!nileLockDataAfter.withdrawn || nileLockDataAfter.refunded) {
        throw new Error('Nile lock not properly withdrawn');
      }

      // Alice receives 1% less (amountNileForAlice)
      if (BigInt(nileBalanceAfter) - BigInt(nileBalanceBefore) < amountNileForAlice) {
        throw new Error('Nile balance did not increase correctly for Alice');
      }

      this.broadcast('withdrawal_completed', {
        chain: 'nile',
        txHash: nileWithdrawTx,
        explorerUrl: `${this.config.networks.nile.explorer.txUrl}${nileWithdrawTx}`,
        secretRevealed: false, // Already revealed in previous step
        reversedFlow: true
      });

      // Test completed
      this.broadcast('test_completed', {
        message: 'Reversed cross-chain atomic swap completed successfully! (Bob initiated)',
        secret: SECRET,
        hashLock: HASH_LOCK,
        transactions: {
          nile: {
            lock: nileLockTx,
            withdraw: nileWithdrawTx
          },
          sepolia: {
            lock: sepoliaLockTx.hash,
            withdraw: sepoliaWithdrawTx.hash
          }
        },
        reversedFlow: true
      });

      return { success: true, message: 'Reversed swap completed successfully' };

    } catch (error) {
      console.error('Reversed test failed:', error);
      this.broadcast('test_failed', { 
        message: error.message,
        error: error.toString(),
        reversedFlow: true
      });
      throw error;
    }
  }

  async runReversedMockTest() {
    try {
      console.log('🎭 Starting REVERSED MOCK Cross-chain test...');
      this.broadcast('test_started', { 
        message: 'Reversed mock cross-chain test initiated (Bob initiates)',
        mockMode: true,
        reversedFlow: true 
      });

      await this.delay(1000);

      // Mock constants
      const SECRET = "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e43";
      const HASH_LOCK = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";

      this.broadcast('constants_generated', {
        secret: SECRET,
        hashLock: HASH_LOCK,
        contracts: {
          sepolia: { htlc: '0x9876...MockSepoliaHTLC', token: '0x5432...MockSepoliaToken' },
          nile: { htlc: 'TGX9876...MockNileHTLC', token: 'TGX5432...MockNileToken' }
        },
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Step 1: Contract Setup
      this.broadcast('step_started', { step: 1, name: 'Contract Setup (Reversed Mock)', reversedFlow: true });
      await this.delay(1000);
      this.broadcast('step_completed', { step: 1, message: 'Mock contract instances created', reversedFlow: true });

      await this.delay(1000);

      // Step 2: Token Amount Calculation
      this.broadcast('step_started', { step: 2, name: 'Token Amount Calculation (Reversed Mock)', reversedFlow: true });

      this.broadcast('amounts_calculated', {
        nile: { 
          decimals: 6, 
          amount: "1000",
          formatted: "0.001",
          role: "Bob locks (initiator)"
        },
        sepolia: { 
          decimals: 18, 
          amountLocked: "1000000000000000",
          amountForBob: "1000000000000000", // Bob gets full amount
          formattedLocked: "0.001",
          formattedForBob: "0.001",
          role: "Alice locks, Bob receives (full amount)"
        },
        feeStructure: "Alice (responder) receives 1% less when withdrawing from Tron",
        mockMode: true,
        reversedFlow: true
      });

      this.broadcast('swap_participants', {
        bob: {
          role: "Initiator (Tron user)",
          locks: "0.001 TRON tokens",
          receives: "0.001 ETH tokens (full amount)"
        },
        alice: {
          role: "Responder (Ethereum user)", 
          locks: "0.001 ETH tokens",
          receives: "0.00099 TRON tokens (1% fee deducted)"
        },
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Step 3: Balance Check
      this.broadcast('step_started', { step: 3, name: 'Token Balance Check (Reversed Mock)', reversedFlow: true });
      
      this.broadcast('balances_checked', {
        sepolia: "10.5",
        nile: "25.8",
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Step 4: Approvals (Reversed order)
      this.broadcast('step_started', { step: 4, name: 'HTLC Approvals (Reversed Mock)', reversedFlow: true });

      await this.delay(1500);
      this.broadcast('approval_completed', { 
        chain: 'nile', 
        txHash: 'nile9999...mockNileApprovalReversed',
        explorerUrl: 'https://nile.tronscan.org/#/transaction/nile9999...mockNileApprovalReversed',
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1500);
      this.broadcast('approval_completed', { 
        chain: 'sepolia', 
        txHash: '0x9999abcd...mockSepoliaApprovalReversed',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0x9999abcd...mockSepoliaApprovalReversed',
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Step 5: Creating Locks (Reversed order)
      this.broadcast('step_started', { step: 5, name: 'Creating Locks (Reversed Mock)', reversedFlow: true });

      const now = Math.floor(Date.now() / 1000);
      const nileTimelock = now + 300;     // 5 minutes for demo (shorter)
      const sepoliaTimelock = now + 600;  // 10 minutes for demo (longer)

      this.broadcast('timelocks_set', {
        nile: nileTimelock,
        sepolia: sepoliaTimelock,
        nileTime: new Date(nileTimelock * 1000).toISOString(),
        sepoliaTime: new Date(sepoliaTimelock * 1000).toISOString(),
        mockMode: true,
        reversedFlow: true
      });

      // Nile lock first (Bob initiates)
      await this.delay(1500);
      this.broadcast('creating_lock', { chain: 'nile', mockMode: true, reversedFlow: true });
      
      await this.delay(2000);
      this.broadcast('lock_created', {
        chain: 'nile',
        txHash: 'nileReversedLock999...mockNileLockReversed',
        explorerUrl: 'https://nile.tronscan.org/#/transaction/nileReversedLock999...mockNileLockReversed',
        timelock: nileTimelock,
        actualLockTime: now + 2,
        mockMode: true,
        reversedFlow: true
      });

      // Sepolia lock second (Alice responds)
      await this.delay(1500);
      this.broadcast('creating_lock', { chain: 'sepolia', mockMode: true, reversedFlow: true });
      
      await this.delay(2000);
      this.broadcast('lock_created', {
        chain: 'sepolia',
        txHash: '0xReversedLock999...mockSepoliaLockReversed',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xReversedLock999...mockSepoliaLockReversed',
        timelock: sepoliaTimelock,
        actualLockTime: now + 4,
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Step 6: Withdraw on Sepolia FIRST (Bob reveals secret)
      this.broadcast('step_started', { step: 6, name: 'Withdraw on Sepolia (Bob reveals secret) - Reversed Mock', reversedFlow: true });

      await this.delay(2000);
      this.broadcast('withdrawal_completed', {
        chain: 'sepolia',
        txHash: '0xReversedWithdraw999...mockSepoliaWithdrawReversed',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xReversedWithdraw999...mockSepoliaWithdrawReversed',
        secretRevealed: true,
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Step 7: Withdraw on Nile SECOND (Alice uses revealed secret)
      this.broadcast('step_started', { step: 7, name: 'Withdraw on Nile (Alice uses revealed secret) - Reversed Mock', reversedFlow: true });

      await this.delay(2000);
      this.broadcast('withdrawal_completed', {
        chain: 'nile',
        txHash: 'nileReversedWithdraw999...mockNileWithdrawReversed',
        explorerUrl: 'https://nile.tronscan.org/#/transaction/nileReversedWithdraw999...mockNileWithdrawReversed',
        secretRevealed: false,
        mockMode: true,
        reversedFlow: true
      });

      await this.delay(1000);

      // Test completed
      this.broadcast('test_completed', {
        message: 'Reversed mock cross-chain atomic swap completed successfully! (Bob initiated)',
        secret: SECRET,
        hashLock: HASH_LOCK,
        transactions: {
          nile: {
            lock: 'nileReversedLock999...mockNileLockReversed',
            withdraw: 'nileReversedWithdraw999...mockNileWithdrawReversed'
          },
          sepolia: {
            lock: '0xReversedLock999...mockSepoliaLockReversed',
            withdraw: '0xReversedWithdraw999...mockSepoliaWithdrawReversed'
          }
        },
        mockMode: true,
        reversedFlow: true
      });

      console.log('🎭 Reversed mock test completed successfully!');
      return { success: true, message: 'Reversed mock swap completed successfully' };

    } catch (error) {
      console.error('Reversed mock test failed:', error);
      this.broadcast('test_failed', { 
        message: error.message,
        error: error.toString(),
        mockMode: true,
        reversedFlow: true
      });
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ReversedSwapHandler; 