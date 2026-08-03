import { useState } from 'react';
import { useParams } from 'react-router-dom';
import ItemForm from '../components/ItemForm';
import { useItem, useUpdateItem } from '../api/items';
import { ApiError } from '../lib/api-client';

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading } = useItem(id!);
  const updateItem = useUpdateItem();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (isLoading) return <p>Loading…</p>;
  if (!item) return <p>Item not found.</p>;

  return (
    <div>
      <h2>Edit listing</h2>
      <ItemForm
        initialValues={item}
        submitLabel="Save changes"
        requirePhotos={false}
        onSubmit={(values) => {
          setError(null);
          updateItem.mutate(
            {
              id: item.id,
              values: {
                title: values.title,
                description: values.description,
                price: values.price,
                condition: values.condition,
                isNegotiable: values.isNegotiable,
                minPrice: values.minPrice,
                categoryId: values.categoryId,
                options: values.options,
              },
            },
            {
              onSuccess: () => setSaved(true),
              onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
            },
          );
        }}
      />
      {saved && <p>Listing updated.</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
