import { RedisService } from '../services/redis';

async function main() {
  try {
    const events = await RedisService.getEvents();
    const lastBlock = await RedisService.getLastBlock();
    
    console.log('Events in Redis:', events.length);
    console.log('Last block:', lastBlock);
    
    if (events.length > 0) {
      console.log('\nFirst event:', events[0]);
      console.log('\nLast event:', events[events.length - 1]);
    }
  } catch (error) {
    console.error('Error checking Redis:', error);
  }
}

main(); 