import React, { useState } from 'react';
import { Customer, CustomerCreateInput, CustomerStatus } from '../types/customer';
import { VALID_STATUSES } from '../validation/customerSchema';

interface CustomerFormProps {
  initialValues?: Customer;
  onSubmit: (values: CustomerCreateInput) => { success: boolean; errors?: string[] };
  onCancel: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  initialValues,
  onSubmit,
  onCancel
}) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [email, setEmail] = useState(initialValues?.email || '');
  const [company, setCompany] = useState(initialValues?.company || '');
  const [status, setStatus] = useState<CustomerStatus>(initialValues?.status || 'Trial');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSubmit({
      name,
      email,
      company,
      status,
      joined: initialValues?.joined || new Date().toISOString().split('T')[0],
      notes
    });

    if (!result.success && result.errors) {
      setErrors(result.errors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {errors.length > 0 && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-rose-300 text-xs space-y-1">
          {errors.map((err, i) => (
            <p key={i}>• {err}</p>
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">
          Full Name <span className="text-rose-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Industrial Corp"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">
          Email Address <span className="text-rose-400">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. contact@acme.corp"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">Company</label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Acme Corp"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CustomerStatus)}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
        >
          {VALID_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional customer details..."
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow"
        >
          {initialValues ? 'Save Changes' : 'Create Customer'}
        </button>
      </div>
    </form>
  );
};
