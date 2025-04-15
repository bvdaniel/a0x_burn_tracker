import { ExtensionEvent } from '../types';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { UserIcon } from '@heroicons/react/24/solid';
import { truncateAddress } from '../utils/format';

interface RecentExtensionsProps {
  extensions: ExtensionEvent[];
  agentNames: Map<string, { name: string; imageUrl?: string }>;
}

const DEFAULT_AVATAR = '/default-agent.png';

export default function RecentExtensions({ extensions, agentNames }: RecentExtensionsProps) {
  return (
    <div className="bg-black rounded-2xl border border-[#2F3336] p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#E7E9EA]">Recent Extensions</h2>
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#2F3336] scrollbar-track-transparent">
        {extensions.map((extension) => {
          const agent = agentNames.get(extension.agentId);
          return (
            <div
              key={extension.id}
              className="flex items-start gap-3 p-3 hover:bg-black/60 transition-all duration-200 rounded-xl border border-[#2F3336]/50"
            >
              <div className="flex-shrink-0">
                {agent?.imageUrl ? (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden">
                    <Image
                      src={agent.imageUrl}
                      alt={agent.name || extension.agentId}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-[#2F3336] rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-[#71767B]" />
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-[#E7E9EA] truncate">
                    {agent?.name || truncateAddress(extension.agentId)}
                  </span>
                  <span className="text-xs text-[#71767B] flex-shrink-0 ml-2">
                    {formatDistanceToNow(extension.timestamp)} ago
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#1D9BF0] font-medium">
                    +{extension.duration} days
                  </span>
                  <span className="text-sm text-[#F7931A] font-medium">
                    {extension.a0xBurned.toLocaleString()} A0X
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