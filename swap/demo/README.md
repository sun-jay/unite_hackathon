# Cross-Chain Atomic Swap Demo

A real-time visualization of cross-chain atomic swaps between Ethereum Sepolia and Tron Nile testnets.

## Architecture

```
┌─────────────────┐    WebSocket    ┌──────────────────┐
│  Next.js Frontend│ <──────────────> │  Backend Server  │
│                 │                 │                  │
│ • Live Dashboard│                 │ • WebSocket Hub  │
│ • Progress Bars │                 │ • Test Runner    │
│ • TX Links      │                 │ • Event Emitter │
│ • Chain Status  │                 │                  │
└─────────────────┘                 └──────────────────┘
        │                                    │
        │ HTTP API                           │ Reuses existing
        └────────────────────────────────────┘ test logic
```

## Features

### 🎯 Real-Time Visualization
- **Live Progress**: Step-by-step progress through atomic swap phases
- **Chain Status**: Connection status for Ethereum Sepolia and Tron Nile
- **Transaction Links**: Direct links to Etherscan and TronScan explorers
- **Live Logs**: Real-time streaming of test execution logs

### 🔄 Interactive Controls
- **Start/Stop**: Control test execution from the web interface
- **Auto-Reconnect**: WebSocket automatically reconnects if connection drops
- **Clear Logs**: Clean up log history during development

### 📊 Integration
- **Reuses Existing Logic**: Built on top of your working cross-chain test
- **Same Configuration**: Uses your existing `config.json` and environment variables
- **Real Transactions**: Shows actual transaction hashes on live testnets

## Quick Start

### 1. Install Dependencies

```bash
# Backend dependencies
cd swap/demo/backend
npm install

# Frontend dependencies  
cd ../frontend
npm install
```

### 2. Environment Setup

Make sure your `.env` file in the `swap` directory contains:
```bash
ETH_RPC_URL=your_sepolia_rpc_url
ETH_WALLET_PRIVATE_KEY=your_private_key
TRON_FULLNODE=https://nile.trongrid.io
TRON_EVENTSERVER=https://event.nileex.io
TRON_WALLET_PRIVATE_KEY=your_tron_private_key
```

### 3. Start the Services

```bash
# Terminal 1: Start backend server
cd swap/demo/backend
npm start

# Terminal 2: Start frontend (in a new terminal)
cd swap/demo/frontend
npm run dev
```

### 4. Access the Demo

- **Frontend Dashboard**: http://localhost:3001
- **Backend API**: http://localhost:8080
- **WebSocket**: ws://localhost:8080

## How It Works

### Backend (`demo/backend/server.js`)
- WebSocket-enabled Express server on port 8080
- Runs the same cross-chain test logic as your existing `cross-chain-happy-path-test.js`
- Broadcasts real-time events: `test_started`, `lock_created`, `withdrawal_completed`, etc.
- REST API endpoints: `/start-test`, `/stop-test`, `/health`

### Frontend (`demo/frontend/`)
- Next.js dashboard on port 3001 (to avoid conflicts)
- WebSocket client that subscribes to backend events
- Real-time progress bars, transaction links, and log streaming
- Responsive design with Tailwind CSS

## Event Flow

1. **User clicks "Start Swap Test"** in the web interface
2. **Frontend sends POST** to `http://localhost:8080/start-test`
3. **Backend runs your existing test logic** with event emission at each step
4. **WebSocket broadcasts events** like:
   - `test_started` → Progress bar appears
   - `approval_completed` → Shows transaction hash + explorer link
   - `lock_created` → Updates progress, adds transaction to list
   - `withdrawal_completed` → Shows secret reveal flow
   - `test_completed` → Final success state
5. **Frontend updates in real-time** as events stream in

## Demo Flow

When you run the demo, you'll see:

1. **Connection Status**: Green "Connected" indicator when WebSocket is active
2. **Chain Status Cards**: Shows Ethereum Sepolia and Tron Nile connectivity
3. **Progress Bar**: Real-time progress through 7 test phases (0% → 100%)
4. **Live Transactions**: As transactions are created, they appear with:
   - Chain icons (⟠ for Ethereum, ◆ for Tron)
   - Transaction type (approval, lock, withdraw)
   - Clickable links to block explorers
5. **Live Logs**: Streaming console with timestamps and event types
6. **Final Result**: Success message with complete transaction summary

## Customization

### Adding New Events
In `backend/server.js`:
```javascript
this.broadcast('custom_event', { 
  message: 'Custom step completed',
  txHash: 'transaction_hash_here'
})
```

In `frontend/app/page.tsx`:
```typescript
case 'custom_event':
  setCurrentStep('Custom Step Complete')
  setProgress(prev => prev + 10)
  break
```

### Styling
The frontend uses Tailwind CSS with custom component classes in `globals.css`:
- `.card` - White background panels
- `.btn-primary` - Blue action buttons  
- `.log-info`, `.log-success`, `.log-error` - Colored log entries

## Troubleshooting

### WebSocket Connection Issues
- Make sure backend is running on port 8080
- Check that no firewall is blocking WebSocket connections
- Frontend will auto-reconnect every 3 seconds if connection drops

### Test Execution Issues
- Verify your `.env` file has valid private keys and RPC URLs
- Check that you have sufficient testnet tokens for transactions
- Backend logs will show detailed error messages

### Port Conflicts
- Backend runs on port 8080
- Frontend runs on port 3001 (configured in package.json)
- Both can be changed in their respective configuration files

This demo transforms your console-based cross-chain test into a professional web interface that you can use for presentations, debugging, or demonstrations!