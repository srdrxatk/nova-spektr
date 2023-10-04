import { UnsignedTransaction } from '@substrate/txwrapper-polkadot';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Paths, useI18n, useNetworkContext } from '@renderer/app/providers';
import { ChainId, HexString } from '@renderer/domain/shared-kernel';
import { Transaction, TransactionType, useTransaction } from '@renderer/entities/transaction';
import { useAccount, Account, isMultisig } from '@renderer/entities/account';
import InitOperation, { RedeemResult } from './InitOperation/InitOperation';
import { Confirmation, Submit, NoAsset } from '../components';
import { getRelaychainAsset, toAddress, DEFAULT_TRANSITION } from '@renderer/shared/lib/utils';
import { useToggle } from '@renderer/shared/lib/hooks';
import { OperationTitle } from '@renderer/components/common';
import { BaseModal, Button, Loader } from '@renderer/shared/ui';
import { Signing } from '@renderer/features/operation';
import { priceProviderModel } from '@renderer/entities/price';

const enum Step {
  INIT,
  CONFIRMATION,
  SIGNING,
  SUBMIT,
}

export const Redeem = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setTxs, txs, setWrappers, wrapTx, buildTransaction } = useTransaction();
  const { connections } = useNetworkContext();
  const { getLiveAccounts } = useAccount();
  const [searchParams] = useSearchParams();
  const params = useParams<{ chainId: ChainId }>();

  const dbAccounts = getLiveAccounts();

  const [isRedeemModalOpen, toggleRedeemModal] = useToggle(true);

  const [activeStep, setActiveStep] = useState<Step>(Step.INIT);
  const [redeemAmounts, setRedeemAmounts] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txAccounts, setTxAccounts] = useState<Account[]>([]);
  const [signer, setSigner] = useState<Account>();

  const [unsignedTransactions, setUnsignedTransactions] = useState<UnsignedTransaction[]>([]);

  const [signatures, setSignatures] = useState<HexString[]>([]);

  const chainId = params.chainId || ('' as ChainId);
  const accountIds = searchParams.get('id')?.split(',') || [];

  if (!chainId || accountIds.length === 0) {
    return <Navigate replace to={Paths.STAKING} />;
  }

  const { api, explorers, addressPrefix, assets, name } = connections[chainId];
  const asset = getRelaychainAsset(assets);

  useEffect(() => {
    priceProviderModel.events.assetsPricesRequested({ includeRates: true });
  }, []);

  useEffect(() => {
    const selectedAccounts = dbAccounts.reduce<Account[]>((acc, account) => {
      const accountExists = account.id && accountIds.includes(account.id.toString());
      if (accountExists) {
        acc.push(account);
      }

      return acc;
    }, []);

    setAccounts(selectedAccounts);
  }, [dbAccounts.length]);

  const goToPrevStep = () => {
    if (activeStep === Step.INIT) {
      navigate(Paths.STAKING);
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const closeRedeemModal = () => {
    toggleRedeemModal();
    setTimeout(() => navigate(Paths.STAKING), DEFAULT_TRANSITION);
  };

  if (!api?.isConnected) {
    return (
      <BaseModal
        closeButton
        contentClass=""
        panelClass="w-max"
        headerClass="py-3 px-5 max-w-[440px]"
        isOpen={isRedeemModalOpen}
        title={<OperationTitle title={t('staking.redeem.title')} chainId={chainId} />}
        onClose={closeRedeemModal}
      >
        <div className="w-[440px] px-5 py-4">
          <Loader className="my-24 mx-auto" color="primary" size={25} />
          <Button disabled className="w-fit flex-0 mt-7 ml-auto">
            {t('staking.bond.continueButton')}
          </Button>
        </div>
      </BaseModal>
    );
  }

  if (!asset) {
    return (
      <BaseModal
        closeButton
        contentClass=""
        headerClass="py-3 px-5 max-w-[440px]"
        panelClass="w-max"
        isOpen={isRedeemModalOpen}
        title={<OperationTitle title={t('staking.redeem.title')} chainId={chainId} />}
        onClose={closeRedeemModal}
      >
        <div className="w-[440px] px-5 py-20">
          <NoAsset chainName={name} isOpen={isRedeemModalOpen} onClose={closeRedeemModal} />
        </div>
      </BaseModal>
    );
  }

  const getRedeemTxs = (accounts: Account[]): Transaction[] => {
    return accounts.map(({ accountId }) =>
      buildTransaction(TransactionType.REDEEM, toAddress(accountId, { prefix: addressPrefix }), chainId, {
        numSlashingSpans: 1,
      }),
    );
  };

  const onInitResult = ({ accounts, signer, amounts, description }: RedeemResult) => {
    const transactions = getRedeemTxs(accounts);

    if (signer && isMultisig(accounts[0])) {
      setWrappers([
        {
          signatoryId: signer.accountId,
          account: accounts[0],
        },
      ]);
      setSigner(signer);
      setDescription(description || '');
    }

    setTxs(transactions);
    setTxAccounts(accounts);
    setRedeemAmounts(amounts);
    setActiveStep(Step.CONFIRMATION);
  };

  const onSignResult = (signatures: HexString[], unsigned: UnsignedTransaction[]) => {
    setUnsignedTransactions(unsigned);
    setSignatures(signatures);
    setActiveStep(Step.SUBMIT);
  };

  const explorersProps = { explorers, addressPrefix, asset };
  const multisigTx = isMultisig(txAccounts[0]) ? wrapTx(txs[0], api, addressPrefix) : undefined;

  return (
    <>
      <BaseModal
        closeButton
        contentClass=""
        headerClass="py-3 px-5 max-w-[440px]"
        panelClass="w-max"
        isOpen={activeStep !== Step.SUBMIT && isRedeemModalOpen}
        title={<OperationTitle title={t('staking.redeem.title', { asset: asset.symbol })} chainId={chainId} />}
        onClose={closeRedeemModal}
      >
        {activeStep === Step.INIT && (
          <InitOperation api={api} chainId={chainId} accounts={accounts} onResult={onInitResult} {...explorersProps} />
        )}
        {activeStep === Step.CONFIRMATION && (
          <Confirmation
            api={api}
            accounts={txAccounts}
            signer={signer}
            amounts={redeemAmounts}
            description={description}
            transaction={txs[0]}
            onResult={() => setActiveStep(Step.SIGNING)}
            onGoBack={goToPrevStep}
            {...explorersProps}
          />
        )}
        {activeStep === Step.SIGNING && (
          <Signing
            chainId={chainId}
            api={api}
            addressPrefix={addressPrefix}
            signatory={signer}
            accounts={txAccounts}
            transactions={multisigTx ? [multisigTx] : txs}
            onGoBack={() => setActiveStep(Step.CONFIRMATION)}
            onResult={onSignResult}
          />
        )}
      </BaseModal>

      {activeStep === Step.SUBMIT && (
        <Submit
          api={api}
          txs={txs}
          multisigTx={multisigTx}
          description={description}
          signatures={signatures}
          unsignedTx={unsignedTransactions}
          accounts={txAccounts}
          onClose={toggleRedeemModal}
          {...explorersProps}
        />
      )}
    </>
  );
};