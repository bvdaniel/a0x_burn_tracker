'use client'

import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "../components/WalletProvider";
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  adjustFontFallback: true
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          {children}
          <Toaster position="bottom-right" />
        </WalletProvider>
      </body>
    </html>
  );
}
