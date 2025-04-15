# AI Agent Life Extension Burn Tracker

A modern dashboard for tracking AI agent life extensions and A0X token burns.

## Features

### Dashboard Overview
- Total active agents count with weekly growth rate
- Total A0X tokens burned with weekly burn rate
- Average life extension duration
- Critical agents monitoring

### Analytics
- Burn rate trends with moving averages
- Extension duration distribution
- Recent extension activity timeline
- Performance metrics and efficiency tracking

### Agent Management
- Detailed agent status tracking
- Health percentage visualization
- Remaining life indicators
- Performance metrics (efficiency, success rate, tasks completed)

### Advanced Filtering
- Search by agent ID
- Filter by status (active, inactive, critical)
- Sort by various metrics (rank, burn rate, remaining time, efficiency)
- Customizable sort direction

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- Next.js 14
- React 18
- Chart.js with react-chartjs-2
- TailwindCSS
- TypeScript
- date-fns for date formatting
- Heroicons for icons

## Data Structure

The dashboard expects agent data in the following format:

```typescript
interface AgentStats {
  agentId: string;
  totalA0XBurned: number;
  lastExtended: Date;
  healthPercentage: number;
  remainingDays: number;
  efficiency: number;
  successRate: number;
  taskCount: number;
  burnRate: number;
  status: 'active' | 'inactive' | 'critical';
  lastActive: Date;
  createdAt: Date;
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
