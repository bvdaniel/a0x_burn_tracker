import { cache } from 'react';

interface A0xAgent {
  agentId: string;
  name?: string;
  status: string;
  imageUrl?: string;
  walletAddress?: string;
  connectedWith?: Array<{
    app: string;
    name: string;
    imageUrl?: string;
    username: string;
  }>;
  farcasterClient?: {
    username: string;
    fid?: number;
  };
  twitterClient?: {
    username: string;
    email: string;
    profileImageUrl: string;
  };
}

interface AgentInfo {
  name: string;
  imageUrl: string;
  socials?: {
    x?: string;
    farcaster?: string;
    telegram?: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_A0X_MIRROR_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_A0X_MIRROR_API_KEY;

// Immediately log environment status
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  hasApiUrl: !!API_URL,
  hasApiKey: !!API_KEY
});

if (!API_URL || !API_KEY) {
  console.error('A0x Mirror API configuration is missing:', {
    url: API_URL ? 'set' : 'missing',
    key: API_KEY ? 'set' : 'missing'
  });
}

const isEthereumAddress = (id: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(id);
};

// Default avatar from our public directory
const DEFAULT_AVATAR = '/default-agent.png';

function getImageFromConnections(agent: A0xAgent): string {
  if (agent.imageUrl) return agent.imageUrl;
  
  if (agent.connectedWith?.length) {
    const xProfile = agent.connectedWith.find(c => c.app.toLowerCase() === 'x');
    if (xProfile?.imageUrl) return xProfile.imageUrl;
  }
  
  if (agent.twitterClient?.profileImageUrl) {
    return agent.twitterClient.profileImageUrl;
  }

  // Add fallback for Twitter usernames using unavatar.io
  if (agent.twitterClient?.username) {
    return `https://unavatar.io/twitter/${agent.twitterClient.username}`;
  }
  
  return DEFAULT_AVATAR;
}

function getSocialLinks(agent: A0xAgent): AgentInfo['socials'] {
  const socials: AgentInfo['socials'] = {};

  // Get X/Twitter handle from connectedWith
  const xProfile = agent.connectedWith?.find(c => 
    c.app.toLowerCase() === 'x' || c.app.toLowerCase() === 'twitter'
  );
  if (xProfile?.username) {
    socials.x = `https://x.com/${xProfile.username}`;
  } else if (agent.twitterClient?.username) {
    socials.x = `https://x.com/${agent.twitterClient.username}`;
  }

  // Get Farcaster handle
  if (agent.farcasterClient?.username) {
    socials.farcaster = `https://warpcast.com/${agent.farcasterClient.username}`;
  }

  return Object.keys(socials).length > 0 ? socials : undefined;
}

const truncateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getAgentNames = cache(async (agentIds: string[]): Promise<Map<string, AgentInfo>> => {
  try {
    console.log('=== A0x Mirror API Debug ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Fetching agent names for:', agentIds);

    // If API configuration is missing, return default profiles
    if (!API_URL || !API_KEY) {
      console.warn('API configuration missing, returning default profiles');
      return new Map(agentIds.map(id => {
        const shortId = isEthereumAddress(id) 
          ? truncateAddress(id)
          : id.slice(0, 8);
        return [id, { 
          name: `Agent ${shortId}`, 
          imageUrl: DEFAULT_AVATAR 
        }];
      }));
    }

    // Use our proxy endpoint instead of calling the API directly
    const response = await fetch(process.env.NODE_ENV === 'production' 
      ? `${window.location.origin}/api/a0x-mirror`
      : '/api/a0x-mirror', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }).catch(fetchError => {
      console.error('Fetch error details:', {
        message: fetchError.message,
        type: fetchError.type,
        name: fetchError.name
      });
      // Return default profiles on fetch error
      return null;
    });

    // If response is null (fetch error) or not ok, return default profiles
    if (!response || !response.ok) {
      console.warn('API request failed, returning default profiles');
      return new Map(agentIds.map(id => {
        const shortId = isEthereumAddress(id) 
          ? truncateAddress(id)
          : id.slice(0, 8);
        return [id, { 
          name: `Agent ${shortId}`, 
          imageUrl: DEFAULT_AVATAR 
        }];
      }));
    }

    const responseText = await response.text().catch(e => {
      console.error('Failed to read response body:', e);
      return '[]';
    });

    let agents: A0xAgent[];
    try {
      agents = JSON.parse(responseText);
      console.log('Successfully parsed JSON. Found agents:', agents.length);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      // Return default profiles on parse error
      return new Map(agentIds.map(id => {
        const shortId = isEthereumAddress(id) 
          ? truncateAddress(id)
          : id.slice(0, 8);
        return [id, { 
          name: `Agent ${shortId}`, 
          imageUrl: DEFAULT_AVATAR 
        }];
      }));
    }

    const agentMap = new Map<string, AgentInfo>();
    agents.forEach(agent => {
      if (agent.agentId) {
        console.log('Processing agent:', {
          id: agent.agentId,
          name: agent.name,
          hasImage: !!agent.imageUrl,
          hasWallet: !!agent.walletAddress
        });
        const imageUrl = getImageFromConnections(agent);
        const socials = getSocialLinks(agent);
        
        agentMap.set(agent.agentId.toLowerCase(), {
          name: agent.name || truncateAddress(agent.agentId),
          imageUrl,
          ...(socials && { socials })
        });

        // If the agent has a wallet address, also map by that
        if (agent.walletAddress) {
          const walletKey = agent.walletAddress.toLowerCase();
          agentMap.set(walletKey, {
            name: agent.name || truncateAddress(agent.agentId),
            imageUrl,
            ...(socials && { socials })
          });
        }
      }
    });

    // Second pass: Look up each requested ID
    agentIds.forEach(id => {
      // For Ethereum addresses, try lowercase lookup
      const lookupId = isEthereumAddress(id) ? id.toLowerCase() : id;
      
      if (!agentMap.has(lookupId)) {
        console.log('Agent not found in A0x Mirror API:', id);
        const shortId = isEthereumAddress(id) 
          ? truncateAddress(id)
          : id.slice(0, 8);
        agentMap.set(id, {
          name: `Agent ${shortId}`,
          imageUrl: DEFAULT_AVATAR
        });
      }
    });

    return agentMap;
  } catch (error) {
    console.error('Error fetching agent names:', error);
    // Provide fallback names for all agents in case of API failure
    return new Map(agentIds.map(id => {
      const shortId = isEthereumAddress(id) 
        ? truncateAddress(id)
        : id.slice(0, 8);
      return [id, { 
        name: `Agent ${shortId}`, 
        imageUrl: DEFAULT_AVATAR 
      }];
    }));
  }
}); 