require('dotenv').config();

module.exports = {
  networks: {
    development: {
      // Local Tron development network
      privateKey: "da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0c",
      consume_user_resource_percent: 30,
      fee_limit: 1000000000,
      fullHost: "http://127.0.0.1:9090",
      solidityNode: "http://127.0.0.1:8091",
      eventServer: "http://127.0.0.1:8092",
      network_id: "9"
    },
    nile: {
      privateKey: process.env.TRON_WALLET_PRIVATE_KEY,
      consume_user_resource_percent: 30,
      fee_limit: 1000000000,  // Increased from 100M to 1B TRX (1000 TRX)
      fullHost: process.env.TRON_FULLNODE,
      solidityNode: process.env.TRON_FULLNODE,
      eventServer: process.env.TRON_EVENTSERVER,
      network_id: "3448148188"  // Nile testnet network ID
    }
  },
  // solc compiler optimize
  solc: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai'
  }
} 