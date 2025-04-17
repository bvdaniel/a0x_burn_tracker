import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { cookieStorage, createStorage } from 'wagmi'
import { base } from 'viem/chains'

// Ensure WalletConnect Project ID exists
if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Create wagmiConfig with explicit chain configuration
export const config = defaultWagmiConfig({
  chains: [base], // Base chain only
  projectId,
  metadata: {
    name: 'A0X Burn Tracker',
    description: 'Track A0X burns and life extensions',
    url: 'https://burntracker.a0x.network',
    icons: ['https://burntracker.a0x.network/favicon.ico']
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  })
}) 