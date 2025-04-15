import Link from 'next/link';

const SOCIAL_LINKS = [
  {
    name: 'Telegram',
    href: 'https://t.me/a0x_co',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.48-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.12.098.153.228.166.331.032.259.015.839-.014 1.466z"/>
      </svg>
    )
  },
  {
    name: 'X',
    href: 'https://x.com/a0xbot',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  {
    name: 'Farcaster',
    href: 'https://warpcast.com/a0xbot',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.063 3.505c-4.502 0-8.154 3.61-8.154 8.062 0 4.452 3.652 8.063 8.154 8.063v-2.88c-2.883 0-5.225-2.317-5.225-5.182 0-2.865 2.342-5.182 5.225-5.182 2.883 0 5.225 2.317 5.225 5.182h2.929c0-4.452-3.652-8.062-8.154-8.062zM21.091 12.093h-10.028v8.063h2.929v-5.182h7.099z"/>
      </svg>
    )
  }
];

const PLATFORM_LINKS = [
  {
    name: 'DEX Screener',
    href: 'https://dexscreener.com/base/0xa1a65c284a2e01f0d9c9683edeab30d0835d1362',
  },
  {
    name: 'A0X Website',
    href: 'https://a0x.co',
  }
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#2F3336] bg-black/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {SOCIAL_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#71767B] hover:text-white transition-colors duration-200"
                title={link.name}
              >
                {link.icon}
              </Link>
            ))}
          </div>
          
          <div className="flex items-center gap-6">
            {PLATFORM_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#71767B] hover:text-white text-sm transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}
          </div>
          
          <div className="text-[#71767B] text-sm">
            Built with 🔥 by the A0X community
          </div>
        </div>
      </div>
    </footer>
  );
} 