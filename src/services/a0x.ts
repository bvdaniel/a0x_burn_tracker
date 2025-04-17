import { AgentProfile } from '../types'

// Use our proxy endpoint instead of direct API calls
const API_BASE = '/api/a0x-mirror'

// Add timeout helper
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
    )
  ])
}

export class A0XService {
  private static async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await withTimeout(
          fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Accept': 'application/json',
            }
          }),
          5000
        );
        
        if (response.ok) {
          return response;
        }
        
        lastError = new Error(`HTTP error! status: ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch after retries');
  }

  static async getAgentProfiles(agentIds: string[]): Promise<Map<string, AgentProfile>> {
    const profiles = new Map<string, AgentProfile>();
     
    try {
      console.log('Starting batch profile fetch for', agentIds.length, 'agents');
      
      // Fetch all agents through our proxy
      const response = await this.fetchWithRetry(`${API_BASE}`, {
        method: 'GET'
      });

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

      console.log('Finished fetching all profiles');
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