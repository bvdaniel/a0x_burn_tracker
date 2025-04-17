'use client';

import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig } from 'wagmi'
import { config } from '../config/web3'
import { useEffect, useState } from 'react'

// Create query client
const queryClient = new QueryClient()

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Initialize wagmi config
const wagmiConfig = defaultWagmiConfig({
  chains: config.chains,
  projectId,
  metadata: {
    name: 'A0X Burn Tracker',
    description: 'Track A0X burns and life extensions',
    url: 'https://burntracker.a0x.network',
    icons: ['https://burntracker.a0x.network/favicon.ico']
  }
})

// Initialize modal once
createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: false, // Disable analytics to avoid 403 errors
  enableOnramp: false, // Disable onramp to avoid 403 errors
  themeMode: 'dark'
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize on client side only
    if (typeof window !== 'undefined') {
      // Clear any stale WalletConnect data
      const staleKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('wc@2') || 
        key.startsWith('wagmi') ||
        key.startsWith('web3modal')
      )
      staleKeys.forEach(key => localStorage.removeItem(key))
      setIsInitialized(true)
    }
  }, [])

  if (!isInitialized) {
    return null; // or a loading spinner
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  )
} 