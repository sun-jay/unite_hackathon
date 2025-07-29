'use client'

import React, { useState, useEffect } from 'react'
import { Play, Square, Wifi, WifiOff, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle, Timer, Lock, Unlock } from 'lucide-react'

interface LogEntry {
  timestamp: string
  type: string
  data: any
}

interface ChainState {
  name: string
  connected: boolean
  icon: string
  color: string
  lockCreated: boolean
  lockWithdrawn: boolean
  lockRefunded: boolean
  timelock: number | null
  txHash: string | null
  explorerUrl: string | null
  amount: string | null
  balance: string | null
  role?: string | null
  amountLocked?: string | null
  participantInfo?: any
}

export default function DashboardPage() {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [transactions, setTransactions] = useState<{[key: string]: string}>({})
  const [secret, setSecret] = useState<string>('')
  const [hashLock, setHashLock] = useState<string>('')
  const [secretRevealed, setSecretRevealed] = useState(false)
  const [mockMode, setMockMode] = useState(false)

  const [chainStates, setChainStates] = useState<{[key: string]: ChainState}>({
    sepolia: {
      name: 'Ethereum Sepolia',
      connected: false,
      icon: '⟠',
      color: 'blue',
      lockCreated: false,
      lockWithdrawn: false,
      lockRefunded: false,
      timelock: null,
      txHash: null,
      explorerUrl: null,
      amount: null,
      balance: null
    },
    nile: {
      name: 'Tron Nile',
      connected: false,
      icon: '◆',
      color: 'red',
      lockCreated: false,
      lockWithdrawn: false,
      lockRefunded: false,
      timelock: null,
      txHash: null,
      explorerUrl: null,
      amount: null,
      balance: null
    }
  })

  // Timer states
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const websocket = new WebSocket('ws://localhost:8080')
        
        websocket.onopen = () => {
          console.log('WebSocket connected')
          setConnected(true)
          setWs(websocket)
        }

        websocket.onclose = () => {
          console.log('WebSocket disconnected')
          setConnected(false)
          setWs(null)
          setTimeout(connectWebSocket, 3000)
        }

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          setConnected(false)
        }

        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleWebSocketMessage(message)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

      } catch (error) {
        console.error('Failed to connect WebSocket:', error)
        setTimeout(connectWebSocket, 3000)
      }
    }

    connectWebSocket()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  const handleWebSocketMessage = (message: any) => {
    const logEntry: LogEntry = {
      timestamp: message.timestamp || new Date().toISOString(),
      type: message.type,
      data: message.data
    }

    setLogs(prev => [logEntry, ...prev].slice(0, 100))

    // Handle different message types
    switch (message.type) {
      case 'connection':
        setRunning(message.data.running || false)
        break

      case 'test_started':
        setRunning(true)
        setProgress(0)
        setCurrentStep('Initializing...')
        setTransactions({})
        setSecret('')
        setHashLock('')
        setSecretRevealed(false)
        // Reset chain states
        setChainStates(prev => ({
          sepolia: { ...prev.sepolia, connected: true, lockCreated: false, lockWithdrawn: false, lockRefunded: false, timelock: null, txHash: null, explorerUrl: null },
          nile: { ...prev.nile, connected: true, lockCreated: false, lockWithdrawn: false, lockRefunded: false, timelock: null, txHash: null, explorerUrl: null }
        }))
        break

      case 'constants_generated':
        setSecret(message.data.secret || '')
        setHashLock(message.data.hashLock || '')
        setCurrentStep('Constants Generated')
        setProgress(15)
        break

      case 'amounts_calculated':
        setCurrentStep('Token Amounts Calculated')
        setProgress(25)
        // Update amounts with new backend structure
        setChainStates(prev => ({
          sepolia: { 
            ...prev.sepolia, 
            amount: message.data.sepolia?.formatted || null,
            role: message.data.sepolia?.role || null
          },
          nile: { 
            ...prev.nile, 
            amount: message.data.nile?.formattedForAlice || message.data.nile?.formatted || null,
            amountLocked: message.data.nile?.formattedLocked || null,
            role: message.data.nile?.role || null
          }
        }))
        break

      case 'swap_participants':
        // Handle the new swap participants info
        setChainStates(prev => ({
          sepolia: { 
            ...prev.sepolia, 
            participantInfo: message.data.bob || null
          },
          nile: { 
            ...prev.nile, 
            participantInfo: message.data.alice || null
          }
        }))
        break

      case 'balances_checked':
        setCurrentStep('Balances Verified')
        setProgress(35)
        // Update balances
        setChainStates(prev => ({
          sepolia: { ...prev.sepolia, balance: message.data.sepolia || null },
          nile: { ...prev.nile, balance: message.data.nile || null }
        }))
        break

      case 'timelocks_set':
        // Don't update timelocks in chain state yet - wait for actual lock creation
        // This prevents showing timers before locks are created on-chain
        break

      case 'lock_created':
        const lockChain = message.data.chain === 'sepolia' ? 'sepolia' : 'nile'
        setCurrentStep(`${message.data.chain} Lock Created`)
        setProgress(prev => prev + 20)
        
        setChainStates(prev => ({
          ...prev,
          [lockChain]: {
            ...prev[lockChain],
            lockCreated: true,
            txHash: message.data.txHash,
            explorerUrl: message.data.explorerUrl,
            // Only set timelock when lock is actually confirmed on-chain
            timelock: message.data.timelock,
            actualLockTime: message.data.actualLockTime || message.data.blockTimestamp,
            timeDifference: message.data.timeDifference
          }
        }))
        
        if (message.data.txHash) {
          setTransactions(prev => ({
            ...prev,
            [`${message.data.chain}_lock`]: message.data.txHash
          }))
        }
        break

      case 'withdrawal_completed':
        const withdrawChain = message.data.chain === 'sepolia' ? 'sepolia' : 'nile'
        setCurrentStep(`${message.data.chain} Withdrawal Complete`)
        setProgress(prev => prev + 20)
        
        if (message.data.secretRevealed) {
          setSecretRevealed(true)
        }
        
        setChainStates(prev => ({
          ...prev,
          [withdrawChain]: {
            ...prev[withdrawChain],
            lockWithdrawn: true
          }
        }))
        
        if (message.data.txHash) {
          setTransactions(prev => ({
            ...prev,
            [`${message.data.chain}_withdraw`]: message.data.txHash
          }))
        }
        break

      case 'test_completed':
        setRunning(false)
        setProgress(100)
        setCurrentStep('Cross-Chain Swap Completed!')
        break

      case 'test_failed':
        setRunning(false)
        setCurrentStep('Test Failed')
        break

      case 'stopped':
        setRunning(false)
        setCurrentStep('Test Stopped')
        break
    }
  }

  const startTest = async () => {
    try {
      const response = await fetch('http://localhost:8080/start-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mockMode })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start test')
      }
      
      console.log('Test started successfully')
    } catch (error) {
      console.error('Error starting test:', error)
      alert('Failed to start test. Make sure the backend server is running.')
    }
  }

  const stopTest = async () => {
    try {
      const response = await fetch('http://localhost:8080/stop-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error('Failed to stop test')
      }
      
      console.log('Test stopped successfully')
    } catch (error) {
      console.error('Error stopping test:', error)
    }
  }

  const toggleMockMode = async () => {
    try {
      const response = await fetch('http://localhost:8080/toggle-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setMockMode(data.mockMode)
        console.log(`Mock mode ${data.mockMode ? 'enabled' : 'disabled'}`)
      }
    } catch (error) {
      console.error('Error toggling mock mode:', error)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  const formatTimeRemaining = (timelock: number) => {
    if (!timelock) return 'Not set'
    
    const remaining = timelock - currentTime
    if (remaining <= 0) return 'Expired'
    
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const seconds = remaining % 60
    
    return `${hours}h ${minutes}m ${seconds}s`
  }

  const getTimelockColor = (timelock: number) => {
    if (!timelock) return 'text-gray-500'
    
    const remaining = timelock - currentTime
    if (remaining <= 0) return 'text-red-600'
    if (remaining <= 1800) return 'text-orange-500' // 30 minutes
    return 'text-green-600'
  }

  const ChainCard = ({ chainKey, chain }: { chainKey: string, chain: ChainState }) => (
    <div className={`p-8 rounded-2xl border-2 bg-white shadow-lg transition-all duration-500 ${
      chain.lockCreated ? 'border-green-300 bg-green-50' : 
      chain.connected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
    }`}>
      {/* Chain Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-5xl">{chain.icon}</span>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{chain.name}</h3>
            <div className={`flex items-center space-x-2 text-sm ${chain.connected ? 'text-green-600' : 'text-gray-500'}`}>
              <div className={`w-3 h-3 rounded-full ${chain.connected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span>{chain.connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
        
        {/* Lock Status Icon */}
        <div className="text-right">
          {chain.lockWithdrawn ? (
            <div className="flex items-center text-green-600">
              <Unlock className="w-8 h-8 mr-2" />
              <span className="text-lg font-semibold">Withdrawn</span>
            </div>
          ) : chain.lockCreated ? (
            <div className="flex items-center text-blue-600">
              <Lock className="w-8 h-8 mr-2" />
              <span className="text-lg font-semibold">Locked</span>
            </div>
          ) : (
            <div className="flex items-center text-gray-400">
              <Lock className="w-8 h-8 mr-2" />
              <span className="text-lg font-semibold">No Lock</span>
            </div>
          )}
        </div>
      </div>

      {/* Token Info */}
      {chain.amount && (
        <div className="bg-white p-4 rounded-lg border mb-4">
          <h4 className="font-semibold text-gray-700 mb-2">Token Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Lock Amount:</span>
              <p className="font-mono font-semibold">{chain.amount} tokens</p>
            </div>
            <div>
              <span className="text-gray-600">Current Balance:</span>
              <p className="font-mono font-semibold">{chain.balance || 'Loading...'} tokens</p>
            </div>
          </div>
        </div>
      )}

      {/* Timelock Info */}
      {chain.timelock && (
        <div className="bg-white p-4 rounded-lg border mb-4">
          <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
            <Timer className="w-4 h-4 mr-2" />
            Timelock Information
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Expires:</span>
              <p className="font-mono">{new Date(chain.timelock * 1000).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-600">Time Remaining:</span>
              <p className={`font-mono font-semibold ${getTimelockColor(chain.timelock)}`}>
                {formatTimeRemaining(chain.timelock)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Links */}
      {chain.lockCreated && chain.txHash && (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-700">Transactions</h4>
          <div className="space-y-2">
            <a 
              href={chain.explorerUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div>
                <p className="font-medium text-blue-900">Lock Transaction</p>
                <p className="text-sm text-blue-700 font-mono">{chain.txHash.slice(0, 20)}...</p>
              </div>
              <ExternalLink className="w-5 h-5 text-blue-600" />
            </a>
            
            {chain.lockWithdrawn && transactions[`${chainKey}_withdraw`] && (
              <a 
                href={chainKey === 'sepolia' 
                  ? `https://sepolia.etherscan.io/tx/${transactions[`${chainKey}_withdraw`]}`
                  : `https://nile.tronscan.org/#/transaction/${transactions[`${chainKey}_withdraw`]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-green-900">Withdraw Transaction</p>
                  <p className="text-sm text-green-700 font-mono">{transactions[`${chainKey}_withdraw`].slice(0, 20)}...</p>
                </div>
                <ExternalLink className="w-5 h-5 text-green-600" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🌐 Cross-Chain Atomic Swap Demo
              </h1>
              <div className="flex items-center space-x-2">
                {connected ? (
                  <div className="flex items-center text-green-600">
                    <Wifi className="w-4 h-4 mr-1" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <WifiOff className="w-4 h-4 mr-1" />
                    <span className="text-sm">Disconnected</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMockMode}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    mockMode 
                      ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  🎭 {mockMode ? 'MOCK' : 'LIVE'}
                </button>
              </div>
              
              <button
                onClick={startTest}
                disabled={!connected || running}
                className="btn-primary flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Swap Test</span>
              </button>
              
              <button
                onClick={stopTest}
                disabled={!connected || !running}
                className="btn-secondary flex items-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop Test</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress and Status */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Test Progress</h2>
            <span className="text-lg font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-lg text-gray-700">{currentStep}</p>
          
          {/* Secret and Hash Display */}
          {(secret || hashLock) && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {hashLock && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-700 mb-2">Hash Lock</h4>
                  <p className="font-mono text-sm text-gray-600 break-all">{hashLock}</p>
                </div>
              )}
              {secret && (
                <div className={`p-4 rounded-lg ${secretRevealed ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                    Secret {secretRevealed && <span className="ml-2 text-green-600">(Revealed!)</span>}
                  </h4>
                  <p className="font-mono text-sm text-gray-600 break-all">{secret}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visual Flow Indicator - Above Split View */}
        {(chainStates.sepolia.lockCreated || chainStates.nile.lockCreated) && (
          <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Swap Flow Status</h3>
            <div className="flex items-center justify-center space-x-4">
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                chainStates.sepolia.lockCreated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <span className="text-2xl">⟠</span>
                <span>Sepolia Lock</span>
                {chainStates.sepolia.lockCreated && <CheckCircle className="w-5 h-5" />}
              </div>
              
              <div className="flex-1 h-1 bg-gradient-to-r from-blue-300 to-red-300 rounded"></div>
              
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                secretRevealed ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <span>🔐</span>
                <span>Secret {secretRevealed ? 'Revealed' : 'Hidden'}</span>
                {secretRevealed && <CheckCircle className="w-5 h-5" />}
              </div>
              
              <div className="flex-1 h-1 bg-gradient-to-r from-red-300 to-blue-300 rounded"></div>
              
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                chainStates.nile.lockCreated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <span className="text-2xl">◆</span>
                <span>Tron Lock</span>
                {chainStates.nile.lockCreated && <CheckCircle className="w-5 h-5" />}
              </div>
            </div>
          </div>
        )}

        {/* Main Chain Visualization - Horizontal Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChainCard chainKey="sepolia" chain={chainStates.sepolia} />
          <ChainCard chainKey="nile" chain={chainStates.nile} />
        </div>

        {/* Live Logs */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-lg font-semibold">Live Activity Logs</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{logs.length} entries</span>
              <button onClick={clearLogs} className="text-xs text-gray-400 hover:text-gray-600">
                Clear
              </button>
            </div>
          </div>
          
          <div className="h-64 overflow-y-auto p-6">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No activity yet. Start a test to see live updates.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                    <div className="flex-shrink-0 mt-1">
                      {log.type.includes('completed') || log.type.includes('created') ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : log.type.includes('failed') ? (
                        <XCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-gray-900">{log.type.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {log.data?.message && (
                        <p className="text-sm text-gray-600 mt-1">{log.data.message}</p>
                      )}
                      {log.data?.chain && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mt-1 inline-block">
                          {log.data.chain}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}