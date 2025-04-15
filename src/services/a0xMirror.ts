import { cache } from 'react';

interface A0xAgent {
  agentId: string;
  name: string;
  status: string;
  imageUrl?: string;
  walletAddress?: string;
  connectedWith?: Array<{
    app: string;
    name: string;
    imageUrl?: string;
    username: string;
  }>;
  twitterClient?: {
    username: string;
    email: string;
    profileImageUrl: string;
  };
}

interface AgentInfo {
  name: string;
  imageUrl?: string;
}

const API_URL = 'https://development-a0x-mirror-api-422317649866.us-central1.run.app';
const API_KEY = '24*a0x-mirror*24';

const isEthereumAddress = (id: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(id);
};

const getImageFromConnections = (agent: A0xAgent): string | undefined => {
  // First try direct image
  if (agent.imageUrl) return agent.imageUrl;
  
  // Then try Twitter profile image
  if (agent.twitterClient?.username) {
    // Construct Twitter profile image URL
    return `https://unavatar.io/twitter/${agent.twitterClient.username}`;
  }
  
  // Finally try connected accounts
  if (agent.connectedWith && agent.connectedWith.length > 0) {
    const connectionWithImage = agent.connectedWith.find(conn => conn.imageUrl);
    if (connectionWithImage) return connectionWithImage.imageUrl;
  }
  
  return undefined;
};

// Default avatar from our public directory
const DEFAULT_AVATAR = '/default-agent.png';

export const getAgentNames = cache(async (agentIds: string[]): Promise<Map<string, AgentInfo>> => {
  try {
    console.log('Fetching agent names for:', agentIds);
    
    const response = await fetch(`${API_URL}/agents`, {
      headers: {
        'User-Agent': 'burntracker/1.0',
        'x-api-key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch agent data: ${response.status} ${response.statusText}`);
    }

    const agents: A0xAgent[] = await response.json();
    console.log('Found', agents.length, 'agents in A0x Mirror API');
    
    const agentMap = new Map<string, AgentInfo>();
    
    agents.forEach(agent => {
      const imageUrl = getImageFromConnections(agent) || DEFAULT_AVATAR;
      const info = {
        name: agent.name,
        imageUrl
      };
      
      // Map by agent ID
      agentMap.set(agent.agentId, info);
      
      // If the agent has a wallet address, also map by that
      if (agent.walletAddress) {
        const walletKey = agent.walletAddress.toLowerCase();
        agentMap.set(walletKey, info);
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
        ? `${id.slice(0, 6)}...${id.slice(-4)}`
        : id.slice(0, 8);
      return [id, { name: `Agent ${shortId}`, imageUrl: DEFAULT_AVATAR }];
    }));
  }
}); 