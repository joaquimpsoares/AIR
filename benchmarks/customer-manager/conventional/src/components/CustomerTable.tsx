import React from 'react';
import { Customer } from '../types/customer';

interface CustomerTableProps {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onArchive: (id: string) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onSelect,
  onEdit,
  onArchive
}) => {
  if (customers.length === 0) {
    return (
      <div className="empty-state p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-lg">
        <p className="text-sm">No customers matching current filters.</p>
      </div>
    );
  }

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
    <div className="table-container overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {customers.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              className="hover:bg-slate-800/40 cursor-pointer transition-colors focus-within:bg-slate-800/50"
            >
              <td className="px-4 py-3 font-medium text-slate-100">{c.name}</td>
              <td className="px-4 py-3 text-slate-300">{c.email}</td>
              <td className="px-4 py-3 text-slate-400">{c.company || '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                    c.status
                  )}`}
                >
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">{c.joined}</td>
              <td className="px-4 py-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onEdit(c)}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onArchive(c.id)}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950/50 text-rose-300 hover:bg-rose-900"
                >
                  Archive
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
