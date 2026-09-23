import React from 'react';
import { CustomerFilterOptions, CustomerStatus } from '../types/customer';
import { VALID_STATUSES } from '../validation/customerSchema';

interface CustomerFiltersProps {
  filters: CustomerFilterOptions;
  onChange: (filters: CustomerFilterOptions) => void;
  onNewCustomer: () => void;
}

export const CustomerFilters: React.FC<CustomerFiltersProps> = ({
  filters,
  onChange,
  onNewCustomer
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-2 flex-1">
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search customers by name, email, company..."
          className="w-full sm:max-w-xs px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />

        <select
          value={filters.statusFilter}
          onChange={(e) =>
            onChange({
              ...filters,
              statusFilter: e.target.value as CustomerStatus | 'ALL'
            })
          }
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Statuses</option>
          {VALID_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={onNewCustomer}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium shadow flex items-center justify-center gap-1.5 transition-colors"
      >
        <span>+</span>
        <span>Add Customer</span>
      </button>
    </div>
  );
};
