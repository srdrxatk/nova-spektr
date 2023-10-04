import { UnsignedTransaction } from '@substrate/txwrapper-polkadot';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Paths, useI18n, useNetworkContext } from '@renderer/app/providers';
import { ChainId, HexString } from '@renderer/domain/shared-kernel';
import { Transaction, TransactionType, useTransaction } from '@renderer/entities/transaction';
import InitOperation, { StakeMoreResult } from './InitOperation/InitOperation';
import { Confirmation, NoAsset, Submit } from '../components';
import { DEFAULT_TRANSITION, getRelaychainAsset, toAddress } from '@renderer/shared/lib/utils';
import { useToggle } from '@renderer/shared/lib/hooks';
import { Account, isMultisig, useAccount } from '@renderer/entities/account';
import { Alert, BaseModal, Button, Loader } from '@renderer/shared/ui';
import { OperationTitle } from '@renderer/components/common';
import { Signing } from '@renderer/features/operation';
import { priceProviderModel } from '@renderer/entities/price';

const enum Step {
  INIT,
  CONFIRMATION,
  SIGNING,
  SUBMIT,
}

export const StakeMore = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { getActiveAccounts } = useAccount();
  const { setTxs, txs, setWrappers, wrapTx, buildTransaction } = useTransaction();
  const { connections } = useNetworkContext();
  const [searchParams] = useSearchParams();
  const params = useParams<{ chainId: ChainId }>();

  const [isStakeMoreModalOpen, toggleStakeMoreModal] = useToggle(true);
  const [isAlertOpen, toggleAlert] = useToggle(true);

  const [activeStep, setActiveStep] = useState<Step>(Step.INIT);

  const [stakeMoreAmount, setStakeMoreAmount] = useState('');
  const [description, setDescription] = useState('');

  const [unsignedTransactions, setUnsignedTransactions] = useState<UnsignedTransaction[]>([]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txAccounts, setTxAccounts] = useState<Account[]>([]);
  const [signer, setSigner] = useState<Account>();
  const [signatures, setSignatures] = useState<HexString[]>([]);

  const accountIds = searchParams.get('id')?.split(',') || [];
  const chainId = params.chainId || ('' as ChainId);
  const activeAccounts = getActiveAccounts();

  useEffect(() => {
    priceProviderModel.events.assetsPricesRequested({ includeRates: true });
  }, []);

  useEffect(() => {
    if (!activeAccounts.length || !accountIds.length) return;

    const accounts = activeAccounts.filter((a) => a.id && accountIds.includes(a.id.toString()));
    setAccounts(accounts);
  }, [activeAccounts.length]);

  const connection = connections[chainId];

  if (!connection || accountIds.length === 0) {
    return <Navigate replace to={Paths.STAKING} />;
  }

  const { api, explorers, addressPrefix, assets, name } = connections[chainId];
  const asset = getRelaychainAsset(assets);

  const goToPrevStep = () => {
    if (activeStep === Step.INIT) {
      navigate(Paths.STAKING);
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const closeStakeMoreModal = () => {
    toggleStakeMoreModal();
    setTimeout(() => navigate(Paths.STAKING), DEFAULT_TRANSITION);
  };

  if (!api?.isConnected) {
    return (
      <BaseModal
        closeButton
        contentClass=""
        headerClass="py-3 px-5 max-w-[440px]"
        panelClass="w-max"
        isOpen={isStakeMoreModalOpen}
        title={<OperationTitle title={t('staking.stakeMore.title')} chainId={chainId} />}
        onClose={closeStakeMoreModal}
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
        panelClass="w-max"
        headerClass="py-3 px-5 max-w-[440px]"
        isOpen={isStakeMoreModalOpen}
        title={<OperationTitle title={t('staking.stakeMore.title')} chainId={chainId} />}
        onClose={closeStakeMoreModal}
      >
        <div className="w-[440px] px-5 py-20">
          <NoAsset chainName={name} isOpen={isStakeMoreModalOpen} onClose={closeStakeMoreModal} />
        </div>
      </BaseModal>
    );
  }

  const getStakeMoreTxs = (accounts: Account[], amount: string): Transaction[] => {
    return accounts.map(({ accountId }) =>
      buildTransaction(TransactionType.STAKE_MORE, toAddress(accountId, { prefix: addressPrefix }), chainId, {
        maxAdditional: amount,
      }),
    );
  };

  const onInitResult = ({ accounts, amount, signer, description }: StakeMoreResult) => {
    const transactions = getStakeMoreTxs(accounts, amount);

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
    setStakeMoreAmount(amount);
    setActiveStep(Step.CONFIRMATION);
  };

  const onSignResult = (signatures: HexString[], unsigned: UnsignedTransaction[]) => {
    setUnsignedTransactions(unsigned);
    setSignatures(signatures);
    setActiveStep(Step.SUBMIT);
  };

  const explorersProps = { explorers, addressPrefix, asset };
  const stakeMoreValues = new Array(txAccounts.length).fill(stakeMoreAmount);
  const multisigTx = isMultisig(txAccounts[0]) ? wrapTx(txs[0], api, addressPrefix) : undefined;

  return (
    <>
      <BaseModal
        closeButton
        contentClass=""
        headerClass="py-3 px-5 max-w-[440px]"
        panelClass="w-max"
        isOpen={activeStep !== Step.SUBMIT && isStakeMoreModalOpen}
        title={<OperationTitle title={t('staking.stakeMore.title', { asset: asset.symbol })} chainId={chainId} />}
        onClose={closeStakeMoreModal}
      >
        {activeStep === Step.INIT && (
          <InitOperation api={api} chainId={chainId} accounts={accounts} onResult={onInitResult} {...explorersProps} />
        )}
        {activeStep === Step.CONFIRMATION && (
          <Confirmation
            api={api}
            accounts={txAccounts}
            signer={signer}
            transaction={txs[0]}
            description={description}
            amounts={stakeMoreValues}
            onResult={() => setActiveStep(Step.SIGNING)}
            onGoBack={goToPrevStep}
            {...explorersProps}
          >
            {isAlertOpen && (
              <Alert title={t('staking.confirmation.hintTitle')} onClose={toggleAlert}>
                <Alert.Item>{t('staking.confirmation.hintNewRewards')}</Alert.Item>
              </Alert>
            )}
          </Confirmation>
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
          signatures={signatures}
          unsignedTx={unsignedTransactions}
          accounts={txAccounts}
          description={description}
          onClose={toggleStakeMoreModal}
          {...explorersProps}
        />
      )}
    </>
  );
};