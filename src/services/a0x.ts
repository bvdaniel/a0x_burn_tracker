import { AgentProfile } from '../types'

const API_URL = process.env.NEXT_PUBLIC_A0X_MIRROR_API_URL
const API_KEY = process.env.NEXT_PUBLIC_A0X_MIRROR_API_KEY

export class A0XService {
  static async getAgentProfile(agentId: string): Promise<AgentProfile | null> {
    try {
      console.log(`Fetching profile for agent ${agentId}...`);
      
      // If API URL or key is missing, return default profile
      if (!API_URL || !API_KEY) {
        console.warn('API configuration missing, returning default profile');
        return {
          name: `Agent ${agentId.slice(0, 6)}...${agentId.slice(-4)}`,
          imageUrl: '/default-agent.png',
          socials: {
            x: null,
            farcaster: null
          }
        };
      }

      // Fetch all agents
      const response = await fetch(`${API_URL}/agents`, {
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch agents:`, response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return {
          name: `Agent ${agentId.slice(0, 6)}...${agentId.slice(-4)}`,
          imageUrl: '/default-agent.png',
          socials: {
            x: null,
            farcaster: null
          }
        };
      }

      const agents = await response.json();
      const agent = agents.find((a: any) => a.agentId === agentId);

      if (!agent) {
        console.log(`Agent ${agentId} not found in response, returning default profile`);
        return {
          name: `Agent ${agentId.slice(0, 6)}...${agentId.slice(-4)}`,
          imageUrl: '/default-agent.png',
          socials: {
            x: null,
            farcaster: null
          }
        };
      }

      return {
        name: agent.name || `Agent ${agentId.slice(0, 6)}...${agentId.slice(-4)}`,
        imageUrl: agent.imageUrl || '/default-agent.png',
        socials: {
          x: agent.socials?.x || null,
          farcaster: agent.socials?.farcaster || null
        }
      };
    } catch (error) {
      console.error(`Error fetching agent ${agentId} profile:`, error);
      return {
        name: `Agent ${agentId.slice(0, 6)}...${agentId.slice(-4)}`,
        imageUrl: '/default-agent.png',
        socials: {
          x: null,
          farcaster: null
        }
      };
    }
  }

  static async getAgentProfiles(agentIds: string[]): Promise<Map<string, AgentProfile>> {
    const profiles = new Map<string, AgentProfile>();
     
    try {
      // If API URL or key is missing, return default profiles
      if (!API_URL || !API_KEY) {
        console.warn('API configuration missing, returning default profiles');
        return new Map(agentIds.map(id => [id, {
          name: `Agent ${id.slice(0, 6)}...${id.slice(-4)}`,
          imageUrl: '/default-agent.png',
          socials: {
            x: null,
            farcaster: null
          }
        }]));
      }

      console.log('Starting batch profile fetch for', agentIds.length, 'agents');
      
      // Fetch all agents at once
      const response = await fetch(`${API_URL}/agents`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': API_KEY
        },
        mode: 'cors'
      });

      if (!response.ok) {
        console.error('Failed to fetch agents:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return new Map(agentIds.map(id => [id, {
          name: `Agent ${id.slice(0, 6)}...${id.slice(-4)}`,
          imageUrl: '/default-agent.png',
          socials: {
            x: null,
            farcaster: null
          }
        }]));
      }

      const agents = await response.json();
      console.log(`Fetched ${agents.length} agents from API`);

      // Create a map of all agents
      const agentMap = new Map<string, AgentProfile>(agents.map((agent: { 
        agentId: string; 
        name?: string; 
        imageUrl?: string; 
        socials?: { x?: string; farcaster?: string };
        twitterClient?: { username: string; profileImageUrl?: string; lastTweetMetrics?: Record<string, any> };
        connectedWith?: Array<{ app: string; username: string; imageUrl?: string }>;
      }) => {
        // Get Twitter info either from connectedWith or twitterClient
        const twitterConnection = agent.connectedWith?.find(c => c.app.toLowerCase() === 'x' || c.app.toLowerCase() === 'twitter');
        const twitterUsername = agent.twitterClient?.username || twitterConnection?.username;
        
        // Try to get Twitter image from various sources
        const twitterImageUrl = agent.imageUrl || 
                              twitterConnection?.imageUrl || 
                              agent.twitterClient?.profileImageUrl ||
                              (twitterUsername ? `https://unavatar.io/twitter/${twitterUsername}` : null);

        return [
          agent.agentId,
          {
            name: agent.name || `Agent ${agent.agentId.slice(0, 6)}...${agent.agentId.slice(-4)}`,
            imageUrl: twitterImageUrl || '/default-agent.png',
            socials: {
              x: twitterUsername ? `https://x.com/${twitterUsername}` : null,
              farcaster: agent.socials?.farcaster || null
            }
          }
        ];
      }));

      // Add default profiles for any missing agents
      agentIds.forEach(id => {
        if (!agentMap.has(id)) {
          agentMap.set(id, {
            name: `Agent ${id.slice(0, 6)}...${id.slice(-4)}`,
            imageUrl: '/default-agent.png',
            socials: {
              x: null,
              farcaster: null
            }
          });
        }
      });

      console.log('Finished fetching all profiles:', agentMap);
      return agentMap;
    } catch (error) {
      console.error('Error fetching agent profiles:', error);
      return new Map(agentIds.map(id => [id, {
        name: `Agent ${id.slice(0, 6)}...${id.slice(-4)}`,
        imageUrl: '/default-agent.png',
        socials: {
          x: null,
          farcaster: null
        }
      }]));
    }
  }
} 