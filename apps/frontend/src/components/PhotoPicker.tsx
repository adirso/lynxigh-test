import { useRef } from 'react';

export type PickedPhoto = { file: File; previewUrl: string };

export default function PhotoPicker({
  photos,
  onChange,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const added = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    onChange([...photos, ...added]);
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="field">
      <label htmlFor="photo-input">Photos (at least one)</label>
      <div className="photo-row">
        {photos.map((photo, index) => (
          <div className="photo-slot" key={photo.previewUrl}>
            <img src={photo.previewUrl} alt="" />
            <button
              type="button"
              className="btn btn-icon btn-secondary"
              style={{ position: 'absolute', top: 2, right: 2 }}
              onClick={() => remove(index)}
              aria-label={`Remove photo ${index + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <label className="photo-add">
          <input
            id="photo-input"
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          Add photo
        </label>
      </div>
    </div>
  );
}
