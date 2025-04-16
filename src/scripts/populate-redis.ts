import { RedisService } from '../services/redis';
import { LifeExtendedEvent } from '../types';

interface AgentData {
  id: string;
  name: string;
  totalBurned: number;
  health: number;
  lastExtension: string;
}

// Function to parse the A0X amount string (e.g., "1,064,435.632 A0X" -> 1064435.632)
function parseA0XAmount(amount: string): number {
  return parseFloat(amount.replace(/,/g, '').replace(' A0X', ''));
}

// Function to convert the UI data to the format we need
function convertToLifeExtendedEvent(agent: AgentData): LifeExtendedEvent {
  const now = new Date();
  // Calculate approximate timestamp based on "about X hours/days ago"
  const timestamp = new Date(now);
  if (agent.lastExtension.includes('hours')) {
    const hours = parseInt(agent.lastExtension.match(/\d+/)?.[0] || '0');
    timestamp.setHours(timestamp.getHours() - hours);
  } else if (agent.lastExtension.includes('days')) {
    const days = parseInt(agent.lastExtension.match(/\d+/)?.[0] || '0');
    timestamp.setDate(timestamp.getDate() - days);
  }

  // Calculate approximate values based on what we have
  const a0xBurned = BigInt(Math.round(agent.totalBurned * 1e18)); // Convert to wei
  const remainingDays = Math.round((agent.health / 100) * 30); // Assuming 100% = 30 days
  const newTimeToDeath = BigInt(Math.floor(now.getTime() / 1000) + (remainingDays * 24 * 60 * 60));

  return {
    agentId: agent.id,
    usdcAmount: BigInt(0), // We don't have this info, but it's not critical
    a0xBurned,
    newTimeToDeath,
    useUSDC: false,
    timestamp
  };
}

export async function populateRedisFromUI(agents: AgentData[]) {
  try {
    const events = agents.map(convertToLifeExtendedEvent);
    await RedisService.saveEvents(events);
    await RedisService.saveLastBlock(await getCurrentBlock());
    console.log('Successfully populated Redis with', events.length, 'events');
  } catch (error) {
    console.error('Error populating Redis:', error);
  }
}

async function getCurrentBlock(): Promise<number> {
  const response = await fetch('https://api.basescan.org/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    })
  });
  const data = await response.json();
  return parseInt(data.result, 16);
}

// Example usage:
// const agents = [
//   {
//     id: "71f6f657-6800-0892-875f-f26e8c213756",
//     name: "jessexbt",
//     totalBurned: 1064435.632,
//     health: 20,
//     lastExtension: "about 3 hours ago"
//   },
//   // ... more agents
// ];
// 
// populateRedisFromUI(agents); 