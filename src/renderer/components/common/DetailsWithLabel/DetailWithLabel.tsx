import { PropsWithChildren } from 'react';
import cn from 'classnames';

import { FootnoteText } from '@renderer/components/ui-redesign';
import { LabelStyle, RowStyle } from '../../../screens/Operations/common/constants';

export type DetailWithLabelProps = PropsWithChildren<{ label: string }>;

const DetailWithLabel = ({ label, children, className }: DetailWithLabelProps & { className: string }) => (
  <div className={RowStyle}>
    <FootnoteText as="dt" className={LabelStyle}>
      {label}
    </FootnoteText>
    {typeof children === 'string' ? (
      <FootnoteText as="dd" className={cn(className, 'py-[3px] px-2')}>
        {children}
      </FootnoteText>
    ) : (
      <dd className={cn('flex items-center gap-1', className)}>{children}</dd>
    )}
  </div>
);

export default DetailWithLabel;