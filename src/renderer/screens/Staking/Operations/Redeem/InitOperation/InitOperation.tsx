import { ApiPromise } from '@polkadot/api';
import { BN, BN_ZERO } from '@polkadot/util';
import { useEffect, useState } from 'react';
import cn from 'classnames';

import { Fee, ActiveAddress, Deposit } from '@renderer/components/common';
import { Select, Block, Balance, Plate, Dropdown, Icon } from '@renderer/components/ui';
import { DropdownOption, DropdownResult } from '@renderer/components/ui/Dropdowns/common/types';
import { useI18n } from '@renderer/context/I18nContext';
import { Asset } from '@renderer/domain/asset';
import { Balance as AccountBalance } from '@renderer/domain/balance';
import { ChainId, AccountId, SigningType } from '@renderer/domain/shared-kernel';
import { Transaction, TransactionType } from '@renderer/domain/transaction';
import { useAccount } from '@renderer/services/account/accountService';
import { useBalance } from '@renderer/services/balance/balanceService';
import { redeemableAmount, formatBalance, transferableAmount } from '@renderer/shared/utils/balance';
import { nonNullable } from '@renderer/shared/utils/functions';
import {
  getTotalAccounts,
  validateBalanceForFee,
  getSignatoryOptions,
  validateBalanceForFeeDeposit,
  getRedeemAccountOption,
} from '../../common/utils';
import { OperationForm } from '../../components';
import { toAddress } from '@renderer/shared/utils/address';
import { Account, isMultisig } from '@renderer/domain/account';
import { Explorer } from '@renderer/domain/chain';
import { StakingMap } from '@renderer/services/staking/common/types';

export type RedeemResult = {
  accounts: Account[];
  amounts: string[];
  signer?: Account;
  description?: string;
};

type Props = {
  api: ApiPromise;
  chainId: ChainId;
  addressPrefix: number;
  explorers?: Explorer[];
  identifiers: string[];
  era?: number;
  staking: StakingMap;
  asset: Asset;
  onResult: (stakeMore: RedeemResult) => void;
};

