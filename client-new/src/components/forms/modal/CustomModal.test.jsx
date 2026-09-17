// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CustomModal from './CustomModal';

afterEach(cleanup);

const open = (props = {}) =>
  render(
    <CustomModal isOpen title="Add User" onClose={() => {}} {...props}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </CustomModal>
  );

describe('CustomModal', () => {
  it('announces itself as a dialog named by its title', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Add User').id).toBe(dialog.getAttribute('aria-labelledby'));
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // Without a trap, Tab walked out of the panel and onto the page behind the
  // overlay, which the reader cannot see.
  it('keeps Tab inside the panel', () => {
    open();
    const close = screen.getByLabelText('Close');
    const last = screen.getByText('Last');

    last.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('stops the page behind it scrolling, and lets it again on close', () => {
    const { unmount } = open();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CustomModal isOpen={false} title="Add User" onClose={() => {}}>
        <p>Body</p>
      </CustomModal>
    );
    expect(container.firstChild).toBeNull();
  });
});
