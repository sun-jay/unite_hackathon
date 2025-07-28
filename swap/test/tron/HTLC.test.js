const HTLC = artifacts.require("./contracts/tron/HTLC.sol");
const TestToken = artifacts.require("./contracts/tron/TestToken.sol");

contract("Tron HTLC", function (accounts) {
  let htlc;
  let testToken;
  const [owner, beneficiary, attacker] = accounts;

  // Test constants
  const secret = web3.utils.keccak256("supersecret123");
  const hashLock = web3.utils.keccak256(secret);
  const wrongSecret = web3.utils.keccak256("wrongsecret");
  const amount = web3.utils.toWei("100", "ether");

  beforeEach(async function () {
    // Deploy TestToken
    testToken = await TestToken.new("Test USD Token", "TUSD", { from: owner });
    
    // Deploy HTLC
    htlc = await HTLC.new({ from: owner });

    // Mint tokens to owner
    await testToken.mint(owner, web3.utils.toWei("1000", "ether"), { from: owner });
    
    // Approve HTLC contract
    await testToken.approve(htlc.address, web3.utils.toWei("1000", "ether"), { from: owner });
  });

  describe("Deployment", function () {
    it("should deploy HTLC contract", async function () {
      assert.isTrue(web3.utils.isAddress(htlc.address));
    });

    it("should deploy TestToken contract", async function () {
      assert.isTrue(web3.utils.isAddress(testToken.address));
      
      const name = await testToken.name();
      const symbol = await testToken.symbol();
      assert.equal(name, "Test USD Token");
      assert.equal(symbol, "TUSD");
    });
  });

  describe("Lock Function", function () {
    it("should lock tokens successfully and emit Locked event", async function () {
      const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const result = await htlc.lock(
        hashLock,
        testToken.address,
        amount,
        beneficiary,
        timelock,
        { from: owner }
      );

      // Check event emission
      const lockEvent = result.logs.find(log => log.event === 'Locked');
      assert.exists(lockEvent);
      assert.equal(lockEvent.args.hash, hashLock);
      assert.equal(lockEvent.args.sender, owner);
      assert.equal(lockEvent.args.token, testToken.address);
      assert.equal(lockEvent.args.amount.toString(), amount);
      assert.equal(lockEvent.args.beneficiary, beneficiary);
      assert.equal(lockEvent.args.timelock.toString(), timelock.toString());

      // Check lock details
      const lockData = await htlc.getLock(hashLock);
      assert.equal(lockData.sender, owner);
      assert.equal(lockData.beneficiary, beneficiary);
      assert.equal(lockData.token, testToken.address);
      assert.equal(lockData.amount.toString(), amount);
      assert.equal(lockData.timelock.toString(), timelock.toString());
      assert.equal(lockData.withdrawn, false);
      assert.equal(lockData.refunded, false);

      // Check token balance transferred to HTLC contract
      const htlcBalance = await testToken.balanceOf(htlc.address);
      assert.equal(htlcBalance.toString(), amount);
    });
  });

  describe("Withdraw Function", function () {
    beforeEach(async function () {
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      await htlc.lock(
        hashLock,
        testToken.address,
        amount,
        beneficiary,
        timelock,
        { from: owner }
      );
    });

    it("should allow beneficiary to withdraw with correct secret", async function () {
      const initialBalance = await testToken.balanceOf(beneficiary);

      const result = await htlc.withdraw(secret, { from: beneficiary });

      // Check event emission
      const withdrawEvent = result.logs.find(log => log.event === 'Withdrawn');
      assert.exists(withdrawEvent);
      assert.equal(withdrawEvent.args.hash, hashLock);
      assert.equal(withdrawEvent.args.secret, secret);

      // Check balances
      const finalBalance = await testToken.balanceOf(beneficiary);
      assert.equal(
        finalBalance.toString(),
        web3.utils.toBN(initialBalance).add(web3.utils.toBN(amount)).toString()
      );

      const htlcBalance = await testToken.balanceOf(htlc.address);
      assert.equal(htlcBalance.toString(), "0");

      // Check lock status
      const lockData = await htlc.getLock(hashLock);
      assert.equal(lockData.withdrawn, true);
    });
  });

  describe("Refund Function", function () {
    let timelock;

    beforeEach(async function () {
      timelock = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now for testing
      await htlc.lock(
        hashLock,
        testToken.address,
        amount,
        beneficiary,
        timelock,
        { from: owner }
      );
    });

    it("should allow sender to refund after timelock expiration", async function () {
      // Wait for timelock to expire
      await new Promise(resolve => setTimeout(resolve, 3000));

      const initialBalance = await testToken.balanceOf(owner);

      const result = await htlc.refund(hashLock, { from: owner });

      // Check event emission
      const refundEvent = result.logs.find(log => log.event === 'Refunded');
      assert.exists(refundEvent);
      assert.equal(refundEvent.args.hash, hashLock);

      // Check balances
      const finalBalance = await testToken.balanceOf(owner);
      assert.equal(
        finalBalance.toString(),
        web3.utils.toBN(initialBalance).add(web3.utils.toBN(amount)).toString()
      );

      const htlcBalance = await testToken.balanceOf(htlc.address);
      assert.equal(htlcBalance.toString(), "0");

      // Check lock status
      const lockData = await htlc.getLock(hashLock);
      assert.equal(lockData.refunded, true);
    });
  });
}); 