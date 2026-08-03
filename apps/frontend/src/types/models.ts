export type Role = 'CONTRIBUTOR' | 'MODERATOR';

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type Category = {
  id: string;
  name: string;
};

export type ItemPhoto = {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
};

export type ItemStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'CANCELLED';

export type Item = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  isNegotiable: boolean;
  minPrice?: number | null;
  categoryId: string;
  options: string[];
  contributorId: string;
  status: ItemStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  aiFlagged?: boolean;
  aiFlagReason?: string | null;
  aiConfidence?: number | null;
  createdAt: string;
  updatedAt: string;
  photos: ItemPhoto[];
};
