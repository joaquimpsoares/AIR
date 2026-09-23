import React from 'react';
import { Customer, CustomerCreateInput } from '../types/customer';
import { CustomerForm } from './CustomerForm';

interface CustomerDrawerProps {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'create';
  customer?: Customer;
  onClose: () => void;
  onSubmit: (values: CustomerCreateInput) => { success: boolean; errors?: string[] };
  onEdit: () => void;
  onArchive: (id: string) => void;
}

export const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  isOpen,
  mode,
  customer,
  onClose,
  onSubmit,
  onEdit,
  onArchive
}) => {
  if (!isOpen) return null;

  return (
    <div className="drawer-overlay fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="drawer-panel w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 flex flex-col h-full overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              {mode === 'create' && 'New Customer'}
              {mode === 'edit' && 'Edit Customer'}
              {mode === 'view' && (customer?.name || 'Customer Details')}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'create' && 'Add a new customer to the database.'}
              {mode === 'edit' && 'Update customer properties.'}
              {mode === 'view' && `ID: ${customer?.id}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="py-6 flex-1">
          {mode === 'view' && customer && (
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Full Name
                </span>
                <span className="text-slate-100 font-medium">{customer.name}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Email
                </span>
                <span className="text-slate-200">{customer.email}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Company
                </span>
                <span className="text-slate-200">{customer.company || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </span>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                  {customer.status}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Joined Date
                </span>
                <span className="text-slate-300">{customer.joined}</span>
              </div>
              {customer.notes && (
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Notes
                  </span>
                  <p className="text-slate-300 mt-1 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                    {customer.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {(mode === 'edit' || mode === 'create') && (
            <CustomerForm
              initialValues={mode === 'edit' ? customer : undefined}
              onSubmit={onSubmit}
              onCancel={onClose}
            />
          )}
        </div>

        {mode === 'view' && customer && (
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onArchive(customer.id)}
              className="px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900 rounded-lg"
            >
              Archive
            </button>
            <div className="space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="px-4 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow"
              >
                Edit Customer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
