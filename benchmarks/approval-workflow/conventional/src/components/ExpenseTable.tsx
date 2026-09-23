import React from 'react';
import { Expense, User } from '../types/expense';

interface ExpenseTableProps {
  expenses: Expense[];
  users: User[];
  currentActor: User;
  onSelect: (expense: Expense) => void;
  onSubmit: (expenseId: string) => void;
  onApprove: (expenseId: string) => void;
  onReject: (expenseId: string) => void;
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  users,
  currentActor,
  onSelect,
  onSubmit,
  onApprove,
  onReject
}) => {
  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'Submitted':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'Rejected':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'Draft':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
          <tr>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Submitter</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Workflow Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {expenses.map((exp) => {
            const canSubmit = exp.status === 'Draft' && (exp.submitterId === currentActor.id || currentActor.role === 'admin');
            const canApprove = exp.status === 'Submitted' && (currentActor.role === 'manager' || currentActor.role === 'finance') && exp.submitterId !== currentActor.id;
            const canReject = exp.status === 'Submitted' && currentActor.role === 'manager' && exp.submitterId !== currentActor.id;

            return (
              <tr
                key={exp.id}
                onClick={() => onSelect(exp)}
                className="hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-slate-100">{exp.description}</td>
                <td className="px-4 py-3 font-mono text-cyan-300">${exp.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-400">{exp.category}</td>
                <td className="px-4 py-3 text-slate-300">{getUserName(exp.submitterId)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                      exp.status
                    )}`}
                  >
                    {exp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                  {canSubmit && (
                    <button
                      type="button"
                      onClick={() => onSubmit(exp.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900"
                    >
                      Submit
                    </button>
                  )}
                  {canApprove && (
                    <button
                      type="button"
                      onClick={() => onApprove(exp.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900"
                    >
                      Approve
                    </button>
                  )}
                  {canReject && (
                    <button
                      type="button"
                      onClick={() => onReject(exp.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900"
                    >
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
