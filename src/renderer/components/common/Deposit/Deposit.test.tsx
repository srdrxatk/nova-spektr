import { ApiPromise } from '@polkadot/api';
import { act, render, screen } from '@testing-library/react';

import { Balance } from '@renderer/components/ui';
import { Asset } from '@renderer/domain/asset';
import Deposit from './Deposit';

jest.mock('@renderer/components/ui');

jest.mock('@renderer/context/I18nContext', () => ({
  useI18n: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('@renderer/services/transaction/transactionService', () => ({
  useTransaction: jest.fn().mockReturnValue({
    getTransactionDeposit: jest.fn().mockReturnValue('46'),
  }),
}));

describe('components/common/Fee', () => {
  beforeAll(() => {
    (Balance as jest.Mock).mockImplementation(({ value }: any) => <p>{value}</p>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should render component', async () => {
    const asset = { symbol: 'DOT', precision: 10 } as Asset;

    await act(async () => {
      render(<Deposit api={{} as ApiPromise} asset={asset} threshold={3} />);
    });

    const value = screen.getByText('46');
    expect(value).toBeInTheDocument();
  });
});