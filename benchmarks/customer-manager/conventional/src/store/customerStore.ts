import type { Customer, CustomerCreateInput, CustomerUpdateInput, CustomerFilterOptions } from '../types/customer.ts';
import { validateCustomer } from '../validation/customerSchema.ts';

export class CustomerStore {
  private customers: Customer[] = [];
  private listeners: Set<() => void> = new Set();

  constructor(initialData: Customer[] = []) {
    this.customers = [...initialData];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getAll(): Customer[] {
    return this.customers.filter((c) => !c.archived);
  }

  public getById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id && !c.archived);
  }

  public filter(options: CustomerFilterOptions): Customer[] {
    let result = this.getAll();

    if (options.statusFilter !== 'ALL') {
      result = result.filter((c) => c.status === options.statusFilter);
    }

    if (options.searchQuery.trim()) {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const valA = a[options.sortBy] || '';
      const valB = b[options.sortBy] || '';
      const cmp = String(valA).localeCompare(String(valB));
      return options.sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }

  public create(input: CustomerCreateInput): { success: boolean; customer?: Customer; errors?: string[] } {
    const validation = validateCustomer(input, this.customers);
    if (!validation.valid) {
      return { success: false, errors: validation.errors.map((e) => e.message) };
    }

    const customer: Customer = {
      ...input,
      id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      joined: input.joined || new Date().toISOString().split('T')[0]
    };

    this.customers.push(customer);
    this.notify();
    return { success: true, customer };
  }

  public update(id: string, input: CustomerUpdateInput): { success: boolean; customer?: Customer; errors?: string[] } {
    const existingIndex = this.customers.findIndex((c) => c.id === id);
    if (existingIndex === -1) {
      return { success: false, errors: ['Customer not found'] };
    }

    const merged = { ...this.customers[existingIndex], ...input };
    const validation = validateCustomer(merged, this.customers, id);
    if (!validation.valid) {
      return { success: false, errors: validation.errors.map((e) => e.message) };
    }

    this.customers[existingIndex] = merged;
    this.notify();
    return { success: true, customer: merged };
  }

  public archive(id: string): boolean {
    const customer = this.customers.find((c) => c.id === id);
    if (!customer) return false;
    customer.archived = true;
    this.notify();
    return true;
  }
}
