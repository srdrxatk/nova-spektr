import { Controller, FieldErrors, SubmitHandler, useForm } from 'react-hook-form';
import { useEffect } from 'react';

import { BaseModal, Button, Icon, Identicon, Input, InputHint } from '@renderer/components/ui';
import { useI18n } from '@renderer/context/I18nContext';
import { AccountID, ErrorType } from '@renderer/domain/shared-kernel';
import { useContact } from '@renderer/services/contact/contactService';
import { pasteAddressHandler, toPublicKey } from '@renderer/shared/utils/address';
import { validateAddress, validateMatrixId } from '../utils/validation';
import { ContactDS } from '@renderer/services/storage';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  contact?: ContactDS;
};

type ContactForm = {
  name: string;
  matrixId?: string;
  accountId: AccountID;
};

const getButtonText = (errors: FieldErrors<ContactForm>, isEdit: boolean): string => {
  if (errors.accountId && errors.name) {
    return 'addressBook.addContact.typeAddressAndNameButton';
  }

  if (errors.accountId) {
    return 'addressBook.addContact.typeAddressButton';
  }

  if (errors.name) {
    return 'addressBook.addContact.typeNameButton';
  }

  if (isEdit) {
    return 'addressBook.editContact.saveContactButton';
  }

  return 'addressBook.addContact.addContactButton';
};

const ContactModal = ({ isOpen, onToggle, contact }: Props) => {
  const { t } = useI18n();

  const { addContact, updateContact } = useContact();

  const isEdit = contact !== undefined;

  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
    reset,
    resetField,
  } = useForm<ContactForm>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      matrixId: '',
      accountId: '',
    },
  });

  useEffect(() => {
    reset({
      name: isEdit ? contact.name : '',
      matrixId: isEdit ? contact.matrixId : '',
      accountId: isEdit ? contact.accountId : '',
    });
  }, [contact]);

  const onSubmit: SubmitHandler<ContactForm> = async (newContact) => {
    const updatedContact = {
      ...contact,
      ...newContact,
      publicKey: toPublicKey(newContact.accountId) || '0x',
    };

    if (isEdit) {
      await updateContact(updatedContact);
    } else {
      await addContact(updatedContact);
    }

    onToggle();
  };

  return (
    <BaseModal
      title={t(isEdit ? 'addressBook.editContact.title' : 'addressBook.addContact.title')}
      closeButton
      isOpen={isOpen}
      contentClass="px-5 pb-4 w-[520px]"
      onClose={onToggle}
    >
      <form className="flex flex-col mt-14 mb-3 gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="name"
          control={control}
          rules={{ required: true }}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <>
              <Input
                className="w-full"
                label={t('addressBook.addContact.nameLabel')}
                placeholder={t('addressBook.addContact.namePlaceholder')}
                invalid={Boolean(error)}
                value={value}
                onChange={onChange}
              />
              <InputHint variant="error" active={Boolean(error)}>
                {t('addressBook.addContact.nameRequiredError')}
              </InputHint>
            </>
          )}
        />
        <Controller
          name="matrixId"
          control={control}
          rules={{ validate: validateMatrixId }}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <>
              <Input
                suffixElement={
                  value && (
                    <button
                      className="text-neutral"
                      type="button"
                      onClick={() => resetField('matrixId', { defaultValue: '' })}
                    >
                      <Icon name="clearOutline" />
                    </button>
                  )
                }
                className="w-full"
                label={t('addressBook.addContact.matrixIdLabel')}
                placeholder={t('addressBook.addContact.matrixIdPlaceholder')}
                invalid={Boolean(error)}
                value={value}
                onChange={onChange}
              />
              <InputHint variant="error" active={Boolean(error)}>
                {t('addressBook.addContact.matrixIdError')}
              </InputHint>
            </>
          )}
        />
        <Controller
          name="accountId"
          control={control}
          rules={{ required: true, validate: validateAddress }}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <>
              <Input
                prefixElement={
                  value && !error ? <Identicon address={value} background={false} /> : <Icon name="emptyIdenticon" />
                }
                suffixElement={
                  value ? (
                    <button
                      className="text-neutral"
                      type="button"
                      onClick={() => resetField('accountId', { defaultValue: '' })}
                    >
                      <Icon name="clearOutline" />
                    </button>
                  ) : (
                    <Button variant="outline" pallet="primary" onClick={pasteAddressHandler(onChange)}>
                      {t('transfer.pasteButton')}
                    </Button>
                  )
                }
                className="w-full"
                label={t('addressBook.addContact.accountIdLabel')}
                placeholder={t('addressBook.addContact.accountIdPlaceholder')}
                invalid={Boolean(error)}
                value={value}
                onChange={onChange}
              />
              <InputHint variant="error" active={error?.type === ErrorType.REQUIRED}>
                {t('addressBook.addContact.accountIdRequiredError')}
              </InputHint>
              <InputHint variant="error" active={error?.type === ErrorType.VALIDATE}>
                {t('addressBook.addContact.accountIdIncorrectError')}
              </InputHint>
            </>
          )}
        />

        <InputHint variant="hint" active={true}>
          {t('addressBook.editContact.editWarning')}
        </InputHint>

        <Button
          weight="lg"
          className="w-fit self-center"
          pallet="primary"
          variant="fill"
          type="submit"
          disabled={!isValid}
        >
          {t(getButtonText(errors, isEdit))}
        </Button>
      </form>
    </BaseModal>
  );
};

export default ContactModal;