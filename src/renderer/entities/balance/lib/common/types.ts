import { BalanceDS } from '@shared/api/storage/common/types';
import type { ChainId, AccountId, Balance } from '@shared/core';

export interface IBalanceService {
  getBalance: (accountId: AccountId, chainId: ChainId, assetId: string) => Promise<BalanceDS | undefined>;
  getBalances: (accountIds: AccountId[]) => Promise<BalanceDS[]>;
  getAllBalances: () => Promise<BalanceDS[]>;
  insertBalances: (balances: Balance[]) => Promise<string[]>;
}