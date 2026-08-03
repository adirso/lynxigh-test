import { useState } from 'react';
import { useCategories } from '../api/categories';
import { useItems } from '../api/items';
import ItemCard from '../components/ItemCard';
import { CONDITIONS } from '../items/items.constants';

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('');

  const { data: categories } = useCategories();
  const { data: items, isLoading } = useItems({
    search: search || undefined,
    categoryId: categoryId || undefined,
    condition: condition || undefined,
  });

  return (
    <div>
      <h2>Catalog</h2>
      <div className="filter-row">
        <input
          className="input"
          placeholder="Search the catalog"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label htmlFor="category-filter" className="text-muted" style={{ fontSize: 13 }}>
          Category
        </label>
        <select
          id="category-filter"
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">Any condition</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {isLoading && <p>Loading…</p>}
      <div className="item-grid">{items?.map((item) => <ItemCard key={item.id} item={item} />)}</div>
    </div>
  );
}
