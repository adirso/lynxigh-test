import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useModerationQueue, useApproveItem, useRejectItem } from '../api/moderation';
import { useItems } from '../api/items';
import { ApiError } from '../lib/api-client';

// The backend caps /items' pageSize at 100 (see items.schemas.ts). That's not
// true pagination for the stat cards below — just a stopgap so the Published
// and Rejected counts don't silently truncate at the default pageSize of 24
// for any realistic catalog size in this project's scope.
const STAT_PAGE_SIZE = 100;

export default function ModerationPage() {
  const { data: queue, isLoading, isError: queueIsError } = useModerationQueue();
  const { data: published, isError: publishedIsError } = useItems({ status: 'PUBLISHED', pageSize: STAT_PAGE_SIZE });
  const { data: rejected, isError: rejectedIsError } = useItems({ status: 'REJECTED', pageSize: STAT_PAGE_SIZE });
  const approveItem = useApproveItem();
  const rejectItem = useRejectItem();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p>Loading…</p>;
  if (queueIsError) return <p className="error-text">Couldn't load the moderation queue. Please try again.</p>;

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
          <div className="stat-num">{publishedIsError ? '—' : (published?.length ?? 0)}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Rejected</div>
          <div className="stat-num">{rejectedIsError ? '—' : (rejected?.length ?? 0)}</div>
        </div>
      </div>
      {(publishedIsError || rejectedIsError) && (
        <p className="error-text">Couldn't load full counts for one or more stat cards. Please try again.</p>
      )}

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
