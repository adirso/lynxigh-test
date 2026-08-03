import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useModerationQueue, useApproveItem, useRejectItem } from '../api/moderation';
import { useItems } from '../api/items';
import { ApiError } from '../lib/api-client';

export default function ModerationPage() {
  const { data: queue, isLoading } = useModerationQueue();
  const { data: published } = useItems({ status: 'PUBLISHED' });
  const { data: rejected } = useItems({ status: 'REJECTED' });
  const approveItem = useApproveItem();
  const rejectItem = useRejectItem();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h2>Moderation</h2>
      <div className="stat-row">
        <div className="card">
          <div className="card-kicker">Pending review</div>
          <div className="stat-num">{queue?.length ?? 0}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Published</div>
          <div className="stat-num">{published?.length ?? 0}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Rejected</div>
          <div className="stat-num">{rejected?.length ?? 0}</div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {queue?.map((item) => (
            <tr key={item.id}>
              <td>
                <Link to={`/items/${item.id}`}>{item.title}</Link>
              </td>
              <td>${item.price}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="btn btn-icon"
                    title="Approve"
                    aria-label="Approve"
                    onClick={() => approveItem.mutate(item.id)}
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn-icon"
                    title="Reject"
                    aria-label="Reject"
                    onClick={() => {
                      setRejectingId(item.id);
                      setReason('');
                      setError(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {rejectingId === item.id && (
                  <div className="field" style={{ marginTop: 'var(--space-2)' }}>
                    <label htmlFor={`reason-${item.id}`}>Reason</label>
                    <input
                      id={`reason-${item.id}`}
                      className="input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: 'var(--space-2)' }}
                      disabled={reason.trim() === '' || rejectItem.isPending}
                      onClick={() => {
                        if (!reason.trim()) return;
                        setError(null);
                        rejectItem.mutate(
                          { id: item.id, reason },
                          {
                            onSuccess: () => { setRejectingId(null); setReason(''); },
                            onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
                          },
                        );
                      }}
                    >
                      Confirm reject
                    </button>
                    {error && <p className="error-text">{error}</p>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
