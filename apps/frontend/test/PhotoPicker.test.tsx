import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoPicker, { type PickedPhoto } from '../src/components/PhotoPicker';

function Wrapper({ initial = [] as PickedPhoto[] }) {
  return <PhotoPicker photos={initial} onChange={() => {}} />;
}

describe('PhotoPicker', () => {
  it('keeps the file input focusable via keyboard instead of removing it from the tab order', async () => {
    render(<Wrapper />);

    const input = screen.getByLabelText(/photos/i);
    // display:none (the old approach) removes an element from the tab order entirely — jsdom/
    // testing-library reflects that via `document.body.tabIndex` reachability. Tabbing from the
    // top of the document should be able to reach the input directly.
    await userEvent.tab();
    expect(input).toHaveFocus();
  });

  it('does not use display:none on the file input (which would break keyboard access)', () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/photos/i);
    expect(input).not.toHaveStyle({ display: 'none' });
    expect(input.className).toContain('visually-hidden-input');
  });

  it('revokes the object URL of a photo when it is removed', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const photo: PickedPhoto = { file: new File(['x'], 'a.jpg', { type: 'image/jpeg' }), previewUrl: 'blob:mock-1' };
    const onChange = vi.fn();

    render(<PhotoPicker photos={[photo]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /remove photo 1/i }));

    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-1');
    expect(onChange).toHaveBeenCalledWith([]);

    revokeSpy.mockRestore();
  });
});
