import { act, screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Popover from './Popover';

describe('ui/Popover', () => {
  test('should render component', () => {
    render(<Popover content="content">Hover me</Popover>);

    const text = screen.getByText('Hover me');
    const content = screen.queryByText('content');
    expect(text).toBeInTheDocument();
    expect(content).not.toBeInTheDocument();
  });

  test('should toggle popover on hover/unhover', async () => {
    const user = userEvent.setup();

    render(<Popover content="content">Hover me</Popover>);

    const text = screen.getByText('Hover me');
    let content = screen.queryByText('content');
    expect(content).not.toBeInTheDocument();

    await act(async () => user.hover(text));

    content = screen.getByText('content');
    expect(content).toBeInTheDocument();

    await act(async () => user.unhover(text));

    content = screen.queryByText('content');
    expect(content).not.toBeInTheDocument();
  });

  test('should toggle popover on focus/blur', async () => {
    render(<Popover content="content">Hover me</Popover>);

    const text = screen.getByText('Hover me');
    let content = screen.queryByText('content');
    expect(content).not.toBeInTheDocument();

    await act(async () => text.focus());

    content = screen.getByText('content');
    expect(content).toBeInTheDocument();

    await act(async () => text.blur());

    content = screen.queryByText('content');
    expect(content).not.toBeInTheDocument();
  });
});