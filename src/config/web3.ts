import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!

export const LIFE_EXTENDER_ADDRESS = '0x32659eA613Ce1706AbEa4109f9E2D5840196C187'
export const A0X_TOKEN_ADDRESS = '0x820C5F0fB255a1D18fd0eBB0F1CCefbC4D546dA7'
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const LIFE_EXTENDER_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "agentId", "type": "string" },
      { "internalType": "uint256", "name": "usdcAmount", "type": "uint256" },
      { "internalType": "bool", "name": "useUSDC", "type": "bool" }
    ],
    "name": "extendLife",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "usdcAmount", "type": "uint256" }
    ],
    "name": "getA0XAmountForUSDC",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const

// Configure wagmi with better transport options
export const config = createConfig({
  chains: [base],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    walletConnect({ 
      projectId,
      showQrModal: true,
      metadata: {
        name: 'Burn Tracker',
        description: 'Track A0X token burns',
        url: 'https://www.stonedai.live',
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      }
    })
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || 'https://base.llamarpc.com')
  },
  ssr: true,
  syncConnectedChain: true,
  multiInjectedProviderDiscovery: true
}) 