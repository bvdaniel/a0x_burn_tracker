import { ExtensionEvent } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { UserIcon } from '@heroicons/react/24/outline';

const truncateAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

interface RecentExtensionsProps {
  extensions: ExtensionEvent[];
  agentNames: Map<string, { name: string; imageUrl?: string }>;
}

const DEFAULT_AVATAR = '/default-agent.png';

export default function RecentExtensions({ extensions, agentNames }: RecentExtensionsProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm">
      <h2 className="text-xl font-bold mb-4 text-slate-200">Recent Extensions</h2>
      <div className="space-y-4">
        {extensions.map((extension) => {
          const agent = agentNames.get(extension.agentId);
          return (
            <div
              key={extension.id}
              className="flex items-center gap-4 bg-slate-700/30 rounded-lg p-4 hover:bg-slate-700/40 transition-colors"
            >
              <div className="flex-shrink-0">
                {agent?.imageUrl ? (
                  <Image
                    src={agent.imageUrl}
                    alt={agent.name || extension.agentId}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200">
                    {agent?.name || truncateAddress(extension.agentId)}
                  </span>
                  <span className="text-sm text-slate-400">
                    {formatDistanceToNow(extension.timestamp)} ago
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-slate-300">
                    +{extension.duration} days
                  </span>
                  <span className="text-amber-500">
                    {extension.a0xBurned.toLocaleString()} A0X burned
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 