import { RedisService } from '../services/redis'
import { BlockchainService } from '../services/blockchain'
import { LifeExtendedEvent } from '../types'

async function repopulateEvents() {
  try {
    console.log('Starting event repopulation...')
    
    // Clear existing events
    await RedisService.clearCache()
    console.log('Cleared existing cache')
    
    // Initialize blockchain service
    const blockchain = new BlockchainService()
    
    // Get current block
    const currentBlock = await blockchain.getCurrentBlock()
    console.log(`Current block: ${currentBlock}`)
    
    // Calculate lookback (30 days worth of blocks)
    const blocksPerDay = 5760 // 24 * 60 * 60 / 15 (15 second blocks)
    const lookbackBlocks = blocksPerDay * 30 // 30 days
    const fromBlock = Math.max(0, currentBlock - lookbackBlocks)
    
    console.log(`Fetching events from block ${fromBlock} to ${currentBlock}`)
    
    // Fetch events
    const events = await blockchain.getLifeExtendedEvents()
    console.log(`Found ${events.length} events`)
    
    if (events.length > 0) {
      // Save events to Redis
      await RedisService.saveEvents(events)
      await RedisService.saveLastBlock(currentBlock)
      console.log('Successfully saved events to Redis')
      
      // Print summary
      const uniqueAgents = new Set(events.map(e => e.agentId))
      const totalUSDC = events.reduce((sum, e) => sum + e.usdcAmount, BigInt(0))
      const totalA0X = events.reduce((sum, e) => sum + e.a0xBurned, BigInt(0))
      
      console.log('\nSummary:')
      console.log(`Unique agents: ${uniqueAgents.size}`)
      console.log(`Total USDC spent: ${totalUSDC.toString()}`)
      console.log(`Total A0X burned: ${totalA0X.toString()}`)
      console.log(`Time range: ${events[0].timestamp.toISOString()} to ${events[events.length - 1].timestamp.toISOString()}`)
    } else {
      console.log('No events found in the specified range')
    }
    
  } catch (error) {
    console.error('Error repopulating events:', error)
  }
}

// Run the script
repopulateEvents() 