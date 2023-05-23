import React from 'react';
import cn from 'classnames';

import Icon from '../../../ui/Icon/Icon';

type IconProps = React.ComponentProps<typeof Icon>;

type Props = { onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; ariaLabel?: string } & IconProps;

export const IconButtonStyle =
  'rounded-full outline-offset-1 text-icon-default hover:text-icon-hover hover:bg-hover active:bg-hover active:text-tab-icon-active p-1.5';

// eslint-disable-next-line react/prop-types
const IconButton = ({ onClick, size = 16, className, ariaLabel, ...iconProps }: Props) => {
  return (
    <button type="button" className={cn(IconButtonStyle, className)} aria-label={ariaLabel} onClick={onClick}>
      <Icon size={size} className="text-inherit" {...iconProps} />
    </button>
  );
};

export default IconButton;