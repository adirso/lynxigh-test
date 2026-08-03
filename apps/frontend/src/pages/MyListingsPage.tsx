import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyItems, useCancelItem } from '../api/items';
import { ApiError } from '../lib/api-client';

const STATUS_TAG_CLASS: Record<string, string> = {
  PENDING: 'tag-neutral',
  PUBLISHED: 'tag-accent',
  REJECTED: 'tag-accent-2',
  CANCELLED: 'tag-outline',
};

export default function MyListingsPage() {
  const { data: items, isLoading, isError } = useMyItems();
  const cancelItem = useCancelItem();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p className="error-text">Couldn't load your listings. Please try again.</p>;

  return (
    <div>
      <h2>My listings</h2>
      {error && <p className="error-text">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Price</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item) => {
            const canCancel = item.status === 'PENDING' || item.status === 'PUBLISHED';
            return (
              <tr key={item.id}>
                <td>
                  <Link to={`/items/${item.id}`}>{item.title}</Link>
                </td>
                <td>${item.price}</td>
                <td>
                  <span className={`tag ${STATUS_TAG_CLASS[item.status]}`}>{item.status}</span>
                </td>
                <td>
                  {canCancel && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setError(null);
                        cancelItem.mutate(item.id, {
                          onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
                        });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
