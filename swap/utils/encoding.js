const { ethers } = require('ethers');
const { TronWeb } = require('tronweb');

// Create a minimal TronWeb instance for address utilities (no network connection needed)
const tronWeb = new TronWeb({
  fullHost: 'https://api.nileex.io',
  headers: { "TRON-PRO-API-KEY": 'your-api-key' },
  privateKey: 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0' // Valid dummy private key for address utilities
});

/**
 * Generate a random 32-byte hex string
 * @returns {string} 0x + 64 hex chars
 */
function generateSecret32() {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Hash a 32-byte secret using keccak256(abi.encodePacked(secret))
 * @param {string} secret32Hex - bytes32 hex string (0x..., length 66)
 * @returns {string} keccak256 hash as hex string
 */
function hashSecretKeccakPacked(secret32Hex) {
  // For bytes32 input, keccak256(secret) equals solidityPackedKeccak256(['bytes32'], [secret])
  return ethers.keccak256(secret32Hex);
}

/**
 * Convert Tron base58 address to hex with 41 prefix (no 0x)
 * @param {string} b58 - Tron base58 address (e.g., TMaN...)
 * @returns {string} 41-prefixed hex address (42 chars, no 0x)
 */
function tronBase58ToHex(b58) {
  return tronWeb.address.toHex(b58); // Already returns 41-prefixed hex without 0x
}

/**
 * Convert 41-prefixed hex to Tron base58 address
 * @param {string} hex41 - 41-prefixed 42-char hex (no 0x)
 * @returns {string} Tron base58 address
 */
function tronHexToBase58(hex41) {
  return tronWeb.address.fromHex(hex41); // TronWeb expects 41-prefixed hex without 0x
}

/**
 * Return EVM address in checksummed format
 * @param {string} addr - EVM address
 * @returns {string} Checksummed EVM address
 */
function normalizeEvmAddress(addr) {
  return ethers.getAddress(addr);
}

module.exports = {
  generateSecret32,
  hashSecretKeccakPacked,
  tronBase58ToHex,
  tronHexToBase58,
  normalizeEvmAddress
}; 