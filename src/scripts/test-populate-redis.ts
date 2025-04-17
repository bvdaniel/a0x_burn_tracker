import { populateRedisFromUI } from './populate-redis';

const testAgents = [
  {
    id: "71f6f657-6800-0892-875f-f26e8c213756",
    name: "jessexbt",
    totalBurned: 1064435.632,
    health: 20,
    lastExtension: "about 3 hours ago"
  },
  {
    id: "82a7b768-7911-1903-986e-g37f9d324867",
    name: "cryptowhale",
    totalBurned: 2345678.901,
    health: 85,
    lastExtension: "about 1 day ago"
  },
  {
    id: "93c8c879-8a22-2014-097f-h48e0e435978",
    name: "hodler123",
    totalBurned: 987654.321,
    health: 50,
    lastExtension: "about 12 hours ago"
  }
];

async function main() {
  try {
    console.log('Starting Redis population with test data...');
    await populateRedisFromUI(testAgents);
    console.log('Redis population completed successfully!');
  } catch (error) {
    console.error('Error during Redis population:', error);
    process.exit(1);
  }
}

main(); 