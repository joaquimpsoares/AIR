export type CustomerStatus = 'Active' | 'Trial' | 'Inactive';

export const CUSTOMER_STATUSES: CustomerStatus[] = ['Active', 'Trial', 'Inactive'];

export interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  status: CustomerStatus;
  joined: string;
  notes?: string;
  archived?: boolean;
}

export type CustomerCreateInput = Omit<Customer, 'id' | 'archived'>;
export type CustomerUpdateInput = Partial<CustomerCreateInput>;

export interface CustomerFilterOptions {
  searchQuery: string;
  statusFilter: CustomerStatus | 'ALL';
  sortBy: 'name' | 'joined' | 'status';
  sortOrder: 'asc' | 'desc';
}
