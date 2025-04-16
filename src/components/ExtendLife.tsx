import { useState, useEffect, useMemo } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, useDisconnect } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { parseUnits, formatUnits } from 'viem'
import { 
  LIFE_EXTENDER_ADDRESS, 
  LIFE_EXTENDER_ABI, 
  USDC_ADDRESS, 
  A0X_TOKEN_ADDRESS,
  ERC20_ABI 
} from '@/config/web3'
import { config } from '@/config/web3'

interface ExtendLifeProps {
  agentId: `0x${string}`
  onSuccess?: () => void
  onClose?: () => void
}

export function ExtendLife({ agentId, onSuccess, onClose }: ExtendLifeProps) {
  console.warn('🚀🚀🚀 EXTEND LIFE COMPONENT RENDERING 🚀🚀🚀');
  const [days, setDays] = useState('')
  const [amount, setAmount] = useState('')
  const [isUSDC, setIsUSDC] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [a0xAmount, setA0xAmount] = useState<bigint | null>(null)
  const [successDetails, setSuccessDetails] = useState<{
    burnedAmount: string;
    days: number;
    hash?: string;
  } | null>(null)
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open: openConnectModal } = useWeb3Modal()

  // Get token balances
  const { data: a0xBalance } = useReadContract({
    address: A0X_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: isConnected
    }
  })

  // Get A0X amount for USDC
  const { data: requiredA0x, refetch: refetchA0x } = useReadContract({
    address: LIFE_EXTENDER_ADDRESS,
    abi: LIFE_EXTENDER_ABI,
    functionName: 'getA0XAmountForUSDC',
    args: [parseUnits(amount || '0', 6)],
    query: {
      enabled: false // We'll manually trigger this
    }
  })

  const { data: writeHash, writeContract, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isTransactionSuccess } = useWaitForTransactionReceipt({
    hash: writeHash,
  })

  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: isUSDC ? USDC_ADDRESS : A0X_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, LIFE_EXTENDER_ADDRESS],
    query: {
      enabled: isConnected && (!!amount || !!a0xAmount)
    }
  })

  // Format balance for display
  const formattedA0XBalance = a0xBalance 
    ? Number(formatUnits(a0xBalance, 18)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
    : '0'

  const formattedA0XAmount = a0xAmount 
    ? Number(formatUnits(a0xAmount, 18)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
    : '0'

  useEffect(() => {
    if (!isUSDC && requiredA0x) {
      console.log('Setting A0X amount:', (requiredA0x as bigint).toString())
      setA0xAmount(requiredA0x as bigint)
    }
  }, [requiredA0x, isUSDC])

  useEffect(() => {
    // Refetch allowance when amount changes or token type changes
    if ((amount || a0xAmount) && isConnected) {
      console.log('Refetching allowance...')
      refetchAllowance()
    }
  }, [amount, a0xAmount, isConnected, refetchAllowance, isUSDC])

  // Check if the current amount is approved
  const isAmountApproved = useMemo(() => {
    if (!allowance) return false
    if (isUSDC && !amount) return false
    if (!isUSDC && !a0xAmount) return false
    
    try {
      const requiredAmount = isUSDC 
        ? parseUnits(amount, 6)
        : a0xAmount!
      console.log('Checking approval:', {
        allowance: allowance.toString(),
        requiredAmount: requiredAmount.toString(),
        isApproved: requiredAmount <= allowance
      })
      return requiredAmount <= allowance
    } catch (error) {
      console.error('Error checking approval:', error)
      return false
    }
  }, [allowance, amount, isUSDC, a0xAmount])

  // Check if user has sufficient balance
  const hasSufficientBalance = useMemo(() => {
    if (!a0xBalance) return false
    if (isUSDC && !amount) return false
    if (!isUSDC && !a0xAmount) return false

    try {
      const requiredAmount = isUSDC 
        ? parseUnits(amount, 6)
        : a0xAmount!
      console.log('Checking balance:', {
        balance: a0xBalance.toString(),
        requiredAmount: requiredAmount.toString(),
        isSufficient: requiredAmount <= a0xBalance
      })
      return requiredAmount <= a0xBalance
    } catch (error) {
      console.error('Error checking balance:', error)
      return false
    }
  }, [a0xBalance, amount, isUSDC, a0xAmount])

  // Handle transaction completion
  useEffect(() => {
    const checkAllowanceAndProceed = async () => {
      if (isTransactionSuccess && writeHash) {
        if (isApproving) {
          // For approval transaction, just update allowance and state
          await new Promise(resolve => setTimeout(resolve, 1000))
          await refetchAllowance()
          setIsApproving(false)
          return // Don't show success message for approval
        }

        // Only show success message for the extension transaction
        setSuccessDetails({
          burnedAmount: isUSDC ? amount : formattedA0XAmount,
          days: isUSDC ? Math.floor(parseFloat(amount) * 7) : parseInt(days),
          hash: writeHash
        })
        await new Promise(resolve => setTimeout(resolve, 2000))
        onSuccess?.()
      }
    }
    
    checkAllowanceAndProceed()
  }, [isTransactionSuccess, writeHash, isApproving, refetchAllowance, onSuccess, isUSDC, amount, days, formattedA0XAmount])

  const handleClose = () => {
    // Only reset state when user explicitly closes the modal
    setAmount('')
    setDays('')
    setA0xAmount(null)
    setSuccessDetails(null)
    onClose?.()
  }

  const handleApprove = async () => {
    try {
      setIsApproving(true)
      const approvalAmount = isUSDC
        ? parseUnits(amount, 6)
        : a0xAmount

      if (!approvalAmount) return

      console.log('Approving:', {
        token: isUSDC ? 'USDC' : 'A0X',
        amount: approvalAmount.toString()
      })

      await writeContract({
        address: isUSDC ? USDC_ADDRESS : A0X_TOKEN_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [LIFE_EXTENDER_ADDRESS, approvalAmount]
      })
    } catch (error) {
      console.error('Approval error:', error)
      setIsApproving(false)
    }
  }

  const handleExtend = async () => {
    try {
      const usdcAmount = isUSDC
        ? parseUnits(amount, 6)
        : parseUnits((parseInt(days) / 7).toFixed(6), 6)
      
      console.log('Extending with:', {
        isUSDC,
        usdcAmount: usdcAmount.toString(),
        days: isUSDC ? Math.floor(parseFloat(amount) * 7) : days,
        agentId
      })

      await writeContract({
        address: LIFE_EXTENDER_ADDRESS as `0x${string}`,
        abi: LIFE_EXTENDER_ABI,
        functionName: 'extendLife',
        args: [agentId, usdcAmount, isUSDC]
      })
    } catch (error) {
      console.error('Extension error:', error)
    }
  }

  const handleCalculateA0X = async () => {
    try {
      const daysNum = parseFloat(days)
      const usdcAmount = (daysNum / 7).toFixed(6)
      console.log('Calculating A0X for USDC amount:', usdcAmount)
      
      // Convert USDC amount to the correct format (6 decimals)
      const usdcAmountBigInt = parseUnits(usdcAmount, 6)
      setAmount(usdcAmount)
      
      // First attempt
      const { data: firstAttempt } = await refetchA0x()
      
      if (!firstAttempt) {
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 1000))
        const { data: secondAttempt } = await refetchA0x()
        if (secondAttempt) {
          console.log('A0X calculation result (second attempt):', secondAttempt.toString())
          setA0xAmount(secondAttempt as bigint)
        }
      } else {
        console.log('A0X calculation result (first attempt):', firstAttempt.toString())
        setA0xAmount(firstAttempt as bigint)
      }
    } catch (error) {
      console.error('Error calculating A0X:', error)
    }
  }

  const renderActionButton = () => {
    if (isUSDC && !amount || !isUSDC && !days) {
  return (
        <button
          disabled
          className="w-full px-4 py-3 bg-[#1D9BF0] text-white rounded-lg font-medium opacity-50 cursor-not-allowed mt-2"
        >
          Enter {isUSDC ? 'amount' : 'days'}
        </button>
      )
    }

    if (!isUSDC && !a0xAmount && days) {
      return (
        <button
          onClick={handleCalculateA0X}
          className="w-full px-4 py-3 bg-[#1D9BF0] text-white rounded-lg font-medium transition-colors hover:bg-[#1A8CD8] mt-2"
        >
          Calculate Required A0X
        </button>
      )
    }

    if (!isAmountApproved) {
      const approvalText = isUSDC 
        ? `Approve ${amount} USDC`
        : `Approve ${formattedA0XAmount} A0X`

      return (
        <button
          onClick={handleApprove}
          disabled={isApproving || isConfirming || (a0xAmount === null && !isUSDC)}
          className="w-full px-4 py-3 bg-[#1D9BF0] text-white rounded-lg font-medium transition-colors hover:bg-[#1A8CD8] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isApproving || isConfirming ? 'Approving...' : approvalText}
        </button>
      )
    }

    const extensionDays = isUSDC ? Math.floor(parseFloat(amount) * 7) : parseInt(days)
    return (
      <button
        onClick={() => {
          console.log('Triggering extend...')
          handleExtend()
        }}
        disabled={isPending || isConfirming || (a0xAmount === null && !isUSDC)}
        className="w-full px-4 py-3 bg-[#1D9BF0] text-white rounded-lg font-medium transition-colors hover:bg-[#1A8CD8] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {isPending || isConfirming ? 'Extending...' : `Extend Life (${extensionDays} days)`}
      </button>
    )
  }

  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="flex flex-col items-center py-8">
          <p className="text-[#71767B] text-center mb-4">
            Connect your wallet to extend the life of this agent
          </p>
          <button
            onClick={() => openConnectModal()}
            className="px-6 py-3 bg-[#1D9BF0] text-white rounded-lg font-medium transition-colors hover:bg-[#1A8CD8]"
          >
            Connect Wallet
          </button>
        </div>
      )
    }

    if (successDetails) {
      return (
        <div className="flex flex-col items-center py-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Success!</h3>
          <p className="text-[#71767B] text-center mb-2">
            You have successfully extended the life of your agent by {successDetails.days} days
          </p>
          <p className="text-[#71767B] text-center mb-2">
            Amount burned: {successDetails.burnedAmount} {isUSDC ? 'USDC' : 'A0X'}
          </p>
          {successDetails.hash && (
            <a 
              href={`https://basescan.org/tx/${successDetails.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1D9BF0] hover:underline text-sm mb-4"
            >
              View transaction on Basescan
            </a>
          )}
          <button
            onClick={handleClose}
            className="mt-6 px-6 py-3 bg-[#1D9BF0] text-white rounded-lg font-medium transition-colors hover:bg-[#1A8CD8]"
          >
            Close
          </button>
        </div>
      )
    }

    return (
      <>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setIsUSDC(true)
              setDays('')
              setAmount('')
              setA0xAmount(null)
            }}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              isUSDC 
                ? 'bg-[#1D9BF0] text-white' 
                : 'bg-[#2F3336] text-[#71767B] hover:bg-[#2F3336]/80'
            }`}
          >
            USDC
          </button>
        <button
            onClick={() => {
              setIsUSDC(false)
              setDays('')
              setAmount('')
              setA0xAmount(null)
            }}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              !isUSDC 
                ? 'bg-[#1D9BF0] text-white'
                : 'bg-[#2F3336] text-[#71767B] hover:bg-[#2F3336]/80'
            }`}
          >
            A0X
        </button>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            inputMode="decimal"
            value={isUSDC ? amount : days}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, '')
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                if (isUSDC) {
                  setAmount(value)
                } else {
                  setDays(value)
                }
              }
            }}
            placeholder={isUSDC ? 'Amount in USDC' : 'Days to extend'}
            className="w-full px-4 py-3 bg-[#2F3336] rounded-lg text-white placeholder-[#71767B] focus:outline-none focus:ring-2 focus:ring-[#1D9BF0] transition-shadow"
          />
          {!isUSDC && (
            <>
              <div className="flex justify-between items-center px-1">
                <span className="text-sm text-[#71767B]">Required A0X</span>
                <span className="text-sm text-white">{formattedA0XAmount} A0X</span>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-sm text-[#71767B]">Your Balance</span>
                <span className="text-sm text-white">{formattedA0XBalance} A0X</span>
              </div>
            </>
          )}
          {isUSDC && (
            <div className="flex justify-between items-center px-1">
              <span className="text-sm text-[#71767B]">Extension</span>
              <span className="text-sm text-white">{Math.floor(parseFloat(amount || '0') * 7)} days</span>
            </div>
          )}
        </div>

        {renderActionButton()}

        <div className="flex justify-between gap-2 mt-4">
          <button
            onClick={() => disconnect()}
            className="flex-1 px-4 py-3 bg-[#2F3336] text-[#71767B] rounded-lg font-medium transition-colors hover:bg-[#2F3336]/80"
          >
            Disconnect
          </button>
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 bg-[#2F3336] text-white rounded-lg font-medium transition-colors hover:bg-[#2F3336]/80"
          >
            Close
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => {
      if (e.target === e.currentTarget) handleClose()
    }}>
      <div className="relative w-full max-w-md">
        <div className="flex flex-col gap-4 p-6 bg-black/95 rounded-xl border border-[#2F3336] shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <div className="text-lg font-medium text-white">Extend Life</div>
            <button 
              onClick={handleClose}
              className="text-[#71767B] hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  )
} 