import { config } from 'dotenv'
import { resolve } from 'path'
import { BlockchainService } from '../services/blockchain'
import { RedisService } from '../services/redis'
import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../config/contract'
import { LifeExtendedEvent } from '../types'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const BATCH_SIZE = 5000 // Process 5000 blocks at a time
const DELAY_BETWEEN_BATCHES = 1000 // 1 second delay between batches

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchHistoricalEvents() {
  try {
    console.log('Starting historical event fetch...')
    
    // Check if Redis credentials are configured
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Redis credentials not configured in .env.local')
    }
    
    // Initialize blockchain service
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org')
    const contract = new ethers.Contract(
      CONTRACT_CONFIG.address,
      CONTRACT_CONFIG.abi,
      provider
    )
    
    // Get current block
    const currentBlock = await provider.getBlockNumber()
    console.log(`Current block: ${currentBlock}`)
    
    // Calculate lookback (40 days worth of blocks)
    const blocksPerDay = 5760 // 24 * 60 * 60 / 15 (15 second blocks)
    const lookbackBlocks = blocksPerDay * 40 // 40 days
    const fromBlock = Math.max(0, currentBlock - lookbackBlocks)
    
    console.log(`Fetching events from block ${fromBlock} to ${currentBlock}`)
    
    // Clear existing events first
    await RedisService.clearCache()
    console.log('Cleared existing cache')
    
    const allEvents: LifeExtendedEvent[] = []
    
    // Process in batches
    for (let startBlock = fromBlock; startBlock < currentBlock; startBlock += BATCH_SIZE) {
      const endBlock = Math.min(startBlock + BATCH_SIZE, currentBlock)
      console.log(`Processing blocks ${startBlock} to ${endBlock}...`)
      
      try {
        const filter = contract.filters.LifeExtended()
        const events = await contract.queryFilter(filter, startBlock, endBlock)
        console.log(`Found ${events.length} events in this batch`)
        
        if (events.length > 0) {
          const processedEvents = await Promise.all(events.map(async event => {
            const args = (event as ethers.EventLog).args
            if (!args) throw new Error('No args in event')
            const [agentId, usdcAmount, a0xBurned, newTimeToDeath, useUSDC] = args
            
            const block = (event as ethers.Log).blockNumber
            const eventBlock = await event.getBlock()
            const timestamp = eventBlock ? eventBlock.timestamp : Math.floor(Date.now() / 1000)
            
            return {
              agentId,
              usdcAmount: BigInt(usdcAmount),
              a0xBurned: BigInt(a0xBurned),
              newTimeToDeath: BigInt(newTimeToDeath),
              useUSDC,
              timestamp: new Date(Number(timestamp) * 1000),
              transactionHash: event.transactionHash,
              blockNumber: block
            } as LifeExtendedEvent
          }))
          
          allEvents.push(...processedEvents)
        }
        
        // Add delay between batches
        await sleep(DELAY_BETWEEN_BATCHES)
      } catch (error) {
        console.error(`Error processing batch ${startBlock}-${endBlock}:`, error)
        // Continue with next batch despite errors
      }
    }
    
    if (allEvents.length > 0) {
      // Save events to Redis
      await RedisService.saveEvents(allEvents)
      await RedisService.saveLastBlock(currentBlock)
      console.log('Successfully saved events to Redis')
      
      // Print summary
      const uniqueAgents = new Set(allEvents.map(e => e.agentId))
      const totalUSDC = allEvents.reduce((sum, e) => sum + e.usdcAmount, BigInt(0))
      const totalA0X = allEvents.reduce((sum, e) => sum + e.a0xBurned, BigInt(0))
      
      console.log('\nSummary:')
      console.log(`Total events: ${allEvents.length}`)
      console.log(`Unique agents: ${uniqueAgents.size}`)
      console.log(`Total USDC spent: ${totalUSDC.toString()}`)
      console.log(`Total A0X burned: ${(Number(totalA0X) / 1e18).toLocaleString()} A0X`)
      console.log(`Time range: ${allEvents[0].timestamp.toISOString()} to ${allEvents[allEvents.length - 1].timestamp.toISOString()}`)
    } else {
      console.log('No events found in the specified range')
    }
    
  } catch (error) {
    console.error('Error fetching historical events:', error)
  }
}

// Run the script
fetchHistoricalEvents() 