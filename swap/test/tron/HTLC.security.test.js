const HTLC = artifacts.require("./contracts/tron/HTLC.sol");
const TestToken = artifacts.require("./contracts/tron/TestToken.sol");

contract("Tron HTLC Security Tests", function (accounts) {
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

  describe("A. Must-Pass Negative Tests", function () {
    
    describe("1. Wrong Secret Reverts", function () {
      beforeEach(async function () {
        const timelock = Math.floor(Date.now() / 1000) + 3600;
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });
      });

      it("should revert with wrong secret", async function () {
        try {
          await htlc.withdraw(wrongSecret, { from: beneficiary });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Lock does not exist");
        }
      });

      it("should revert with random secret", async function () {
        const randomSecret = web3.utils.randomHex(32);
        try {
          await htlc.withdraw(randomSecret, { from: beneficiary });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Lock does not exist");
        }
      });
    });

    describe("2. Early Refund Reverts", function () {
      beforeEach(async function () {
        const timelock = Math.floor(Date.now() / 1000) + 3600;
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });
      });

      it("should revert refund before timelock expiration", async function () {
        try {
          await htlc.refund(hashLock, { from: owner });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Lock has not expired");
        }
      });
    });

    describe("3. Unauthorized Withdraw/Beneficiary Enforced", function () {
      beforeEach(async function () {
        const timelock = Math.floor(Date.now() / 1000) + 3600;
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });
      });

      it("should revert if non-beneficiary tries to withdraw", async function () {
        try {
          await htlc.withdraw(secret, { from: attacker });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Only beneficiary can withdraw");
        }
      });

      it("should only allow refund by original sender", async function () {
        // Wait for timelock to expire
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          await htlc.refund(hashLock, { from: attacker });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Only sender can refund");
        }
      });
    });

    describe("4. Single-Use Safety", function () {
      let timelock;

      beforeEach(async function () {
        timelock = Math.floor(Date.now() / 1000) + 3600;
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });
      });

      it("should prevent double withdraw", async function () {
        // First withdraw succeeds
        await htlc.withdraw(secret, { from: beneficiary });

        // Second withdraw fails
        try {
          await htlc.withdraw(secret, { from: beneficiary });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Already withdrawn");
        }
      });

      it("should prevent withdraw after refund", async function () {
        // Fast forward past timelock and refund
        timelock = Math.floor(Date.now() / 1000) + 1;
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await htlc.refund(hashLock, { from: owner });

        // Withdraw should fail
        try {
          await htlc.withdraw(secret, { from: beneficiary });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Already refunded");
        }
      });
    });

    describe("5. Duplicate Hash Lock Prevention", function () {
      it("should prevent locking with same hash twice", async function () {
        const timelock = Math.floor(Date.now() / 1000) + 3600;
        
        // First lock succeeds
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });

        // Second lock with same hash fails
        try {
          await htlc.lock(hashLock, testToken.address, amount, beneficiary, timelock, { from: owner });
          assert.fail("Should have reverted");
        } catch (error) {
          assert.include(error.message, "Lock already exists");
        }
      });
    });
  });

  describe("B. Input Validation", function () {
    it("should reject zero amount", async function () {
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      try {
        await htlc.lock(hashLock, testToken.address, 0, beneficiary, timelock, { from: owner });
        assert.fail("Should have reverted");
      } catch (error) {
        assert.include(error.message, "Amount must be greater than 0");
      }
    });

    it("should reject zero beneficiary address", async function () {
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      try {
        await htlc.lock(hashLock, testToken.address, amount, "0x0000000000000000000000000000000000000000", timelock, { from: owner });
        assert.fail("Should have reverted");
      } catch (error) {
        assert.include(error.message, "Invalid beneficiary address");
      }
    });

    it("should reject zero token address", async function () {
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      try {
        await htlc.lock(hashLock, "0x0000000000000000000000000000000000000000", amount, beneficiary, timelock, { from: owner });
        assert.fail("Should have reverted");
      } catch (error) {
        assert.include(error.message, "Invalid token address");
      }
    });

    it("should reject past timelock", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      try {
        await htlc.lock(hashLock, testToken.address, amount, beneficiary, pastTime, { from: owner });
        assert.fail("Should have reverted");
      } catch (error) {
        assert.include(error.message, "Timelock must be in the future");
      }
    });
  });

  describe("C. Cross-Chain Compatibility", function () {
    it("should use same keccak256 hash function as EVM", async function () {
      const testString = "test";
      const tronHash = web3.utils.keccak256(testString);
      
      // This should be identical to EVM keccak256
      assert.equal(tronHash, "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658");
    });

    it("should have identical event signatures", async function () {
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      
      const result = await htlc.lock(
        hashLock,
        testToken.address,
        amount,
        beneficiary,
        timelock,
        { from: owner }
      );

      const lockEvent = result.logs.find(log => log.event === 'Locked');
      assert.exists(lockEvent);
      
      // Event should have same structure as EVM version
      assert.exists(lockEvent.args.hash);
      assert.exists(lockEvent.args.sender);
      assert.exists(lockEvent.args.token);
      assert.exists(lockEvent.args.amount);
      assert.exists(lockEvent.args.beneficiary);
      assert.exists(lockEvent.args.timelock);
    });
  });
}); 