import { AgentStats, AgentMetrics, BurnRatePoint, ExtensionEvent, DashboardAnalytics } from '../types';
import { subDays, differenceInDays, format, parse } from 'date-fns';

// Helper function to convert Unix timestamp to Date
function timestampToDate(timestamp: number): Date {
  console.log('Converting timestamp:', timestamp);
  // Handle undefined or invalid timestamps
  if (!timestamp || isNaN(timestamp)) {
    console.warn('Invalid timestamp:', timestamp);
    return new Date();
  }
  
  // If timestamp is in seconds (less than year 2100), convert to milliseconds
  if (timestamp < 4102444800) { // 2100-01-01 in seconds
    console.log('Converting seconds to milliseconds:', timestamp * 1000);
    return new Date(timestamp * 1000);
  }
  console.log('Using timestamp as is:', timestamp);
  return new Date(timestamp);
}

export function calculateAgentMetrics(agents: AgentStats[]): AgentMetrics {
  const now = new Date();
  const lastWeek = subDays(now, 7);
  
  // Count active agents (excluding critical)
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const criticalAgents = agents.filter(a => a.status === 'critical').length;
  const totalBurned = agents.reduce((sum, a) => sum + a.totalA0XBurned, 0);
  
  // Calculate burned amount from recent extensions
  const recentExtensions = generateRecentExtensions(agents);
  const burnedLastWeek = recentExtensions
    .reduce((sum, event) => sum + event.a0xBurned, 0);

  // Calculate average life extension from recent extensions only
  const extensionsWithDuration = recentExtensions.filter(ext => ext.duration > 0);
  const averageLifeExtension = extensionsWithDuration.length > 0
    ? extensionsWithDuration.reduce((sum, ext) => sum + ext.duration, 0) / extensionsWithDuration.length
    : 0;

  return {
    totalAgents: agents.length,
    activeAgents,
    totalBurned,
    burnedLastWeek,
    averageLifeExtension,
    weeklyGrowth: (((activeAgents + criticalAgents) / agents.length) - 0.5) * 100,
    criticalAgents
  };
}

export function calculateBurnRateTrend(agents: AgentStats[]): BurnRatePoint[] {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 29);
  const thirtyDaysAgoTimestamp = thirtyDaysAgo.getTime() / 1000; // Convert to seconds to match agent timestamps
  
  // Create a map to store daily burns
  const dailyBurns = new Map<string, number>();
  
  // Initialize all days with 0 burns
  for (let i = 0; i < 30; i++) {
    const date = subDays(now, 29 - i);
    dailyBurns.set(format(date, 'yyyy-MM-dd'), 0);
  }
  
  // Calculate burns for each day
  agents.forEach(agent => {
    console.log('Processing agent:', agent.agentId, 'lastExtended:', agent.lastExtended);
    try {
      const date = timestampToDate(agent.lastExtended);
      console.log('Converted date:', date);
      const extensionDate = format(date, 'yyyy-MM-dd');
      console.log('Formatted date:', extensionDate);
      
      if (agent.lastExtended >= thirtyDaysAgoTimestamp) {
        const currentBurns = dailyBurns.get(extensionDate) || 0;
        // Divide by 1,000,000 to convert to a more readable unit
        dailyBurns.set(extensionDate, currentBurns + (agent.totalA0XBurned / 1_000_000));
      }
    } catch (error) {
      console.error('Error processing agent:', agent.agentId, error);
    }
  });
  
  // Convert to array and calculate moving average
  const points: BurnRatePoint[] = Array.from(dailyBurns.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([dateStr, burns], index, array) => {
      // Calculate 3-day moving average
      let movingAverage = burns;
      if (index >= 2) {
        const threeDaySum = array.slice(index - 2, index + 1)
          .reduce((sum, [, value]) => sum + value, 0);
        movingAverage = threeDaySum / 3;
      }
      
      return {
        timestamp: parse(dateStr, 'yyyy-MM-dd', new Date()),
        rate: burns,
        movingAverage
      };
    });
  
  return points;
}

