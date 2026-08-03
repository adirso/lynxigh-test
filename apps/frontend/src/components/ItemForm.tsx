import { useState, type FormEvent } from 'react';
import { useCategories } from '../api/categories';
import { CONDITIONS, LISTING_OPTIONS } from '../items/items.constants';
import PhotoPicker, { type PickedPhoto } from './PhotoPicker';
import type { Item } from '../types/models';

export type ItemFormValues = {
  title: string;
  description: string;
  price: number;
  condition: string;
  isNegotiable: boolean;
  minPrice?: number;
  categoryId: string;
  options: string[];
  photos: PickedPhoto[];
};

export default function ItemForm({
  initialValues,
  onSubmit,
  submitLabel,
  requirePhotos = false,
}: {
  initialValues?: Partial<Item>;
  onSubmit: (values: ItemFormValues) => void;
  submitLabel: string;
  requirePhotos?: boolean;
}) {
  const { data: categories } = useCategories();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [price, setPrice] = useState(initialValues?.price?.toString() ?? '');
  const [condition, setCondition] = useState(initialValues?.condition ?? CONDITIONS[0]);
  const [isNegotiable, setIsNegotiable] = useState(initialValues?.isNegotiable ?? false);
  const [minPrice, setMinPrice] = useState(initialValues?.minPrice?.toString() ?? '');
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '');
  const [options, setOptions] = useState<string[]>(initialValues?.options ?? []);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleOption(option: string) {
    setOptions((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (requirePhotos && photos.length === 0) {
      setError('At least one photo is required.');
      return;
    }
    if (isNegotiable && !minPrice) {
      setError('Minimum acceptable price is required when the price is negotiable.');
      return;
    }
    onSubmit({
      title,
      description,
      price: Number(price),
      condition,
      isNegotiable,
      minPrice: isNegotiable ? Number(minPrice) : undefined,
      categoryId,
      options,
      photos,
    });
  }

  return (
    <form className="form-shell" onSubmit={handleSubmit}>
      {requirePhotos && <PhotoPicker photos={photos} onChange={setPhotos} />}

      <div className="field">
        <label htmlFor="item-title">Title</label>
        <input id="item-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="item-price">Price (USD)</label>
          <input
            id="item-price"
            type="number"
            className="input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="item-condition">Condition</label>
          <select
            id="item-condition"
            className="input"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Is the price negotiable?</label>
        <div className="seg" style={{ width: 'fit-content' }}>
          <label className="seg-opt">
            <input type="radio" name="negotiable" checked={!isNegotiable} onChange={() => setIsNegotiable(false)} />
            <span>No</span>
          </label>
          <label className="seg-opt">
            <input type="radio" name="negotiable" checked={isNegotiable} onChange={() => setIsNegotiable(true)} />
            <span>Yes</span>
          </label>
        </div>
      </div>

      {isNegotiable && (
        <div className="field">
          <label htmlFor="item-min-price">Minimum acceptable price</label>
          <input
            id="item-min-price"
            type="number"
            className="input"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="item-category">Category</label>
        <select
          id="item-category"
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          <option value="">Select a category</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Which of these apply to this listing?</label>
        <div className="checkbox-grid">
          {LISTING_OPTIONS.map((opt) => (
            <label className="cb-opt" key={opt}>
              <input type="checkbox" checked={options.includes(opt)} onChange={() => toggleOption(opt)} />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="item-description">Description</label>
        <textarea
          id="item-description"
          className="input"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
