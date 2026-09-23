import React, { useState, useMemo, useEffect } from 'react';
import { Expense, User } from '../types/expense';
import { WorkflowEngine } from '../state/workflowEngine';
import { ExpenseTable } from './ExpenseTable';
import { ExpenseTimeline } from './ExpenseTimeline';

interface ExpenseWorkflowAppProps {
  initialExpenses?: Expense[];
  initialUsers?: User[];
  currentActor?: User;
}

export const ExpenseWorkflowApp: React.FC<ExpenseWorkflowAppProps> = ({
  initialExpenses = [],
  initialUsers = [
    { id: 'u_01', name: 'Elena Rostova', email: 'elena@company.com', role: 'employee' },
    { id: 'u_02', name: 'Marcus Vance', email: 'marcus@company.com', role: 'manager' },
    { id: 'u_03', name: 'Sarah Chen', email: 'sarah@company.com', role: 'finance' }
  ],
  currentActor = { id: 'u_02', name: 'Marcus Vance', email: 'marcus@company.com', role: 'manager' }
}) => {
  const engine = useMemo(() => new WorkflowEngine(initialExpenses, initialUsers), []);
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectExpenseId, setRejectExpenseId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const expenses = engine.getAll();

  const handleSubmit = (id: string) => {
    setErrorMessage(null);
    const res = engine.submit(id, currentActor);
    if (!res.success) setErrorMessage(res.error || 'Submission failed');
  };

  const handleApprove = (id: string) => {
    setErrorMessage(null);
    const res = engine.approve(id, currentActor);
    if (!res.success) setErrorMessage(res.error || 'Approval failed');
  };

  const handleOpenReject = (id: string) => {
    setRejectExpenseId(id);
    setRejectComment('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectExpenseId) return;
    const res = engine.reject(rejectExpenseId, currentActor, rejectComment);
    if (!res.success) {
      setErrorMessage(res.error || 'Rejection failed');
    } else {
      setRejectModalOpen(false);
      setRejectExpenseId(null);
    }
  };

  return (
    <div className="expense-workflow-app min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Expense Approvals</h1>
          <p className="text-xs text-slate-400">
            Current Actor: <span className="text-cyan-400 font-medium">{currentActor.name}</span> ({currentActor.role})
          </p>
        </div>
      </header>

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs flex justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)}>✕</button>
        </div>
      )}

      <ExpenseTable
        expenses={expenses}
        users={initialUsers}
        currentActor={currentActor}
        onSelect={setSelectedExpense}
        onSubmit={handleSubmit}
        onApprove={handleApprove}
        onReject={handleOpenReject}
      />

      {selectedExpense && (
        <div className="mt-6 p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-white">Workflow Audit Trail: {selectedExpense.description}</h3>
            <button type="button" onClick={() => setSelectedExpense(undefined)} className="text-xs text-slate-400">Close</button>
          </div>
          <ExpenseTimeline history={selectedExpense.history} users={initialUsers} />
        </div>
      )}

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Reject Expense</h3>
            <p className="text-xs text-slate-400">Please provide a reason for rejecting this expense.</p>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="Reason for rejection (required)..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100"
            />
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setRejectModalOpen(false)} className="px-3 py-1 text-xs text-slate-400">Cancel</button>
              <button type="button" onClick={handleConfirmReject} className="px-3 py-1 bg-rose-600 text-white rounded text-xs">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
