import { cache } from 'react';

interface A0xAgent {
  id: string;
  name?: string;
  image?: string;
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
  image: string | null;
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

function getImageFromConnections(agent: A0xAgent): string | undefined {
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
  
  return undefined;
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
    console.log('Fetching agent names for:', agentIds);
    console.log('Using API URL:', API_URL);
    
    if (!API_URL || !API_KEY) {
      throw new Error('A0x Mirror API configuration is missing');
    }
    
    const response = await fetch(API_URL + '/agents', {
      headers: {
        'User-Agent': 'burntracker/1.0',
        'x-api-key': API_KEY,
        'Accept': 'application/json'
      }
    });

    // Log the response status and headers
    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error response:', errorText);
      throw new Error(`Failed to fetch agent data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const agents: A0xAgent[] = await response.json();
    console.log('Successfully fetched agents:', agents.length);
    
    const agentMap = new Map<string, AgentInfo>();
    agents.forEach(agent => {
      if (agent.id) {
        console.log('Processing agent:', agent.id, 'Name:', agent.name);
        agentMap.set(agent.id.toLowerCase(), {
          name: agent.name || truncateAddress(agent.id),
          image: agent.image || null
        });
      }
    });

    // Second pass: Look up each requested ID
    agentIds.forEach(id => {
      // For Ethereum addresses, try lowercase lookup
      const lookupId = isEthereumAddress(id) ? id.toLowerCase() : id;
      
      if (!agentMap.has(lookupId)) {
        console.log('Agent not found in A0x Mirror API:', id);
        const shortId = isEthereumAddress(id) 
          ? `${id.slice(0, 6)}...${id.slice(-4)}`
          : id.slice(0, 8);
        agentMap.set(id, {
          name: `Agent ${shortId}`,
          image: null
        });
      }
    });

    return agentMap;
  } catch (error) {
    console.error('Error fetching agent names:', error);
    // Provide fallback names for all agents in case of API failure
    return new Map(agentIds.map(id => {
      const shortId = isEthereumAddress(id) 
        ? `${id.slice(0, 6)}...${id.slice(-4)}`
        : id.slice(0, 8);
      return [id, { name: `Agent ${shortId}`, image: null }];
    }));
  }
}); 