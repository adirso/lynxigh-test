import { useState } from 'react';
import ItemForm from '../components/ItemForm';
import { useCreateItem } from '../api/items';
import { ApiError } from '../lib/api-client';

export default function NewListingPage() {
  const createItem = useCreateItem();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return <p>Submitted — your listing is now pending moderator review.</p>;
  }

  return (
    <div>
      <h2>New listing</h2>
      <p className="text-muted">Submitted listings go to moderation before they appear in the catalog.</p>
      <ItemForm
        submitLabel="Submit for review"
        requirePhotos
        onSubmit={(values) => {
          setError(null);
          createItem.mutate(values, {
            onSuccess: () => setSubmitted(true),
            onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
          });
        }}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
