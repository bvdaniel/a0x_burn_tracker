import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { cookieStorage, createStorage } from 'wagmi'
import { base } from 'wagmi/chains'

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
}

// Get projectId
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Create wagmiConfig
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
  }),
  enableWalletConnect: true, // This ensures WalletConnect is properly initialized
  enableInjected: true, // This enables MetaMask and other injected wallets
  enableEIP6963: true, // This enables EIP-6963 support for better wallet detection
  enableCoinbase: false, // Disable Coinbase SDK to reduce bundle size
}) 