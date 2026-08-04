import { Link } from 'react-router-dom';
import { useAuditLog } from '../api/admin';
import type { AuditLogEntry } from '../types/models';

const EDITABLE_FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  price: 'price',
  condition: 'condition',
  isNegotiable: 'negotiable',
  minPrice: 'min price',
  categoryId: 'category',
  options: 'options',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

function describeEdit(entry: Extract<AuditLogEntry, { type: 'EDIT' }>) {
  const changedFields = Object.keys(EDITABLE_FIELD_LABELS).filter(
    (field) => JSON.stringify(entry.before[field as keyof typeof entry.before]) !== JSON.stringify(entry.after[field as keyof typeof entry.after]),
  );

  if (changedFields.length === 0) {
    return <span className="text-muted">No fields changed</span>;
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {changedFields.map((field) => (
        <li key={field}>
          {EDITABLE_FIELD_LABELS[field]}: {formatValue(entry.before[field as keyof typeof entry.before])} →{' '}
          {formatValue(entry.after[field as keyof typeof entry.after])}
        </li>
      ))}
    </ul>
  );
}

function EntryDetail({ entry }: { entry: AuditLogEntry }) {
  if (entry.type === 'STATUS_CHANGE') {
    return (
      <span>
        {entry.fromStatus ?? 'created'} → {entry.toStatus}
        {entry.reason && <span className="text-muted"> ({entry.reason})</span>}
      </span>
    );
  }
  return describeEdit(entry);
}

export default function AuditLogPage() {
  const { data: entries, isLoading, isError } = useAuditLog();

  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p className="error-text">Couldn't load the audit log. Please try again.</p>;

  return (
    <div>
      <h2>Audit log</h2>
      {entries?.length === 0 ? (
        <p className="text-muted">No activity yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Item</th>
              <th>Type</th>
              <th>Actor</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((entry) => (
              <tr key={entry.id}>
                <td className="text-muted">{new Date(entry.createdAt).toLocaleString()}</td>
                <td>
                  <Link to={`/items/${entry.itemId}`}>{entry.itemTitle}</Link>
                </td>
                <td>
                  <span className={`tag ${entry.type === 'EDIT' ? 'tag-accent' : 'tag-neutral'}`}>
                    {entry.type === 'EDIT' ? 'Edit' : 'Status change'}
                  </span>
                </td>
                <td>{entry.actorName ?? <span className="text-muted">System</span>}</td>
                <td>
                  <EntryDetail entry={entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
