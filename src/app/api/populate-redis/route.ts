import { RedisService } from '@/services/redis'
import { NextResponse } from 'next/server'
import { LifeExtendedEvent } from '../../../types'

const events: LifeExtendedEvent[] = [
  {
    agentId: "0bd25758-2a10-0c4a-acc9-e611d4d48356",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1279372185396102480319442"),
    newTimeToDeath: BigInt("1745158901"),
    useUSDC: false,
    timestamp: new Date("2025-04-13T14:21:41.000Z"),
    transactionHash: "0x" + "1".repeat(64),
    blockNumber: 29022500
  },
  {
    agentId: "2b9ec976-a43c-06db-be02-a46603f9e372",
    usdcAmount: BigInt("4000000"),
    a0xBurned: BigInt("5092210793714505053041038"),
    newTimeToDeath: BigInt("1747065445"),
    useUSDC: false,
    timestamp: new Date("2025-04-14T15:57:25.000Z"),
    transactionHash: "0x" + "2".repeat(64),
    blockNumber: 29022501
  },
  {
    agentId: "0x32659eA613Ce1706AbEa4109f9E2D5840196C187",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1272121422433815589874316"),
    newTimeToDeath: BigInt("1745252347"),
    useUSDC: false,
    timestamp: new Date("2025-04-14T16:19:07.000Z")
  },
  {
    agentId: "6a4eb97b-3994-0d31-9082-3157ae9f2c2e",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1268870815417553861161819"),
    newTimeToDeath: BigInt("1745252531"),
    useUSDC: false,
    timestamp: new Date("2025-04-14T16:22:11.000Z")
  },
  {
    agentId: "2bf3d274-7a00-09f3-9a48-24eb248999ac",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1058027354470661092632764"),
    newTimeToDeath: BigInt("1745340179"),
    useUSDC: false,
    timestamp: new Date("2025-04-15T16:42:59.000Z")
  },
  {
    agentId: "1add6e0b-c007-08f2-9715-2fff27c3f7c1",
    usdcAmount: BigInt("4000000"),
    a0xBurned: BigInt("4233465912686862731581785"),
    newTimeToDeath: BigInt("1747426777"),
    useUSDC: false,
    timestamp: new Date("2025-04-15T17:02:45.000Z")
  },
  {
    agentId: "2bf3d274-7a00-09f3-9a48-24eb248999ac",
    usdcAmount: BigInt("4000000"),
    a0xBurned: BigInt("4230742068856020726595497"),
    newTimeToDeath: BigInt("1747759379"),
    useUSDC: false,
    timestamp: new Date("2025-04-15T17:06:55.000Z")
  },
  {
    agentId: "949a50a2-5e0d-0cfb-bdd9-65d0c3541bf5",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1063476224185923063225694"),
    newTimeToDeath: BigInt("1745359853"),
    useUSDC: false,
    timestamp: new Date("2025-04-15T18:01:55.000Z")
  },
  {
    agentId: "2b9ec976-a43c-06db-be02-a46603f9e372",
    usdcAmount: BigInt("428571"),
    a0xBurned: BigInt("460953219164194160968296"),
    newTimeToDeath: BigInt("1747324644"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T01:10:03.000Z")
  },
  {
    agentId: "6a4eb97b-3994-0d31-9082-3157ae9f2c2e",
    usdcAmount: BigInt("285714"),
    a0xBurned: BigInt("307303760219042841162281"),
    newTimeToDeath: BigInt("1745425330"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T01:15:03.000Z")
  },
  {
    agentId: "1add6e0b-c007-08f2-9715-2fff27c3f7c1",
    usdcAmount: BigInt("285714"),
    a0xBurned: BigInt("307303760219042841162281"),
    newTimeToDeath: BigInt("1747599576"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T01:41:25.000Z")
  },
  {
    agentId: "1add6e0b-c007-08f2-9715-2fff27c3f7c1",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1075898928376848709514465"),
    newTimeToDeath: BigInt("1748204376"),
    useUSDC: true,
    timestamp: new Date("2025-04-16T01:56:19.000Z")
  },
  {
    agentId: "2b9ec976-a43c-06db-be02-a46603f9e372",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1072182338150159818765061"),
    newTimeToDeath: BigInt("1747929444"),
    useUSDC: true,
    timestamp: new Date("2025-04-16T03:27:33.000Z")
  },
  {
    agentId: "2bf3d274-7a00-09f3-9a48-24eb248999ac",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1073922355583252826215840"),
    newTimeToDeath: BigInt("1748364179"),
    useUSDC: true,
    timestamp: new Date("2025-04-16T04:10:15.000Z")
  },
  {
    agentId: "1add6e0b-c007-08f2-9715-2fff27c3f7c1",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1088278415221114379548170"),
    newTimeToDeath: BigInt("1748809176"),
    useUSDC: true,
    timestamp: new Date("2025-04-16T05:25:47.000Z")
  },
  {
    agentId: "949a50a2-5e0d-0cfb-bdd9-65d0c3541bf5",
    usdcAmount: BigInt("142857"),
    a0xBurned: BigInt("154021096850993861279170"),
    newTimeToDeath: BigInt("1745446252"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T13:32:19.000Z")
  },
  {
    agentId: "949a50a2-5e0d-0cfb-bdd9-65d0c3541bf5",
    usdcAmount: BigInt("142857"),
    a0xBurned: BigInt("154021096850993861279170"),
    newTimeToDeath: BigInt("1745532651"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T13:59:15.000Z")
  },
  {
    agentId: "949a50a2-5e0d-0cfb-bdd9-65d0c3541bf5",
    usdcAmount: BigInt("142857"),
    a0xBurned: BigInt("153104309386198351221094"),
    newTimeToDeath: BigInt("1745619050"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T14:06:25.000Z")
  },
  {
    agentId: "949a50a2-5e0d-0cfb-bdd9-65d0c3541bf5",
    usdcAmount: BigInt("285714"),
    a0xBurned: BigInt("305290244841950116025389"),
    newTimeToDeath: BigInt("1745791849"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T14:46:05.000Z")
  },
  {
    agentId: "0bd25758-2a10-0c4a-acc9-e611d4d48356",
    usdcAmount: BigInt("142857"),
    a0xBurned: BigInt("152187521864177231497427"),
    newTimeToDeath: BigInt("1745245300"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T15:02:19.000Z")
  },
  {
    agentId: "71f6f657-6800-0892-875f-f26e8c213756",
    usdcAmount: BigInt("1000000"),
    a0xBurned: BigInt("1064435632250403192051670"),
    newTimeToDeath: BigInt("1745428323"),
    useUSDC: false,
    timestamp: new Date("2025-04-16T17:12:03.000Z"),
    transactionHash: "0x" + "f".repeat(64),
    blockNumber: 29022556
  }
];

export async function GET() {
  try {
    await RedisService.saveEvents(events);
    await RedisService.saveLastBlock(29022556); // Using the last block number we had
    return NextResponse.json({ 
      success: true, 
      message: 'Events saved to Redis',
      eventCount: events.length
    });
  } catch (error) {
    console.error('Error populating Redis:', error);
    return NextResponse.json({ error: 'Failed to populate Redis' }, { status: 500 });
  }
} 