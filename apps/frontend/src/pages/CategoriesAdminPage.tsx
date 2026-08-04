import { useState } from 'react';
import { useCategories, useCreateCategory, useRenameCategory, useDeleteCategory } from '../api/categories';
import { ApiError } from '../lib/api-client';

export default function CategoriesAdminPage() {
  const { data: categories, isLoading, isError } = useCategories();
  const createCategory = useCreateCategory();
  const renameCategory = useRenameCategory();
  const deleteCategory = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    createCategory.mutate(newName, {
      onSuccess: () => setNewName(''),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
    });
  }

  function startEditing(id: string, currentName: string) {
    setError(null);
    setEditingId(id);
    setEditingName(currentName);
  }

  function handleRename(id: string) {
    setError(null);
    renameCategory.mutate(
      { id, name: editingName },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
      },
    );
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return;
    setError(null);
    deleteCategory.mutate(id, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
    });
  }

  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p className="error-text">Couldn't load categories. Please try again.</p>;

  return (
    <div>
      <h2>Categories</h2>

      <div className="field" style={{ maxWidth: 400 }}>
        <label htmlFor="new-category-name">New category name</label>
        <input
          id="new-category-name"
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: 'var(--space-2)' }}
          disabled={newName.trim() === '' || createCategory.isPending}
          onClick={handleCreate}
        >
          Add category
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <table className="table" style={{ marginTop: 'var(--space-4)' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {categories?.map((category) => (
            <tr key={category.id}>
              <td>
                {editingId === category.id ? (
                  <input
                    className="input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  category.name
                )}
              </td>
              <td>
                <div className="row-actions">
                  {editingId === category.id ? (
                    <button
                      className="btn btn-secondary"
                      disabled={editingName.trim() === '' || renameCategory.isPending}
                      onClick={() => handleRename(category.id)}
                    >
                      Save
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => startEditing(category.id, category.name)}>
                      Rename
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={() => handleDelete(category.id)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
