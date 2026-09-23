import React from 'react';
import { Customer } from '../types/customer';

interface CustomerCardProps {
  customer: Customer;
  onSelect: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onArchive: (id: string) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onSelect,
  onEdit,
  onArchive
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'Trial':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'Inactive':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      onClick={() => onSelect(customer)}
      className="customer-card p-4 rounded-lg border border-slate-800 bg-slate-900 shadow-sm hover:border-slate-700 transition-all cursor-pointer flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-100 text-sm">{customer.name}</h4>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
            customer.status
          )}`}
        >
          {customer.status}
        </span>
      </div>
      <div className="text-xs text-slate-300 flex flex-col gap-1">
        <span className="truncate">{customer.email}</span>
        {customer.company && <span className="text-slate-400">{customer.company}</span>}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
        <span>Joined {customer.joined}</span>
        <div className="space-x-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onEdit(customer)}
            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onArchive(customer.id)}
            className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 hover:bg-rose-900"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
};