export function generateExtensionDistribution(agents: AgentStats[]) {
  const ranges = [
    '0-30 days',
    '31-60 days',
    '61-90 days',
    '90+ days'
  ] as const;

  type RangeKey = '0-30' | '31-60' | '61-90' | '90+';
  
  // Initialize counts for each range
  const counts: Record<RangeKey, number> = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0
  };

  // Count agents in each range based on remaining days
  agents.forEach(agent => {
    const days = agent.remainingDays;
    if (days <= 30) {
      counts['0-30']++;
    } else if (days <= 60) {
      counts['31-60']++;
    } else if (days <= 90) {
      counts['61-90']++;
    } else {
      counts['90+']++;
    }
  });

  // Map the counts to the format expected by the chart
  const distribution = ranges.map(range => {
    const key = range.replace(' days', '') as RangeKey;
    return {
      range,
      count: counts[key]
    };
  });

  return distribution;
}

export function calculateAgentHealth(agent: AgentStats): number {
  const daysSinceExtension = differenceInDays(new Date(), timestampToDate(agent.lastExtended));
  const healthPercentage = Math.max(0, Math.min(100, 100 - (daysSinceExtension / 180) * 100));
  return Math.round(healthPercentage);
}

export function generateRecentExtensions(agents: AgentStats[]): ExtensionEvent[] {
  const now = new Date();
  const lastWeekTimestamp = subDays(now, 7).getTime() / 1000; // Convert to seconds to match agent timestamps
  
  // Get extensions from the last week
  const recentExtensions = agents
    .filter(agent => agent.lastExtended >= lastWeekTimestamp)
    .map((agent, index) => {
      // For first extensions, previousRemainingDays is 0
      const previousRemainingDays = agent.previousRemainingDays;
      
      // Calculate the actual extension amount at the time of extension
      const extensionAmount = agent.lastExtensionDuration;
      const remainingDaysAtExtension = previousRemainingDays + extensionAmount;
      
      return {
        id: `evt-${index}`,
        agentId: agent.agentId,
        timestamp: timestampToDate(agent.lastExtended),
        duration: extensionAmount,
        a0xBurned: agent.totalA0XBurned,
        previousRemainingDays,
        remainingDays: remainingDaysAtExtension
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return recentExtensions;
}

export function getDashboardAnalytics(agents: AgentStats[]): DashboardAnalytics {
  return {
    metrics: calculateAgentMetrics(agents),
    recentExtensions: generateRecentExtensions(agents),
    burnRateTrend: calculateBurnRateTrend(agents),
    extensionDistribution: generateExtensionDistribution(agents)
  };
}

export function filterAndSortAgents(
  agents: AgentStats[],
  search: string,
  status: 'all' | 'active' | 'inactive' | 'critical',
  sortBy: 'rank' | 'name' | 'totalBurned' | 'lastExtended' | 'remainingDays',
  sortDirection: 'asc' | 'desc'
): AgentStats[] {
  let filtered = [...agents];

  // Apply search
  if (search) {
    filtered = filtered.filter(a => 
      a.agentId.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Apply status filter
  if (status !== 'all') {
    filtered = filtered.filter(a => a.status === status);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.agentId.localeCompare(b.agentId);
        break;
      case 'totalBurned':
        comparison = b.totalA0XBurned - a.totalA0XBurned;
        break;
      case 'lastExtended':
        comparison = b.lastExtended - a.lastExtended; // Compare numeric timestamps directly
        break;
      case 'remainingDays':
        comparison = b.remainingDays - a.remainingDays;
        break;
      default: // rank - by total burned
        comparison = b.totalA0XBurned - a.totalA0XBurned;
    }
    return sortDirection === 'asc' ? -comparison : comparison;
  });

  return filtered;
} 