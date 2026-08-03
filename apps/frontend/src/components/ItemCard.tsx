import { Link } from 'react-router-dom';
import type { Item } from '../types/models';
import { resolvePhotoUrl } from '../lib/resolve-photo-url';

export default function ItemCard({ item }: { item: Item }) {
  const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];

  return (
    <Link to={`/items/${item.id}`} className="item-card">
      <div className="item-photo">
        {primaryPhoto && <img src={resolvePhotoUrl(primaryPhoto.url)} alt={item.title} />}
      </div>
      <div className="item-title">{item.title}</div>
      <div className="item-price">${item.price}</div>
      <div className="item-meta-row">
        <span className="tag tag-neutral">{item.condition}</span>
      </div>
    </Link>
  );
}
