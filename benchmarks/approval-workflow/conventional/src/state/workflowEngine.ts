import type { Expense, ExpenseStatus, User, WorkflowEvent } from '../types/expense.ts';

export interface TransitionResult {
  success: boolean;
  expense?: Expense;
  error?: string;
}

export class WorkflowEngine {
  private expenses: Expense[] = [];
  private users: User[] = [];
  private listeners: Set<() => void> = new Set();

  constructor(initialExpenses: Expense[] = [], initialUsers: User[] = []) {
    this.expenses = [...initialExpenses];
    this.users = [...initialUsers];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  public getAll(): Expense[] {
    return this.expenses;
  }

  public getById(id: string): Expense | undefined {
    return this.expenses.find((e) => e.id === id);
  }

  public getUser(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  /**
   * Submit expense: Draft -> Submitted (by submitter)
   */
  public submit(expenseId: string, actor: User): TransitionResult {
    const expense = this.getById(expenseId);
    if (!expense) return { success: false, error: 'Expense not found' };

    if (expense.status !== 'Draft') {
      return { success: false, error: `Cannot submit expense from state ${expense.status}` };
    }

    if (expense.submitterId !== actor.id && actor.role !== 'admin') {
      return { success: false, error: 'Only the submitter can submit their own draft expense' };
    }

    const event: WorkflowEvent = {
      action: 'submit',
      state: 'Submitted',
      actor: actor.id,
      timestamp: new Date().toISOString()
    };

    expense.status = 'Submitted';
    expense.updatedAt = event.timestamp.split('T')[0];
    expense.history.push(event);

    this.notify();
    return { success: true, expense };
  }

  /**
   * Approve expense: Submitted -> Approved (by manager/finance, separation of duty)
   */
  public approve(expenseId: string, actor: User): TransitionResult {
    const expense = this.getById(expenseId);
    if (!expense) return { success: false, error: 'Expense not found' };

    if (expense.status !== 'Submitted') {
      return { success: false, error: `Cannot approve expense from state ${expense.status}` };
    }

    // Role authority check: manager, finance, or admin
    if (actor.role !== 'manager' && actor.role !== 'finance' && actor.role !== 'admin') {
      return { success: false, error: 'Actor does not have manager or finance role authority' };
    }

    // Separation of Duty enforcement: submitter cannot approve own expense
    if (expense.submitterId === actor.id) {
      return { success: false, error: 'Separation of duty violation: submitter cannot approve own expense' };
    }

    const event: WorkflowEvent = {
      action: 'approve',
      state: 'Approved',
      actor: actor.id,
      timestamp: new Date().toISOString()
    };

    expense.status = 'Approved';
    expense.updatedAt = event.timestamp.split('T')[0];
    expense.history.push(event);

    this.notify();
    return { success: true, expense };
  }

  /**
   * Reject expense: Submitted -> Rejected (by manager, separation of duty, required comment)
   */
  public reject(expenseId: string, actor: User, comment: string): TransitionResult {
    const expense = this.getById(expenseId);
    if (!expense) return { success: false, error: 'Expense not found' };

    if (expense.status !== 'Submitted') {
      return { success: false, error: `Cannot reject expense from state ${expense.status}` };
    }

    if (actor.role !== 'manager' && actor.role !== 'admin') {
      return { success: false, error: 'Actor does not have manager authority' };
    }

    if (expense.submitterId === actor.id) {
      return { success: false, error: 'Separation of duty violation: submitter cannot reject own expense' };
    }

    if (!comment || !comment.trim()) {
      return { success: false, error: 'Rejection requires a documented reason comment' };
    }

    const event: WorkflowEvent = {
      action: 'reject',
      state: 'Rejected',
      actor: actor.id,
      comment: comment.trim(),
      timestamp: new Date().toISOString()
    };

    expense.status = 'Rejected';
    expense.updatedAt = event.timestamp.split('T')[0];
    expense.history.push(event);

    this.notify();
    return { success: true, expense };
  }
}
