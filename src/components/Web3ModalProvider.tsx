'use client';

import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { WagmiConfig } from 'wagmi';
import { arbitrum } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const metadata = {
  name: 'Burn Tracker',
  description: 'Track A0X burns and life extensions',
  url: 'https://burntracker.vercel.app',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

const wagmiConfig = defaultWagmiConfig({
  chains: [arbitrum],
  projectId,
  metadata
});

createWeb3Modal({
  wagmiConfig,
  projectId,
  themeMode: 'dark'
});

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>;
} 