const InitOperation = ({
  api,
  chainId,
  addressPrefix,
  explorers,
  identifiers,
  staking,
  era,
  asset,
  onResult,
}: Props) => {
  const { t } = useI18n();
  const { getLiveBalance, getLiveAssetBalances } = useBalance();
  const { getLiveAccounts } = useAccount();

  const dbAccounts = getLiveAccounts();

  const [fee, setFee] = useState('');
  const [deposit, setDeposit] = useState('');
  const [redeemAmounts, setRedeemAmounts] = useState<string[]>([]);

  const [transferableRange, setTransferableRange] = useState<[string, string]>(['0', '0']);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [redeemAccounts, setRedeemAccounts] = useState<DropdownOption<Account>[]>([]);
  const [activeRedeemAccounts, setActiveRedeemAccounts] = useState<DropdownResult<Account>[]>([]);

  const [activeSignatory, setActiveSignatory] = useState<DropdownResult<Account>>();
  const [signatoryOptions, setSignatoryOptions] = useState<DropdownOption<Account>[]>([]);

  const [activeBalances, setActiveBalances] = useState<AccountBalance[]>([]);

  const totalAccounts = getTotalAccounts(dbAccounts, identifiers);

  const accountIds = totalAccounts.map((account) => account.accountId);
  const signerBalance = getLiveBalance(activeSignatory?.value.accountId || '0x0', chainId, asset.assetId.toString());
  const balances = getLiveAssetBalances(accountIds, chainId, asset.assetId.toString());

  const totalRedeem = redeemAmounts.reduce((acc, amount) => acc.add(new BN(amount)), BN_ZERO).toString();

  const firstAccount = activeRedeemAccounts[0]?.value;
  const accountIsMultisig = isMultisig(firstAccount);
  const redeemBalance = formatBalance(totalRedeem, asset.precision);
  const formFields = accountIsMultisig
    ? [{ name: 'amount', value: redeemBalance.value, disabled: true }, { name: 'description' }]
    : [{ name: 'amount', value: redeemBalance.value, disabled: true }];

  useEffect(() => {
    const balancesMap = new Map(balances.map((balance) => [balance.accountId, balance]));
    const newActiveBalances = activeRedeemAccounts
      .map((a) => balancesMap.get(a.id as AccountId))
      .filter(nonNullable) as AccountBalance[];

    setActiveBalances(newActiveBalances);
  }, [activeRedeemAccounts.length, balances]);

  useEffect(() => {
    if (signerBalance) {
      const balance = transferableAmount(signerBalance);
      setTransferableRange([balance, balance]);
    } else if (activeRedeemAccounts.length) {
      const balancesMap = new Map(activeBalances.map((b) => [b.accountId, b]));
      const transferable = activeRedeemAccounts.map((a) => transferableAmount(balancesMap.get(a.id as AccountId)));
      const minMaxTransferable = transferable.reduce<[string, string]>(
        (acc, balance) => {
          if (balance) {
            acc[0] = new BN(balance).lt(new BN(acc[0])) ? balance : acc[0];
            acc[1] = new BN(balance).gt(new BN(acc[1])) ? balance : acc[1];
          }

          return acc;
        },
        [transferable?.[0], transferable?.[0]],
      );

      setTransferableRange(minMaxTransferable);
    }
  }, [activeRedeemAccounts.length, signerBalance, activeBalances]);

  useEffect(() => {
    const formattedAccounts = totalAccounts.map((account) => {
      const address = toAddress(account.accountId, { prefix: addressPrefix });
      const stake = staking[address];

      return getRedeemAccountOption(account, { asset, addressPrefix, stake, era });
    });

    setRedeemAccounts(formattedAccounts);
  }, [totalAccounts.length, staking, era]);

  useEffect(() => {
    if (!era) return;

    const amounts = activeRedeemAccounts.map(({ value }) => {
      const address = toAddress(value.accountId, { prefix: addressPrefix });

      return redeemableAmount(staking[address]?.unlocking, era);
    });

    setRedeemAmounts(amounts);
  }, [activeRedeemAccounts.length, staking, era]);

  useEffect(() => {
    if (!accountIsMultisig) return;

    const signatories = firstAccount.signatories.map((s) => s.accountId);
    const signers = dbAccounts.filter((a) => signatories.includes(a.accountId));
    const options = getSignatoryOptions(signers, addressPrefix);

    if (options.length === 0) return;

    setSignatoryOptions(options);
    setActiveSignatory({ id: options[0].id, value: options[0].value });
  }, [firstAccount, accountIsMultisig, dbAccounts]);

  useEffect(() => {
    if (redeemAccounts.length === 0) return;

    const activeAccounts = redeemAccounts.map(({ id, value }) => ({ id, value }));
    setActiveRedeemAccounts(activeAccounts);
  }, [redeemAccounts.length]);

  useEffect(() => {
    const newTransactions = activeRedeemAccounts.map(({ value }) => {
      return {
        chainId,
        address: toAddress(value.accountId, { prefix: addressPrefix }),
        type: TransactionType.REDEEM,
        args: { numSlashingSpans: 1 },
      };
    });

    setTransactions(newTransactions);
  }, [activeRedeemAccounts.length]);

  const submitRedeem = (data: { description?: string }) => {
    onResult({
      amounts: redeemAmounts,
      accounts: activeRedeemAccounts.map((activeOption) => activeOption.value),
      ...(accountIsMultisig && {
        description: data.description,
        signer: activeSignatory?.value,
      }),
    });
  };

  const validateFee = (): boolean => {
    return activeBalances.every((b) => validateBalanceForFee(b, fee));
  };

  const validateDeposit = (): boolean => {
    if (!accountIsMultisig) return true;
    if (!signerBalance) return false;

    return validateBalanceForFeeDeposit(signerBalance, deposit, fee);
  };

  const transferable =
    transferableRange[0] === transferableRange[1] ? (
      <Balance value={transferableRange[0]} precision={asset.precision} />
    ) : (
      <>
        <Balance value={transferableRange[0]} precision={asset.precision} />
        &nbsp;{'-'}&nbsp;
        <Balance value={transferableRange[1]} precision={asset.precision} />
      </>
    );

  return (
    <Plate as="section" className="w-[600px] flex flex-col items-center mx-auto gap-y-2.5">
      <Block className="flex flex-col gap-y-2 p-5">
        {redeemAccounts.length > 1 ? (
          <Select
            weight="lg"
            placeholder={t('staking.bond.selectStakeAccountLabel')}
            summary={t('staking.bond.selectStakeAccountSummary')}
            activeIds={activeRedeemAccounts.map((acc) => acc.id)}
            options={redeemAccounts}
            onChange={setActiveRedeemAccounts}
          />
        ) : (
          <ActiveAddress
            address={firstAccount?.accountId}
            accountName={firstAccount?.name}
            signingType={firstAccount?.signingType}
            explorers={explorers}
            addressPrefix={addressPrefix}
          />
        )}

        {accountIsMultisig &&
          (signatoryOptions.length > 1 ? (
            <Dropdown
              weight="lg"
              placeholder={t('general.input.signerLabel')}
              activeId={activeSignatory?.id}
              options={signatoryOptions}
              onChange={setActiveSignatory}
            />
          ) : (
            <ActiveAddress
              address={signatoryOptions[0]?.value.accountId}
              accountName={signatoryOptions[0]?.value.name}
              signingType={SigningType.PARITY_SIGNER}
              explorers={explorers}
              addressPrefix={addressPrefix}
            />
          ))}
      </Block>

      <OperationForm
        chainId={chainId}
        canSubmit={activeRedeemAccounts.length > 0}
        addressPrefix={addressPrefix}
        fields={formFields}
        asset={asset}
        validateFee={validateFee}
        validateDeposit={validateDeposit}
        onSubmit={submitRedeem}
      >
        {(errorType) => {
          const hasFeeError = ['insufficientBalanceForFee', 'insufficientBalanceForDeposit'].includes(errorType);

          return (
            <>
              <div className="flex justify-between items-center uppercase text-neutral-variant text-2xs">
                <p>{t('staking.unstake.transferable')}</p>

                <div className={cn('flex font-semibold', hasFeeError ? 'text-error' : 'text-neutral')}>
                  {hasFeeError && <Icon className="text-error mr-1" name="warnCutout" size={12} />}
                  {transferable}&nbsp;{asset.symbol}
                </div>
              </div>

              <div className="grid grid-flow-row grid-cols-2 items-center gap-y-5">
                <p className="uppercase text-neutral-variant text-2xs">
                  {t('staking.unstake.networkFee', { count: activeRedeemAccounts.length })}
                </p>

                <Fee
                  className="text-neutral justify-self-end text-2xs font-semibold"
                  api={api}
                  asset={asset}
                  transaction={transactions[0]}
                  onFeeChange={setFee}
                />
                {accountIsMultisig && (
                  <>
                    <p className="uppercase text-neutral-variant text-2xs">{t('transfer.networkDeposit')}</p>
                    <Deposit
                      className="text-neutral justify-self-end text-2xs font-semibold"
                      api={api}
                      asset={asset}
                      threshold={firstAccount.threshold}
                      onDepositChange={setDeposit}
                    />
                  </>
                )}
              </div>
            </>
          );
        }}
      </OperationForm>
    </Plate>
  );
};

export default InitOperation;