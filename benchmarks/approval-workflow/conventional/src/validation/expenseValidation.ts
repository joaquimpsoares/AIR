import type { ExpenseCreateInput, ExpenseCategory } from '../types/expense.ts';

export const VALID_CATEGORIES: ExpenseCategory[] = ['Travel', 'Meals', 'Equipment', 'Software'];

export function validateExpense(input: Partial<ExpenseCreateInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.description || input.description.trim().length < 3) {
    errors.push('Description is required and must be at least 3 characters');
  }

  if (input.amount === undefined || input.amount === null || isNaN(input.amount) || input.amount <= 0) {
    errors.push('Amount must be a positive number');
  }

  if (!input.category || !VALID_CATEGORIES.includes(input.category)) {
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (!input.submitterId || !input.submitterId.trim()) {
    errors.push('Submitter identity is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
