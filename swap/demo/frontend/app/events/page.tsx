'use client'

import React, { useState, useEffect } from 'react'
import { Play, Square, Wifi, WifiOff, RotateCcw, Users } from 'lucide-react'

interface LogEntry {
  timestamp: string
  type: string
  data: any
}

export default function EventsPage() {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [mockMode, setMockMode] = useState(false)

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

    // Handle connection and running state
    if (message.type === 'connection') {
      setRunning(message.data.running || false)
    } else if (message.type === 'test_started') {
      setRunning(true)
    } else if (['test_completed', 'test_failed', 'stopped'].includes(message.type)) {
      setRunning(false)
    }
  }

  const startNormalSwap = async () => {
    try {
      const response = await fetch('http://localhost:8080/start-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mockMode, bobInitiates: false })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start normal swap')
      }
      
      console.log('Normal swap started (Alice initiates)')
    } catch (error) {
      console.error('Error starting normal swap:', error)
      alert('Failed to start swap. Make sure the backend server is running.')
    }
  }

  const startReversedSwap = async () => {
    try {
      const response = await fetch('http://localhost:8080/start-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mockMode, bobInitiates: true })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start reversed swap')
      }
      
      console.log('Reversed swap started (Bob initiates)')
    } catch (error) {
      console.error('Error starting reversed swap:', error)
      alert('Failed to start reversed swap. Make sure the backend server is running.')
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

  const clearLogs = () => {
    setLogs([])
  }

  const formatEventData = (data: any) => {
    if (!data) return 'No data'
    if (typeof data === 'string') return data
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2)
    }
    return String(data)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🔄 Cross-Chain Events Monitor
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
                  onClick={() => setMockMode(!mockMode)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    mockMode 
                      ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  🎭 {mockMode ? 'MOCK' : 'LIVE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Swap Initialization</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Normal Swap */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Users className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-medium text-blue-900">Normal Swap</h3>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                Alice (ETH) initiates → Bob (TRON) responds
              </p>
              <button
                onClick={startNormalSwap}
                disabled={!connected || running}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Normal</span>
              </button>
            </div>

            {/* Reversed Swap */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <RotateCcw className="w-5 h-5 text-purple-600 mr-2" />
                <h3 className="font-medium text-purple-900">Reversed Swap</h3>
              </div>
              <p className="text-sm text-purple-700 mb-3">
                Bob (TRON) initiates → Alice (ETH) responds
              </p>
              <button
                onClick={startReversedSwap}
                disabled={!connected || running}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Start Reversed</span>
              </button>
            </div>

            {/* Stop */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Square className="w-5 h-5 text-red-600 mr-2" />
                <h3 className="font-medium text-red-900">Stop Test</h3>
              </div>
              <p className="text-sm text-red-700 mb-3">
                Stop any running swap test
              </p>
              <button
                onClick={stopTest}
                disabled={!connected || !running}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Event Stream */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-lg font-semibold">Live Event Stream</h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{logs.length} events</span>
              <button 
                onClick={clearLogs} 
                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1 border border-gray-300 rounded"
              >
                Clear
              </button>
            </div>
          </div>
          
          <div className="h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No events yet. Start a swap to see live updates.</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {logs.map((log, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.type.includes('completed') || log.type.includes('created') 
                            ? 'bg-green-100 text-green-800'
                            : log.type.includes('failed') || log.type.includes('error')
                            ? 'bg-red-100 text-red-800'
                            : log.type.includes('started')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {log.data?.mockMode && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            MOCK
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <pre className="whitespace-pre-wrap font-mono text-xs bg-white p-2 rounded border overflow-x-auto">
                        {formatEventData(log.data)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Main Dashboard
          </a>
        </div>
      </main>
    </div>
  )
} 