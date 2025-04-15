import { ContractConfig } from '../types';

export const CONTRACT_CONFIG: ContractConfig = {
  address: '0x32659ea613ce1706abea4109f9e2d5840196c187',
  abi: [
    {
      anonymous: false,
      inputs: [
        { indexed: false, internalType: 'string', name: 'agentId', type: 'string' },
        { indexed: false, internalType: 'uint256', name: 'usdcAmount', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'a0xBurned', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'newTimeToDeath', type: 'uint256' },
        { indexed: false, internalType: 'bool', name: 'useUSDC', type: 'bool' }
      ],
      name: 'LifeExtended',
      type: 'event'
    }
  ],
  eventTopic: '0x2cfe7b018315264be29a983ebbd20ba03cea5b8f692cec92ff3b44c7c23e227c'
}; 