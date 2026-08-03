import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useItem, useCancelItem, useDeleteItem } from '../api/items';
import { useCategories } from '../api/categories';
import { resolvePhotoUrl } from '../lib/resolve-photo-url';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../lib/api-client';

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading, isError } = useItem(id!);
  const { data: categories } = useCategories();
  const { user } = useAuth();
  const cancelItem = useCancelItem();
  const deleteItem = useDeleteItem();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p className="error-text">Couldn't load this listing. Please try again.</p>;
  if (!item) return <p>Item not found.</p>;

  const category = categories?.find((c) => c.id === item.categoryId);
  const isOwner = user?.id === item.contributorId;
  const isModerator = user?.role === 'MODERATOR';
  const canCancel = isOwner && (item.status === 'PENDING' || item.status === 'PUBLISHED');
  const sortedPhotos = [...item.photos].sort((a, b) => a.position - b.position);
  const [mainPhoto, ...thumbs] = sortedPhotos;

  return (
    <div>
      <Link to="/" className="back-link">
        ← Back to catalog
      </Link>
      <div className="detail-grid">
        <div>
          {mainPhoto && (
            <div style={{ aspectRatio: '4/3', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <img src={resolvePhotoUrl(mainPhoto.url)} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          {thumbs.length > 0 && (
            <div className="detail-thumbs">
              {thumbs.map((photo) => (
                <div className="thumb" key={photo.id}>
                  <img src={resolvePhotoUrl(photo.url)} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          {category && <h6>{category.name}</h6>}
          <h2>{item.title}</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
            <span className="item-price" style={{ fontSize: 30 }}>
              ${item.price}
            </span>
            {item.isNegotiable && (
              <span className="text-muted">
                Negotiable{item.minPrice != null ? ` — will consider offers down to $${item.minPrice}` : ''}
              </span>
            )}
          </div>
          <div className="item-meta-row" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="tag tag-neutral">{item.condition}</span>
            {item.options.map((opt) => (
              <span className="tag tag-accent" key={opt}>
                {opt}
              </span>
            ))}
          </div>
          <p>{item.description}</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
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
                Cancel listing
              </button>
            )}
            {isModerator && (
              <>
                <Link to={`/items/${item.id}/edit`} className="btn btn-secondary">
                  Edit
                </Link>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm('Delete this listing permanently?')) {
                      setError(null);
                      deleteItem.mutate(item.id, {
                        onSuccess: () => navigate('/'),
                        onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
                      });
                    }
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </div>
  );
}
