import { expect } from "chai";
import { ethers } from "hardhat";
import { HTLC, TestToken } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HTLC Security Tests", function () {
  let htlc: HTLC;
  let testToken: TestToken;
  let owner: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let attacker: SignerWithAddress;

  const secret = ethers.keccak256(ethers.toUtf8Bytes("supersecret123"));
  const hashLock = ethers.keccak256(secret);
  const wrongSecret = ethers.keccak256(ethers.toUtf8Bytes("wrongsecret"));
  const amount = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, beneficiary, attacker] = await ethers.getSigners();

    // Deploy TestToken (using fully qualified name for EVM version)
    const TestTokenFactory = await ethers.getContractFactory("contracts/evm/TestToken.sol:TestToken");
    testToken = await TestTokenFactory.deploy("Test Token", "TEST");
    await testToken.waitForDeployment();

    // Deploy HTLC (using fully qualified name for EVM version)
    const HTLCFactory = await ethers.getContractFactory("contracts/evm/HTLC.sol:HTLC");
    htlc = await HTLCFactory.deploy();
    await htlc.waitForDeployment();

    // Mint tokens to owner and approve HTLC contract
    await testToken.mint(owner.address, ethers.parseEther("1000"));
    await testToken.approve(await htlc.getAddress(), ethers.parseEther("1000"));
  });

  describe("A. Must-Pass Negative Tests", function () {
    
    describe("1. Wrong Secret Reverts", function () {
      beforeEach(async function () {
        const timelock = (await time.latest()) + 3600;
        await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);
      });

      it("Should revert with wrong secret", async function () {
        await expect(
          htlc.connect(beneficiary).withdraw(wrongSecret)
        ).to.be.revertedWith("Lock does not exist");
      });

      it("Should revert with random secret", async function () {
        const randomSecret = ethers.randomBytes(32);
        await expect(
          htlc.connect(beneficiary).withdraw(randomSecret)
        ).to.be.revertedWith("Lock does not exist");
      });
    });

    describe("2. Early Refund Reverts", function () {
      beforeEach(async function () {
        const timelock = (await time.latest()) + 3600;
        await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);
      });

      it("Should revert refund before timelock expiration", async function () {
        await expect(
          htlc.refund(hashLock)
        ).to.be.revertedWith("Lock has not expired");
      });
    });

    describe("3. Unauthorized Withdraw/Beneficiary Enforced", function () {
      beforeEach(async function () {
        const timelock = (await time.latest()) + 3600;
        await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);
      });

      it("Should revert if non-beneficiary tries to withdraw", async function () {
        await expect(
          htlc.connect(attacker).withdraw(secret)
        ).to.be.revertedWith("Only beneficiary can withdraw");
      });

      it("Should only allow refund by original sender", async function () {
        await time.increase(3601); // Past timelock
        
        await expect(
          htlc.connect(attacker).refund(hashLock)
        ).to.be.revertedWith("Only sender can refund");
      });
    });

    describe("4. Single-Use Safety", function () {
      let timelock: number;

      beforeEach(async function () {
        timelock = (await time.latest()) + 3600;
        await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);
      });

      it("Should prevent double withdraw", async function () {
        // First withdraw succeeds
        await htlc.connect(beneficiary).withdraw(secret);

        // Second withdraw fails
        await expect(
          htlc.connect(beneficiary).withdraw(secret)
        ).to.be.revertedWith("Already withdrawn");
      });

      it("Should prevent withdraw after refund", async function () {
        // Fast forward past timelock and refund
        await time.increaseTo(timelock + 1);
        await htlc.refund(hashLock);

        // Withdraw should fail
        await expect(
          htlc.connect(beneficiary).withdraw(secret)
        ).to.be.revertedWith("Already refunded");
      });
    });

    describe("5. Duplicate Hash Lock Prevention", function () {
      it("Should prevent locking with same hash twice", async function () {
        const timelock = (await time.latest()) + 3600;
        
        // First lock succeeds
        await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);

        // Second lock with same hash fails
        await expect(
          htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock)
        ).to.be.revertedWith("Lock already exists");
      });
    });
  });

  describe("B. Input Validation", function () {
    it("Should reject zero amount", async function () {
      const timelock = (await time.latest()) + 3600;
      await expect(
        htlc.lock(hashLock, await testToken.getAddress(), 0, beneficiary.address, timelock)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject zero beneficiary address", async function () {
      const timelock = (await time.latest()) + 3600;
      await expect(
        htlc.lock(hashLock, await testToken.getAddress(), amount, ethers.ZeroAddress, timelock)
      ).to.be.revertedWith("Invalid beneficiary address");
    });

    it("Should reject zero token address", async function () {
      const timelock = (await time.latest()) + 3600;
      await expect(
        htlc.lock(hashLock, ethers.ZeroAddress, amount, beneficiary.address, timelock)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should reject past timelock", async function () {
      const pastTime = (await time.latest()) - 3600;
      await expect(
        htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, pastTime)
      ).to.be.revertedWith("Timelock must be in the future");
    });
  });

  describe("C. Timelock Semantics", function () {
    it("Should prevent withdraw at or after timelock", async function () {
      const timelock = (await time.latest()) + 3600;
      await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);
      
      // At timelock
      await time.increaseTo(timelock);
      await expect(
        htlc.connect(beneficiary).withdraw(secret)
      ).to.be.revertedWith("Lock has expired");
    });

    it("Should only allow refund after timelock expiration", async function () {
      const timelock = (await time.latest()) + 3600;
      await htlc.lock(hashLock, await testToken.getAddress(), amount, beneficiary.address, timelock);
      
      // Right after timelock expires
      await time.increaseTo(timelock + 1);
      await expect(
        htlc.refund(hashLock)
      ).to.not.be.reverted;
    });
  });
}); 