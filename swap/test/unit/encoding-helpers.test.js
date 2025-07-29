const { ethers } = require('ethers');
const {
  generateSecret32,
  hashSecretKeccakPacked,
  tronBase58ToHex,
  tronHexToBase58,
  normalizeEvmAddress
} = require('../../utils/encoding');

console.log('🧪 ENCODING HELPERS UNIT TESTS');
console.log('==============================');
console.log('');

// Test A — Hash equality matches Solidity's keccak256(abi.encodePacked(bytes32))
console.log('📋 TEST A: Hash Equality');
console.log('─'.repeat(40));

const SECRET = '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

// Compute with our helper
const H1 = hashSecretKeccakPacked(SECRET);

// Cross-check with ethers "spec"
const H2 = ethers.solidityPackedKeccak256(['bytes32'], [SECRET]);

// Also check direct keccak256 (should equal H1/H2 for bytes32 input)
const H3 = ethers.keccak256(SECRET);

console.log(`├── Secret: ${SECRET}`);
console.log(`├── H1 (our helper): ${H1}`);
console.log(`├── H2 (solidityPacked): ${H2}`);
console.log(`├── H3 (direct keccak): ${H3}`);
console.log('');

// Assertions
const hashEqualityPassed = (
  H1 === H2 &&
  H1 === H3 &&
  /^0x[0-9a-fA-F]{64}$/.test(H1)
);

if (hashEqualityPassed) {
  console.log('✅ PASS: hash equality (H1 == H2 == H3)');
} else {
  console.log('❌ FAIL: hash equality');
  console.log(`   H1 === H2: ${H1 === H2}`);
  console.log(`   H1 === H3: ${H1 === H3}`);
  console.log(`   Valid hex: ${/^0x[0-9a-fA-F]{64}$/.test(H1)}`);
  process.exit(1);
}

console.log('');

// Test B — Tron address round-trip (base58 ↔ hex41)
console.log('📋 TEST B: Tron Address Round-Trip');
console.log('─'.repeat(40));

// Use a known Tron address for deterministic testing
const b58 = 'TMaN1TkiAsPEWpn67eDUU9xkotYMqcPkZ7';

// Convert to hex41
const hex41 = tronBase58ToHex(b58);

// Convert back to base58
const b58Round = tronHexToBase58(hex41);

console.log(`├── Original base58: ${b58}`);
console.log(`├── Converted to hex41: ${hex41}`);
console.log(`├── Round-trip base58: ${b58Round}`);
console.log('');

// Assertions
const isValidHex41 = (
  hex41.length === 42 &&
  !hex41.startsWith('0x') &&
  hex41.startsWith('41') &&
  /^[0-9a-fA-F]{42}$/.test(hex41)
);

const roundTripPassed = (
  isValidHex41 &&
  b58Round === b58
);

if (roundTripPassed) {
  console.log('✅ PASS: tron address round-trip');
} else {
  console.log('❌ FAIL: tron address round-trip');
  console.log(`   Valid hex41: ${isValidHex41}`);
  console.log(`     Length 42: ${hex41.length === 42}`);
  console.log(`     No 0x prefix: ${!hex41.startsWith('0x')}`);
  console.log(`     Starts with 41: ${hex41.startsWith('41')}`);
  console.log(`     Is hex: ${/^[0-9a-fA-F]{42}$/.test(hex41)}`);
  console.log(`   Round-trip match: ${b58Round === b58}`);
  process.exit(1);
}

console.log('');

// Summary
if (hashEqualityPassed && roundTripPassed) {
  console.log('🏆 ALL ENCODING HELPER TESTS PASSED!');
  console.log('====================================');
  console.log('✅ Hash functions match Solidity exactly');
  console.log('✅ Tron address conversion is lossless');
  console.log('✅ Ready for cross-chain operations');
} else {
  console.log('❌ ENCODING HELPER TESTS FAILED');
  process.exit(1);
} 