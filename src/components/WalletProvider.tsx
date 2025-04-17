'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { State, WagmiProvider } from 'wagmi'
import { config } from '../config/web3'
import { useEffect, useState } from 'react'

// Create query client
const queryClient = new QueryClient()

export function WalletProvider({
  children,
  initialState
}: {
  children: React.ReactNode
  initialState?: State
}) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize Web3Modal on client side only
    if (typeof window !== 'undefined') {
      createWeb3Modal({
        wagmiConfig: config,
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        enableAnalytics: true,
        enableOnramp: true
      })

      // Clear any stale WalletConnect data
      try {
        localStorage.removeItem('wagmi.wallet')
        localStorage.removeItem('wagmi.connected')
        localStorage.removeItem('wagmi.injected')
      } catch (e) {
        console.warn('Failed to clear local storage:', e)
      }

      setIsInitialized(true);
    }
  }, [])

  if (!isInitialized) {
    return null; // or a loading spinner
  }

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
} 