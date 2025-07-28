import { expect } from "chai";
import { ethers } from "hardhat";
import { HTLC, TestToken } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HTLC", function () {
  let htlc: HTLC;
  let testToken: TestToken;
  let owner: SignerWithAddress;
  let beneficiary: SignerWithAddress;

  const secret = ethers.keccak256(ethers.toUtf8Bytes("supersecret123"));
  const hashLock = ethers.keccak256(secret);
  const amount = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, beneficiary] = await ethers.getSigners();

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

  describe("Deployment", function () {
    it("Should deploy HTLC contract", async function () {
      expect(await htlc.getAddress()).to.be.properAddress;
    });

    it("Should deploy TestToken contract", async function () {
      expect(await testToken.getAddress()).to.be.properAddress;
      expect(await testToken.name()).to.equal("Test Token");
      expect(await testToken.symbol()).to.equal("TEST");
    });
  });

  describe("Lock Function", function () {
    it("Should lock tokens successfully and emit Locked event", async function () {
      const timelock = (await time.latest()) + 3600; // 1 hour from now

      await expect(
        htlc.lock(
          hashLock,
          await testToken.getAddress(),
          amount,
          beneficiary.address,
          timelock
        )
      )
        .to.emit(htlc, "Locked")
        .withArgs(
          hashLock,
          owner.address,
          await testToken.getAddress(),
          amount,
          beneficiary.address,
          timelock
        );

      // Check lock details
      const lockData = await htlc.getLock(hashLock);
      expect(lockData.sender).to.equal(owner.address);
      expect(lockData.beneficiary).to.equal(beneficiary.address);
      expect(lockData.token).to.equal(await testToken.getAddress());
      expect(lockData.amount).to.equal(amount);
      expect(lockData.timelock).to.equal(timelock);
      expect(lockData.withdrawn).to.be.false;
      expect(lockData.refunded).to.be.false;

      // Check token balance transferred to HTLC contract
      expect(await testToken.balanceOf(await htlc.getAddress())).to.equal(amount);
    });
  });

  describe("Withdraw Function", function () {
    beforeEach(async function () {
      const timelock = (await time.latest()) + 3600;
      await htlc.lock(
        hashLock,
        await testToken.getAddress(),
        amount,
        beneficiary.address,
        timelock
      );
    });

    it("Should allow beneficiary to withdraw with correct secret", async function () {
      const initialBalance = await testToken.balanceOf(beneficiary.address);

      await expect(htlc.connect(beneficiary).withdraw(secret))
        .to.emit(htlc, "Withdrawn")
        .withArgs(hashLock, secret);

      // Check balances
      expect(await testToken.balanceOf(beneficiary.address)).to.equal(
        initialBalance + amount
      );
      expect(await testToken.balanceOf(await htlc.getAddress())).to.equal(0);

      // Check lock status
      const lockData = await htlc.getLock(hashLock);
      expect(lockData.withdrawn).to.be.true;
    });
  });

  describe("Refund Function", function () {
    let timelock: number;

    beforeEach(async function () {
      timelock = (await time.latest()) + 3600;
      await htlc.lock(
        hashLock,
        await testToken.getAddress(),
        amount,
        beneficiary.address,
        timelock
      );
    });

    it("Should allow sender to refund after timelock expiration", async function () {
      // Fast forward past timelock
      await time.increaseTo(timelock + 1);

      const initialBalance = await testToken.balanceOf(owner.address);

      await expect(htlc.refund(hashLock))
        .to.emit(htlc, "Refunded")
        .withArgs(hashLock);

      // Check balances
      expect(await testToken.balanceOf(owner.address)).to.equal(
        initialBalance + amount
      );
      expect(await testToken.balanceOf(await htlc.getAddress())).to.equal(0);

      // Check lock status
      const lockData = await htlc.getLock(hashLock);
      expect(lockData.refunded).to.be.true;
    });
  });
}); 