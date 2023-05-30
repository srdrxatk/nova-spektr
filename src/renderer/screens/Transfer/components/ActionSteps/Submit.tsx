import { ApiPromise } from '@polkadot/api';
import { UnsignedTransaction } from '@substrate/txwrapper-polkadot';
import React, { useEffect, useState } from 'react';

import { useI18n } from '@renderer/context/I18nContext';
import {
  MultisigEvent,
  SigningStatus,
  Transaction,
  MultisigTransaction,
  MultisigTxInitStatus,
} from '@renderer/domain/transaction';
import { HexString } from '@renderer/domain/shared-kernel';
import { useTransaction } from '@renderer/services/transaction/transactionService';
import { useMatrix } from '@renderer/context/MatrixContext';
import { Account, MultisigAccount } from '@renderer/domain/account';
import { ExtrinsicResultParams } from '@renderer/services/transaction/common/types';
import { useMultisigTx } from '@renderer/services/multisigTx/multisigTxService';
import { toAccountId } from '@renderer/shared/utils/address';
import { useToggle } from '@renderer/shared/hooks';
import { Button } from '@renderer/components/ui-redesign';
import OperationResult from '@renderer/components/ui-redesign/OperationResult/OperationResult';

type ResultProps = Pick<React.ComponentProps<typeof OperationResult>, 'title' | 'description' | 'variant'>;

type Props = {
  api: ApiPromise;
  account?: Account | MultisigAccount;
  tx: Transaction;
  multisigTx?: Transaction;
  unsignedTx: UnsignedTransaction;
  signature: HexString;
  description?: string;
  onClose?: () => void;
};

const Submit = ({ api, tx, multisigTx, account, unsignedTx, signature, description, onClose }: Props) => {
  const { t } = useI18n();

  const { matrix } = useMatrix();
  const { submitAndWatchExtrinsic, getSignedExtrinsic } = useTransaction();
  const { addMultisigTx } = useMultisigTx();

  const [inProgress, toggleInProgress] = useToggle(true);
  const [successMessage, toggleSuccessMessage] = useToggle();
  const [errorMessage, setErrorMessage] = useState('');

  const closeSuccessMessage = () => {
    onClose?.();
    toggleSuccessMessage();
  };

  const closeErrorMessage = () => {
    onClose?.();
    setErrorMessage('');
  };

  const submitExtrinsic = async (signature: HexString) => {
    const extrinsic = await getSignedExtrinsic(unsignedTx, signature, api);

    submitAndWatchExtrinsic(extrinsic, unsignedTx, api, (executed, params) => {
      if (executed) {
        const typedParams = params as ExtrinsicResultParams;

        if (multisigTx && tx && account?.accountId) {
          const eventStatus: SigningStatus = 'SIGNED';

          const event: MultisigEvent = {
            status: eventStatus,
            accountId: account.accountId,
            extrinsicHash: typedParams.extrinsicHash,
            eventBlock: typedParams.timepoint.height,
            eventIndex: typedParams.timepoint.index,
          };

          const newTx: MultisigTransaction = {
            accountId: account.accountId,
            chainId: multisigTx.chainId,
            signatories: (account as MultisigAccount).signatories,
            callData: multisigTx.args.callData,
            callHash: multisigTx.args.callHash,
            transaction: tx,
            status: MultisigTxInitStatus.SIGNING,
            blockCreated: typedParams.timepoint.height,
            indexCreated: typedParams.timepoint.index,

            events: [event],
          };

          if (matrix.userIsLoggedIn) {
            sendMultisigEvent(newTx, typedParams);
          } else {
            addMultisigTx(newTx);
          }
        }

        toggleSuccessMessage();
        setTimeout(closeSuccessMessage, 2000);
      } else {
        setErrorMessage(params as string);
      }
      toggleInProgress();
    });
  };

  const sendMultisigEvent = (updatedTx: MultisigTransaction, params: ExtrinsicResultParams) => {
    if (!tx || !updatedTx || !multisigTx) return;

    const matrixRoomId = (account as MultisigAccount).matrixRoomId;

    const payload = {
      senderAccountId: toAccountId(multisigTx.address),
      chainId: updatedTx.chainId,
      callHash: updatedTx.callHash,
      callData: updatedTx.callData,
      extrinsicTimepoint: params.timepoint,
      extrinsicHash: params.extrinsicHash,
      error: Boolean(params.multisigError),
      description,
      callTimepoint: {
        height: updatedTx.blockCreated || params.timepoint.height,
        index: updatedTx.indexCreated || params.timepoint.index,
      },
    };

    if (!matrixRoomId) return;

    matrix.sendApprove(matrixRoomId, payload).catch(console.warn);
  };

  const getResultProps = (): ResultProps => {
    if (inProgress) {
      return { title: t('operation.inProgress'), variant: 'loading' };
    }
    if (successMessage) {
      return { title: t('operation.successMessage'), variant: 'success' };
    }
    if (errorMessage) {
      return { title: t('operation.feeErrorTitle'), description: errorMessage, variant: 'error' };
    }

    return { title: '' };
  };

  useEffect(() => {
    submitExtrinsic(signature);
  }, []);

  return (
    <>
      <OperationResult
        isOpen={Boolean(inProgress || errorMessage || successMessage)}
        {...getResultProps()}
        onClose={() => onClose?.()}
      >
        {errorMessage && <Button onClick={closeErrorMessage}>{t('operation.feeErrorButton')}</Button>}
      </OperationResult>
    </>
  );
};

export default Submit;