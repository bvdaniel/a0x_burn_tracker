'use client';

import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig } from 'wagmi'
import { config } from '../config/web3'
import { useEffect, useState } from 'react'

// Create query client
const queryClient = new QueryClient()

// Initialize Web3Modal configuration
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!
const metadata = {
  name: 'Burn Tracker',
  description: 'Track A0X token burns',
  url: 'https://www.stonedai.live', // Update with your production URL
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const wagmiConfig = defaultWagmiConfig({ 
  chains: config.chains, 
  projectId, 
  metadata,
  enableWalletConnect: true,
  enableInjected: true,
  enableEIP6963: true,
  enableCoinbase: true,
})

createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: true,
  enableOnramp: true,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-z-index': 1000,
  },
  defaultChain: config.chains[0],
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Clear any stale WalletConnect data on mount
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wagmi.wallet')
      localStorage.removeItem('wagmi.connected')
      localStorage.removeItem('wagmi.injected.connected')
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