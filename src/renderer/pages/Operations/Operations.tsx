import { useEffect, useState } from 'react';
import { groupBy } from 'lodash';
import { format } from 'date-fns';

import { useI18n, useNetworkContext } from '@renderer/app/providers';
import EmptyOperations from './components/EmptyState/EmptyOperations';
import { useAccount, MultisigAccount } from '@renderer/entities/account';
import Operation from './components/Operation';
import { sortByDateDesc } from './common/utils';
import { FootnoteText } from '@renderer/shared/ui';
import { MultisigTransactionDS } from '@renderer/shared/api/storage';
import { useMultisigTx, useMultisigEvent } from '@renderer/entities/multisig';
import { Header } from '@renderer/components/common';
import { MultisigEvent, MultisigTransactionKey } from '@renderer/entities/transaction';
import { OperationsFilter } from '@renderer/features/operation';
import { priceProviderModel } from '@renderer/entities/price';

export const Operations = () => {
  const { t, dateLocale } = useI18n();
  const { connections } = useNetworkContext();
  const { getActiveMultisigAccount } = useAccount();
  const { getLiveAccountMultisigTxs } = useMultisigTx({});
  const { getLiveEventsByKeys } = useMultisigEvent({});

  const account = getActiveMultisigAccount();
  const allTxs = getLiveAccountMultisigTxs(account?.accountId ? [account.accountId] : []);

  const [txs, setTxs] = useState<MultisigTransactionDS[]>([]);
  const [filteredTxs, setFilteredTxs] = useState<MultisigTransactionDS[]>([]);

  const events = getLiveEventsByKeys(txs.filter((tx) => !tx.dateCreated));

  const getEventsByTransaction = (tx: MultisigTransactionKey): MultisigEvent[] => {
    return events.filter((e) => {
      return (
        e.txAccountId === tx.accountId &&
        e.txChainId === tx.chainId &&
        e.txCallHash === tx.callHash &&
        e.txBlock === tx.blockCreated &&
        e.txIndex === tx.indexCreated
      );
    });
  };

  const groupedTxs = groupBy(filteredTxs, (tx) => {
    const date = tx.dateCreated || getEventsByTransaction(tx)[0]?.dateCreated || Date.now();

    return format(new Date(date), 'PP', { locale: dateLocale });
  });

  useEffect(() => {
    priceProviderModel.events.assetsPricesRequested({ includeRates: true });
  }, []);

  useEffect(() => {
    setTxs(allTxs.filter((tx) => connections[tx.chainId]));
  }, [allTxs.length]);

  useEffect(() => {
    setFilteredTxs([]);
  }, [account?.accountId]);

  return (
    <div className="flex flex-col items-center relative h-full">
      <Header title={t('operations.title')} />

      {Boolean(txs.length) && <OperationsFilter txs={txs} onChange={setFilteredTxs} />}

      {Boolean(filteredTxs.length) && (
        <div className="pl-6 overflow-y-auto w-full mt-4 h-full flex flex-col items-center">
          {Object.entries(groupedTxs)
            .sort(sortByDateDesc)
            .map(([date, txs]) => (
              <section className="w-fit mt-6" key={date}>
                <FootnoteText className="text-text-tertiary mb-3 ml-2">{date}</FootnoteText>
                <ul className="flex flex-col gap-y-1.5 w-[736px]">
                  {txs
                    .sort((a, b) => (b.dateCreated || 0) - (a.dateCreated || 0))
                    .map((tx) => (
                      <li key={tx.dateCreated}>
                        <Operation tx={tx} account={account as MultisigAccount} />
                      </li>
                    ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {!filteredTxs.length && (
        <EmptyOperations multisigAccount={account} isEmptyFromFilters={txs.length !== filteredTxs.length} />
      )}
    </div>
  );
};