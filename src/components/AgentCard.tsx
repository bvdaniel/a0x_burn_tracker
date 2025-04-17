import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useContractWrite, usePublicClient, useAccount } from 'wagmi';
import { CONTRACT_CONFIG } from '@/config/contract';
import { USDC_CONTRACT_ADDRESS, USDC_ABI } from '@/config/usdc';
import { LIFE_EXTENDER_ABI, ERC20_ABI, A0X_TOKEN_ADDRESS, LIFE_EXTENDER_ADDRESS } from '@/config/web3';
import { AgentStats, AgentProfile } from '@/types';
import Image from 'next/image';

interface AgentCardProps {
  agent: AgentStats;
  profile?: AgentProfile;
  onLifeExtended: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, profile, onLifeExtended }) => {
  console.warn('🎮🎮🎮 AGENT CARD COMPONENT RENDERING 🎮🎮🎮');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [useUSDC, setUseUSDC] = useState(true);

  // Log when useUSDC changes
  React.useEffect(() => {
    console.warn('💫 useUSDC state changed:', useUSDC);
  }, [useUSDC]);

  const { writeContractAsync } = useContractWrite();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const handleExtendLife = async () => {
    console.warn('🔥🔥🔥 EXTEND LIFE CLICKED 🔥🔥🔥');
    console.warn('CURRENT PATH:', useUSDC ? 'USDC' : 'A0X');
    console.warn('CURRENT STATE:', { useUSDC, amount, agentId: agent?.agentId });

    if (!agent || !publicClient || !address) {
      console.warn('❌ MISSING REQUIREMENTS:', { 
        hasAgent: !!agent, 
        hasPublicClient: !!publicClient, 
        hasAddress: !!address 
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Calculate USDC amount from days (1 USDC = 7 days)
      const usdcAmount = BigInt(Math.floor((amount / 7) * 1_000_000));
      console.warn('💰 CALCULATED AMOUNTS:', { 
        days: amount,
        usdcAmount: usdcAmount.toString()
      });

      if (useUSDC) {
        console.warn('💙 EXECUTING USDC PATH 💙', {
          agentId: agent.agentId,
          usdcAmount: usdcAmount.toString(),
          useUSDC: true
        });
        // Check USDC allowance first
        const allowance = await publicClient.readContract({
          address: USDC_CONTRACT_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: 'allowance',
          args: [address, LIFE_EXTENDER_ADDRESS],
        });

        if (allowance < usdcAmount) {
          // Approve USDC first
          const approveTx = await writeContractAsync({
            address: USDC_CONTRACT_ADDRESS as `0x${string}`,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [LIFE_EXTENDER_ADDRESS, usdcAmount],
          });

          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Then extend life with USDC
        const extendTx = await writeContractAsync({
          address: LIFE_EXTENDER_ADDRESS as `0x${string}`,
          abi: LIFE_EXTENDER_ABI,
          functionName: 'extendLife',
          args: [agent.agentId, usdcAmount, true],
        });

        await publicClient.waitForTransactionReceipt({ hash: extendTx });
        onLifeExtended();
      } else {
        console.warn('❤️ EXECUTING A0X PATH ❤️', {
          agentId: agent.agentId,
          usdcAmount: usdcAmount.toString(),
          useUSDC: false
        });
        // Calculate required A0X amount for the USDC amount (only for approval)
        const requiredA0X = await publicClient.readContract({
          address: LIFE_EXTENDER_ADDRESS as `0x${string}`,
          abi: LIFE_EXTENDER_ABI,
          functionName: 'getA0XAmountForUSDC',
          args: [usdcAmount],
        }) as bigint;

        // Check A0X allowance
        const allowance = await publicClient.readContract({
          address: A0X_TOKEN_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, LIFE_EXTENDER_ADDRESS],
        });

        if (allowance < requiredA0X) {
          // Approve A0X first
          const approveTx = await writeContractAsync({
            address: A0X_TOKEN_ADDRESS as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [LIFE_EXTENDER_ADDRESS, requiredA0X],
          });

          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Then extend life with A0X
        const extendTx = await writeContractAsync({
          address: LIFE_EXTENDER_ADDRESS as `0x${string}`,
          abi: LIFE_EXTENDER_ABI,
          functionName: 'extendLife',
          args: [agent.agentId, usdcAmount, false],
        });
        
        console.warn('🔴 A0X extension transaction sent:', {
          agentId: agent.agentId,
          usdcAmount: usdcAmount.toString(),
          useUSDC: false
        });

        await publicClient.waitForTransactionReceipt({ hash: extendTx });
        onLifeExtended();
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error extending life:', err);
      setError('Failed to extend life. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm relative">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16">
          <Image
            src={profile?.imageUrl || '/default-agent.png'}
            alt={profile?.name || agent.agentId}
            fill
            className="rounded-full object-cover"
          />
        </div>
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 px-4 rounded ${
              useUSDC ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
            onClick={() => setUseUSDC(true)}
          >
            USDC
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded ${
              !useUSDC ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'
            }`}
            onClick={() => setUseUSDC(false)}
          >
            A0X
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Days to extend</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
          placeholder="Enter days"
        />
      </div>

      {!useUSDC && (
        <>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Required A0X</span>
            <span className="text-white">0 A0X</span>
          </div>
          <div className="flex justify-between mb-4">
            <span className="text-gray-400">Your Balance</span>
            <span className="text-white">13,624,527.79 A0X</span>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 bg-gray-800 text-gray-400 py-2 px-4 rounded"
          onClick={() => {}}
        >
          Disconnect
        </button>
        <button
          className="flex-1 bg-gray-700 text-white py-2 px-4 rounded"
          onClick={handleExtendLife}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Extend Life'}
        </button>
      </div>

      {error && (
        <div className="mt-4 text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default AgentCard; 