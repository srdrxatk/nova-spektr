import { Transaction } from '@renderer/domain/transaction';
import TransactionAmount from '@renderer/screens/Operations/components/TransactionAmount';
import { Button, FootnoteText } from '@renderer/components/ui-redesign';
import { Deposit, Fee } from '@renderer/components/common';
import { Account, MultisigAccount } from '@renderer/domain/account';
import { ExtendedChain } from '@renderer/services/network/common/types';
import { useI18n } from '@renderer/context/I18nContext';
import Details from '../Details';
import DetailWithLabel from '@renderer/components/common/DetailsWithLabel/DetailWithLabel';
import { Icon } from '@renderer/components/ui';

const AmountFontStyle = 'font-manrope text-text-primary text-[32px] leading-[36px] font-bold';

type Props = {
  transaction: Transaction;
  account: Account | MultisigAccount;
  signatory?: Account;
  description?: string;
  connection: ExtendedChain;
  feeTx?: Transaction;
  onResult?: () => void;
  onBack?: () => void;
};

const Confirmation = ({ account, connection, transaction, signatory, description, feeTx, onResult, onBack }: Props) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-y-3">
      {transaction && <TransactionAmount tx={transaction} showIcon={false} className={AmountFontStyle} />}

      {description && (
        <FootnoteText className="py-2 px-3 rounded bg-block-background ml-3 text-text-secondary">
          {description}
        </FootnoteText>
      )}

      <Details
        transaction={transaction}
        account={account}
        signatory={signatory}
        connection={connection}
        withAdvanced={false}
        description={description}
      />

      <hr className="border-divider my-1 w-full" />

      <DetailWithLabel label={t('operation.networkFee')} className="text-text-primary">
        {connection.api && feeTx && (
          <Fee
            className="text-footnote text-text-primary"
            api={connection.api}
            asset={connection.assets[0]}
            transaction={feeTx}
          />
        )}
      </DetailWithLabel>

      {signatory && (
        <DetailWithLabel label={t('transfer.networkDeposit')} className="text-text-primary">
          {connection.api && feeTx && (
            <Deposit
              className="text-footnote text-text-primary"
              api={connection.api}
              asset={connection.assets[0]}
              threshold={(account as MultisigAccount).threshold}
            />
          )}
        </DetailWithLabel>
      )}

      <div className="flex w-full justify-between mt-5">
        <Button variant="text" onClick={onResult}>
          {t('operation.goBackButton')}
        </Button>

        <Button prefixElement={<Icon name="vault" size={14} />} onClick={onResult}>
          {t('operation.signButton')}
        </Button>
      </div>
    </div>
  );
};

export default Confirmation;