import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ExtendLife } from './ExtendLife'
import { useWeb3Modal } from '@web3modal/wagmi/react'

interface LeaderboardProps {
  agents: Array<{
    id: string
    name: string
    imageUrl: string
    totalBurned: number
    remainingDays: number
    lastExtension: string
    healthPercentage: number
  }>
  onRefresh?: () => void
}

export function Leaderboard({ agents, onRefresh }: LeaderboardProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const { address } = useAccount()
  const { open: openConnectModal } = useWeb3Modal()

  const handleExtendClick = (agentId: string) => {
    if (!address) {
      openConnectModal()
      return
    }
    setSelectedAgent(agentId)
  }

  const handleExtendSuccess = async () => {
    // Cerrar el modal inmediatamente para feedback visual
    setSelectedAgent(null)

    // Esperar 10 segundos para asegurar que la transacción esté indexada
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    const maxRetries = 3
    const retryDelay = 5000 // 5 segundos entre reintentos
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Intentar refrescar los datos
        onRefresh?.()
        // Si llegamos aquí, el refresco fue exitoso
        break
      } catch (error) {
        console.error(`Error refrescando datos (intento ${attempt + 1}/${maxRetries}):`, error)
        if (attempt < maxRetries - 1) {
          // Esperar antes del siguiente reintento
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-slate-900 rounded-lg overflow-hidden">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Agent</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Total Burned</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Health</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Last Extension</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {agents.map((agent) => (
            <>
              <tr key={agent.id} className="hover:bg-slate-800/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img className="h-10 w-10 rounded-full" src={agent.imageUrl} alt="" />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-slate-200">{agent.name}</div>
                      <div className="text-sm text-slate-400">{agent.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-200">{agent.totalBurned.toLocaleString()} A0X</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm text-slate-200">{agent.healthPercentage}%</div>
                    <div className="ml-2 w-16 bg-slate-700 rounded-full h-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${agent.healthPercentage}%`,
                          backgroundColor: agent.healthPercentage > 50 ? '#22c55e' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                  {agent.lastExtension}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                  <button
                    onClick={() => handleExtendClick(agent.id)}
                    className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white"
                  >
                    Extend Life
                  </button>
                </td>
              </tr>
              {selectedAgent === agent.id && (
                <tr>
                  <td colSpan={5} className="px-6 py-4">
                    <ExtendLife 
                      agentId={agent.id as `0x${string}`}
                      onSuccess={handleExtendSuccess}
                      onClose={() => setSelectedAgent(null)}
                    />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
} 