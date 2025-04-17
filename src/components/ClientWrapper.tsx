'use client'

import { WalletProvider } from "./WalletProvider"
import { Toaster } from 'react-hot-toast'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
      <Toaster position="bottom-right" />
    </WalletProvider>
  )
} 