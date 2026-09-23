import type { CustomerCreateInput, CustomerStatus } from '../types/customer.ts';
import { CUSTOMER_STATUSES } from '../types/customer.ts';

export interface ValidationError {
  field: keyof CustomerCreateInput;
  message: string;
}

export const VALID_STATUSES: CustomerStatus[] = ['Active', 'Trial', 'Inactive'];

export function validateCustomer(
  input: Partial<CustomerCreateInput>,
  existingCustomers: { id?: string; email: string }[] = [],
  currentId?: string
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Name validation: required, min 2 chars
  if (!input.name || input.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name is required and must be at least 2 characters long' });
  }

  // Email validation: required, format, uniqueness
  if (!input.email || !input.email.trim()) {
    errors.push({ field: 'email', message: 'Email address is required' });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      errors.push({ field: 'email', message: 'Invalid email address format' });
    } else {
      const normalized = input.email.trim().toLowerCase();
      const duplicate = existingCustomers.some(
        (c) => c.email.toLowerCase() === normalized && c.id !== currentId
      );
      if (duplicate) {
        errors.push({ field: 'email', message: 'Email address must be unique across all customers' });
      }
    }
  }

  // Status validation: must match enum
  if (!input.status || !VALID_STATUSES.includes(input.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
