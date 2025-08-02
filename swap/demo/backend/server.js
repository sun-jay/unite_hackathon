require('dotenv').config({ path: '/Users/sunnyjay/Documents/VScode/eht/unite_hackathon/swap/.env' });
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { ethers } = require('ethers');
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

class CrossChainDemoServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.clients = new Set();
    this.isRunning = false;
    this.mockMode = process.env.MOCK_MODE === 'true' || false; // Enable mock mode via env var
    
    // Load config from parent directory
    this.config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../scripts/config.json'), 'utf8')
    );
    
    this.setupMiddleware();
    this.setupWebSocket();
    this.setupRoutes();
    
    if (!this.mockMode) {
      this.setupProviders();
    } else {
      console.log('🎭 MOCK MODE ENABLED - No real blockchain connections');
    }
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('🔌 Client connected');
      this.clients.add(ws);
      
      // Send current status
      ws.send(JSON.stringify({
        type: 'connection',
        data: { connected: true, running: this.isRunning }
      }));

      ws.on('close', () => {
        console.log('🔌 Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        clients: this.clients.size,
        running: this.isRunning,
        mockMode: this.mockMode
      });
    });

    this.app.post('/start-test', async (req, res) => {
      if (this.isRunning) {
        return res.status(400).json({ error: 'Test already running' });
      }

      try {
        this.isRunning = true;
        const mockMode = req.body.mockMode || this.mockMode;
        res.json({ success: true, message: `Cross-chain test started (${mockMode ? 'MOCK' : 'LIVE'} mode)` });
        
        // Start the test in background
        if (mockMode) {
          this.runMockTest().catch(error => {
            this.broadcast('test_failed', { message: error.message });
            this.isRunning = false;
          });
        } else {
          this.runCrossChainTest().catch(error => {
            this.broadcast('test_failed', { message: error.message });
            this.isRunning = false;
          });
        }
        
      } catch (error) {
        this.isRunning = false;
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/toggle-mock', (req, res) => {
      this.mockMode = !this.mockMode;
      res.json({ 
        success: true, 
        mockMode: this.mockMode,
        message: `Mock mode ${this.mockMode ? 'enabled' : 'disabled'}` 
      });
    });
  }

  setupProviders() {
    // Helper function to resolve environment variables
    const resolveEnvValue = (value) => {
      if (typeof value === 'string' && value.startsWith('env:')) {
        const envVar = value.substring(4);
        const envValue = process.env[envVar];
        if (!envValue) {
          throw new Error(`Environment variable ${envVar} is not set`);
        }
        return envValue;
      }
      return value;
    };

    try {
      // Setup providers
      const sepoliaRpcUrl = resolveEnvValue(this.config.networks.sepolia.rpcUrl);
      const sepoliaPrivateKey = resolveEnvValue(this.config.networks.sepolia.privateKey);
      const tronFullHost = resolveEnvValue(this.config.networks.nile.rpcUrl);
      const tronEventServer = resolveEnvValue(this.config.networks.nile.eventServer);
      const tronPrivateKey = resolveEnvValue(this.config.networks.nile.privateKey);

      // Validate private keys
      if (!sepoliaPrivateKey || sepoliaPrivateKey.length < 60) {
        throw new Error('Invalid Ethereum private key in environment variables');
      }
      if (!tronPrivateKey || tronPrivateKey.length < 60) {
        throw new Error('Invalid Tron private key in environment variables');
      }

      console.log('🔗 Setting up blockchain connections...');
      console.log(`├── Sepolia RPC: ${sepoliaRpcUrl}`);
      console.log(`├── Tron Node: ${tronFullHost}`);
      console.log(`├── Private keys loaded: ETH(${sepoliaPrivateKey.slice(0, 6)}...), TRON(${tronPrivateKey.slice(0, 6)}...)`);

      this.sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
      this.sepoliaWallet = new ethers.Wallet(sepoliaPrivateKey, this.sepoliaProvider);

      this.tronWeb = new TronWeb({
        fullHost: tronFullHost,
        solidityNode: tronFullHost,
        eventServer: tronEventServer,
        privateKey: tronPrivateKey
      });

      this.nileWallet = this.tronWeb.address.fromPrivateKey(tronPrivateKey);
      
      console.log('✅ Blockchain connections established');
      console.log(`├── Sepolia wallet: ${this.sepoliaWallet.address}`);
      console.log(`└── Tron wallet: ${this.nileWallet}`);

    } catch (error) {
      console.error('❌ Failed to setup providers:', error.message);
      console.error('💡 Make sure your .env file exists in the swap directory with valid private keys');
      throw error;
    }
  }

  broadcast(type, data) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`📡 Broadcasted ${type} to ${this.clients.size} clients`);
  }

  async runCrossChainTest() {
    try {
      this.broadcast('test_started', { message: 'Cross-chain test initiated' });

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
        }
      });

      // Step 1: Contract Setup
      this.broadcast('step_started', { step: 1, name: 'Contract Setup' });
      
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

      this.broadcast('step_completed', { step: 1, message: 'Contract instances created' });

      // Step 2: Token Amount Calculation
      this.broadcast('step_started', { step: 2, name: 'Token Amount Calculation' });

      const sepoliaDecimals = await sepoliaToken.decimals();
      const nileDecimalsRaw = await nileToken.decimals().call();
      const nileDecimals = Number(nileDecimalsRaw);

      // CONFIGURABLE AMOUNTS - Modify these values to change swap amounts
      const SEPOLIA_AMOUNT = "0.001";  // Alice locks this amount of ETH tokens
      const NILE_AMOUNT_DESIRED = "0.001";     // Desired amount Alice wants to receive
      const FEE_PERCENTAGE = 1;        // Fee percentage (1% = Bob locks 1% less)

      // Calculate actual amounts with proper decimals
      const amountSepolia = ethers.parseUnits(SEPOLIA_AMOUNT, sepoliaDecimals);
      const amountNileDesired = ethers.parseUnits(NILE_AMOUNT_DESIRED, nileDecimals);
      
      // Calculate Bob's lock amount (reduced by fee) - Bob locks less upfront
      const amountNile = amountNileDesired * BigInt(100 - FEE_PERCENTAGE) / BigInt(100);
      // Alice receives exactly what Bob locks (no further deduction)
      const amountNileForAlice = amountNile;

      this.broadcast('amounts_calculated', {
        sepolia: { 
          decimals: Number(sepoliaDecimals), 
          amount: amountSepolia.toString(),
          formatted: SEPOLIA_AMOUNT,
          role: "Alice locks (initiator)"
        },
        nile: { 
          decimals: nileDecimals, 
          amountLocked: amountNile.toString(),
          amountForAlice: amountNileForAlice.toString(),
          formattedLocked: ethers.formatUnits(amountNile, nileDecimals),
          formattedForAlice: ethers.formatUnits(amountNileForAlice, nileDecimals),
          role: "Bob locks reduced amount, Alice receives full locked amount"
        },
        feeStructure: `Bob (responder) locks ${FEE_PERCENTAGE}% less upfront as platform fee`,
        configuration: {
          sepoliaAmount: SEPOLIA_AMOUNT,
          nileAmountDesired: NILE_AMOUNT_DESIRED,
          nileAmountActual: ethers.formatUnits(amountNile, nileDecimals),
          feePercentage: FEE_PERCENTAGE
        }
      });

      this.broadcast('swap_participants', {
        alice: {
          role: "Initiator (Ethereum user)",
          locks: `${SEPOLIA_AMOUNT} ETH tokens`,
          receives: `${ethers.formatUnits(amountNileForAlice, nileDecimals)} TRON tokens (full locked amount)`
        },
        bob: {
          role: "Responder (Tron user)", 
          locks: `${ethers.formatUnits(amountNile, nileDecimals)} TRON tokens (${FEE_PERCENTAGE}% fee deducted upfront)`,
          receives: `${SEPOLIA_AMOUNT} ETH tokens (full amount)`
        }
      });

      // Step 3: Check and mint tokens if needed
      this.broadcast('step_started', { step: 3, name: 'Token Balance Check' });

      const sepoliaBalance = await sepoliaToken.balanceOf(this.sepoliaWallet.address);
      const nileBalance = await nileToken.balanceOf(this.nileWallet).call();

      this.broadcast('balances_checked', {
        sepolia: ethers.formatUnits(sepoliaBalance, sepoliaDecimals),
        nile: (Number(nileBalance) / 10 ** nileDecimals).toString()
      });

      if (sepoliaBalance < amountSepolia) {
        this.broadcast('minting_tokens', { chain: 'sepolia' });
        const mintTx = await sepoliaToken.mint(this.sepoliaWallet.address, ethers.parseUnits("10", sepoliaDecimals));
        await mintTx.wait(2);
        this.broadcast('tokens_minted', { chain: 'sepolia', txHash: mintTx.hash });
      }

      if (Number(nileBalance) / 10 ** nileDecimals < 1) {
        this.broadcast('minting_tokens', { chain: 'nile' });
        const mintAmount = BigInt(10) ** BigInt(nileDecimals) * BigInt(10); // 10 tokens
        const mintTx = await nileToken.mint(this.nileWallet, mintAmount.toString()).send();
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.broadcast('tokens_minted', { chain: 'nile', txHash: mintTx });
      }

      // Step 4: HTLC Approvals
      this.broadcast('step_started', { step: 4, name: 'HTLC Approvals' });

      // Sepolia approval
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
        explorerUrl: `${this.config.networks.sepolia.explorer.txUrl}${sepoliaApproveTx.hash}`
      });

      // Nile approval
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
        explorerUrl: `${this.config.networks.nile.explorer.txUrl}${nileApproveTx}`
      });

      // Step 5: Creating Locks
      this.broadcast('step_started', { step: 5, name: 'Creating Locks' });

      // Sepolia lock (shorter timelock) - calculate timelock AFTER confirmation
      this.broadcast('creating_lock', { chain: 'sepolia' });
      const sepoliaLockTx = await sepoliaHTLC.lock(
        HASH_LOCK,
        SEPOLIA_TOKEN,
        amountSepolia,
        this.sepoliaWallet.address,
        0 // Temporary timelock, will be set after confirmation
      );
      const sepoliaLockReceipt = await sepoliaLockTx.wait(2);

      // Calculate timelock AFTER confirmation
      const sepoliaConfirmationTime = Math.floor(Date.now() / 1000);
      const sepoliaTimelock = sepoliaConfirmationTime + 3600; // 1 hour from confirmation

      // Update the lock with proper timelock
      const sepoliaUpdateTx = await sepoliaHTLC.lock(
        HASH_LOCK,
        SEPOLIA_TOKEN,
        amountSepolia,
        this.sepoliaWallet.address,
        sepoliaTimelock
      );
      await sepoliaUpdateTx.wait(2);

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
        confirmedAt: sepoliaConfirmationTime
      });

      // Nile lock (longer timelock) - calculate timelock AFTER confirmation
      this.broadcast('creating_lock', { chain: 'nile' });
      const nileLockTx = await nileHTLC.lock(
        HASH_LOCK,
        NILE_TOKEN,
        amountNile,
        this.nileWallet,
        0 // Temporary timelock, will be set after confirmation
      ).send();

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for confirmations

      // Calculate timelock AFTER confirmation
      const nileConfirmationTime = Math.floor(Date.now() / 1000);
      const nileTimelock = nileConfirmationTime + 7200; // 2 hours from confirmation

      // Update the lock with proper timelock
      await nileHTLC.lock(
        HASH_LOCK,
        NILE_TOKEN,
        amountNile,
        this.nileWallet,
        nileTimelock
      ).send();

      await new Promise(resolve => setTimeout(resolve, 3000));

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
        confirmedAt: nileConfirmationTime
      });

      this.broadcast('timelocks_set', {
        sepolia: sepoliaTimelock,
        nile: nileTimelock,
        sepoliaTime: new Date(sepoliaTimelock * 1000).toISOString(),
        nileTime: new Date(nileTimelock * 1000).toISOString(),
        sepoliaConfirmedAt: sepoliaConfirmationTime,
        nileConfirmedAt: nileConfirmationTime
      });

      // Step 6: Withdraw on Nile (Reveal Secret)
      this.broadcast('step_started', { step: 6, name: 'Withdraw on Nile (Reveal Secret)' });

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

      if (BigInt(nileBalanceAfter) - BigInt(nileBalanceBefore) < amountNile) {
        throw new Error('Nile balance did not increase correctly');
      }

      this.broadcast('withdrawal_completed', {
        chain: 'nile',
        txHash: nileWithdrawTx,
        explorerUrl: `${this.config.networks.nile.explorer.txUrl}${nileWithdrawTx}`,
        secretRevealed: true
      });

      // Step 7: Withdraw on Sepolia (Same Secret)
      this.broadcast('step_started', { step: 7, name: 'Withdraw on Sepolia (Same Secret)' });

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
        secretRevealed: false
      });

      // Test completed
      this.broadcast('test_completed', {
        message: 'Cross-chain atomic swap completed successfully!',
        secret: SECRET,
        hashLock: HASH_LOCK,
        transactions: {
          sepolia: {
            lock: sepoliaLockTx.hash,
            withdraw: sepoliaWithdrawTx.hash
          },
          nile: {
            lock: nileLockTx,
            withdraw: nileWithdrawTx
          }
        }
      });

      this.isRunning = false;

    } catch (error) {
      console.error('Test failed:', error);
      this.broadcast('test_failed', { 
        message: error.message,
        error: error.toString()
      });
      this.isRunning = false;
    }
  }

  async runMockTest() {
    try {
      console.log('🎭 Starting MOCK Cross-chain test...');
      this.broadcast('test_started', { 
        message: 'Mock cross-chain test initiated',
        mockMode: true 
      });

      await this.delay(1000);

      // Mock constants
      const SECRET = "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e42";
      const HASH_LOCK = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      this.broadcast('constants_generated', {
        secret: SECRET,
        hashLock: HASH_LOCK,
        contracts: {
          sepolia: { htlc: '0x1234...MockSepoliaHTLC', token: '0x5678...MockSepoliaToken' },
          nile: { htlc: 'TGX1234...MockNileHTLC', token: 'TGX5678...MockNileToken' }
        },
        mockMode: true
      });

      await this.delay(1000);

      // Step 1: Contract Setup
      this.broadcast('step_started', { step: 1, name: 'Contract Setup (Mock)' });
      await this.delay(1000);
      this.broadcast('step_completed', { step: 1, message: 'Mock contract instances created' });

      await this.delay(1000);

      // Step 2: Token Amount Calculation
      this.broadcast('step_started', { step: 2, name: 'Token Amount Calculation (Mock)' });

      this.broadcast('amounts_calculated', {
        sepolia: { 
          decimals: 18, 
          amount: "1000000000000000",
          formatted: "0.001",
          role: "Alice locks (initiator)"
        },
        nile: { 
          decimals: 6, 
          amountLocked: "1000",
          amountForAlice: "990", // 1% less
          formattedLocked: "0.001",
          formattedForAlice: "0.00099",
          role: "Bob locks, Alice receives (1% fee applied)"
        },
        feeStructure: "Alice (initiator) pays 1% fee when withdrawing from Tron",
        mockMode: true
      });

      this.broadcast('swap_participants', {
        alice: {
          role: "Initiator (Ethereum user)",
          locks: "0.001 ETH tokens",
          receives: "0.00099 TRON tokens (1% fee deducted)"
        },
        bob: {
          role: "Responder (Tron user)", 
          locks: "0.001 TRON tokens",
          receives: "0.001 ETH tokens (full amount)"
        },
        mockMode: true
      });

      await this.delay(1000);

      // Step 3: Balance Check
      this.broadcast('step_started', { step: 3, name: 'Token Balance Check (Mock)' });
      
      this.broadcast('balances_checked', {
        sepolia: "10.5",
        nile: "25.8",
        mockMode: true
      });

      await this.delay(1000);

      // Step 4: Approvals
      this.broadcast('step_started', { step: 4, name: 'HTLC Approvals (Mock)' });

      await this.delay(1500);
      this.broadcast('approval_completed', { 
        chain: 'sepolia', 
        txHash: '0xabcd1234...mockSepoliaApproval',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xabcd1234...mockSepoliaApproval',
        mockMode: true
      });

      await this.delay(1500);
      this.broadcast('approval_completed', { 
        chain: 'nile', 
        txHash: 'nile5678...mockNileApproval',
        explorerUrl: 'https://nile.tronscan.org/#/transaction/nile5678...mockNileApproval',
        mockMode: true
      });

      await this.delay(1000);

      // Step 5: Creating Locks
      this.broadcast('step_started', { step: 5, name: 'Creating Locks (Mock)' });

      // Sepolia lock
      await this.delay(1500);
      this.broadcast('creating_lock', { chain: 'sepolia', mockMode: true });
      
      await this.delay(2000);
      const sepoliaConfirmationTime = Math.floor(Date.now() / 1000);
      const sepoliaTimelock = sepoliaConfirmationTime + 300; // 5 minutes from confirmation
      
      this.broadcast('lock_created', {
        chain: 'sepolia',
        txHash: '0xlock1234...mockSepoliaLock',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xlock1234...mockSepoliaLock',
        timelock: sepoliaTimelock,
        confirmedAt: sepoliaConfirmationTime,
        mockMode: true
      });

      // Nile lock
      await this.delay(1500);
      this.broadcast('creating_lock', { chain: 'nile', mockMode: true });
      
      await this.delay(2000);
      const nileConfirmationTime = Math.floor(Date.now() / 1000);
      const nileTimelock = nileConfirmationTime + 600; // 10 minutes from confirmation
      
      this.broadcast('lock_created', {
        chain: 'nile',
        txHash: 'nilelock5678...mockNileLock',
        explorerUrl: 'https://nile.tronscan.org/#/transaction/nilelock5678...mockNileLock',
        timelock: nileTimelock,
        confirmedAt: nileConfirmationTime,
        mockMode: true
      });

      this.broadcast('timelocks_set', {
        sepolia: sepoliaTimelock,
        nile: nileTimelock,
        sepoliaTime: new Date(sepoliaTimelock * 1000).toISOString(),
        nileTime: new Date(nileTimelock * 1000).toISOString(),
        sepoliaConfirmedAt: sepoliaConfirmationTime,
        nileConfirmedAt: nileConfirmationTime,
        mockMode: true
      });

      await this.delay(1000);

      // Step 6: Withdraw on Nile (Reveal Secret)
      this.broadcast('step_started', { step: 6, name: 'Withdraw on Nile (Reveal Secret) - Mock' });

      await this.delay(2000);
      this.broadcast('withdrawal_completed', {
        chain: 'nile',
        txHash: 'nilewithdraw789...mockNileWithdraw',
        explorerUrl: 'https://nile.tronscan.org/#/transaction/nilewithdraw789...mockNileWithdraw',
        secretRevealed: true,
        mockMode: true
      });

      await this.delay(1000);

      // Step 7: Withdraw on Sepolia
      this.broadcast('step_started', { step: 7, name: 'Withdraw on Sepolia (Same Secret) - Mock' });

      await this.delay(2000);
      this.broadcast('withdrawal_completed', {
        chain: 'sepolia',
        txHash: '0xsepwithdraw456...mockSepoliaWithdraw',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xsepwithdraw456...mockSepoliaWithdraw',
        secretRevealed: false,
        mockMode: true
      });

      await this.delay(1000);

      // Test completed
      this.broadcast('test_completed', {
        message: 'Mock cross-chain atomic swap completed successfully!',
        secret: SECRET,
        hashLock: HASH_LOCK,
        transactions: {
          sepolia: {
            lock: '0xlock1234...mockSepoliaLock',
            withdraw: '0xsepwithdraw456...mockSepoliaWithdraw'
          },
          nile: {
            lock: 'nilelock5678...mockNileLock',
            withdraw: 'nilewithdraw789...mockNileWithdraw'
          }
        },
        mockMode: true
      });

      this.isRunning = false;
      console.log('🎭 Mock test completed successfully!');

    } catch (error) {
      console.error('Mock test failed:', error);
      this.broadcast('test_failed', { 
        message: error.message,
        error: error.toString(),
        mockMode: true
      });
      this.isRunning = false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  start(port = 8080) {
    this.server.listen(port, () => {
      console.log(`🚀 Cross-Chain Demo Server running on port ${port}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${port}`);
      console.log(`🌐 HTTP endpoint: http://localhost:8080`);
      console.log(`🎭 Mock mode: ${this.mockMode ? 'ENABLED' : 'DISABLED'}`);
    });
  }
}

// Start server
if (require.main === module) {
  const server = new CrossChainDemoServer();
  server.start();
}

module.exports = CrossChainDemoServer;