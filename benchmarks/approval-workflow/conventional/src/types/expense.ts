export type UserRole = 'employee' | 'manager' | 'finance' | 'admin';

export const USER_ROLES: UserRole[] = ['employee', 'manager', 'finance', 'admin'];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type ExpenseCategory = 'Travel' | 'Meals' | 'Equipment' | 'Software';
export type ExpenseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

export const EXPENSE_STATUSES: ExpenseStatus[] = ['Draft', 'Submitted', 'Approved', 'Rejected'];

export interface WorkflowEvent {
  action: string;
  state: ExpenseStatus;
  actor: string;
  timestamp: string;
  comment?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  submitterId: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
  history: WorkflowEvent[];
}

export interface ExpenseCreateInput {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  submitterId: string;
}
