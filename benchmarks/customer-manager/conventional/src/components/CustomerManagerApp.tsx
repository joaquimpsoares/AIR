import React, { useState, useEffect, useMemo } from 'react';
import { Customer, CustomerCreateInput, CustomerFilterOptions } from '../types/customer';
import { CustomerStore } from '../store/customerStore';
import { CustomerTable } from './CustomerTable';
import { CustomerCard } from './CustomerCard';
import { CustomerDrawer } from './CustomerDrawer';
import { CustomerFilters } from './CustomerFilters';

interface CustomerManagerAppProps {
  initialCustomers?: Customer[];
}

export const CustomerManagerApp: React.FC<CustomerManagerAppProps> = ({
  initialCustomers = []
}) => {
  const store = useMemo(() => new CustomerStore(initialCustomers), []);
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, [store]);

  const [filters, setFilters] = useState<CustomerFilterOptions>({
    searchQuery: '',
    statusFilter: 'ALL',
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();

  const filteredCustomers = store.filter(filters);
  const totalCount = store.getAll().length;

  const handleCreateNew = () => {
    setSelectedCustomer(undefined);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleEditCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleArchiveCustomer = (id: string) => {
    store.archive(id);
    if (selectedCustomer?.id === id) {
      setDrawerOpen(false);
    }
  };

  const handleSubmitDrawer = (values: CustomerCreateInput) => {
    if (drawerMode === 'create') {
      const res = store.create(values);
      if (res.success) {
        setDrawerOpen(false);
      }
      return res;
    } else if (drawerMode === 'edit' && selectedCustomer) {
      const res = store.update(selectedCustomer.id, values);
      if (res.success) {
        setSelectedCustomer(res.customer);
        setDrawerMode('view');
      }
      return res;
    }
    return { success: false, errors: ['Invalid state'] };
  };

  return (
    <div className="customer-manager-app min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Customer Directory</h1>
          <p className="text-xs text-slate-400">
            Managing {totalCount} active customer accounts
          </p>
        </div>
      </header>

      <CustomerFilters
        filters={filters}
        onChange={setFilters}
        onNewCustomer={handleCreateNew}
      />

      {/* Responsive layout: Table on desktop/tablet, Cards on mobile */}
      <div className="hidden md:block">
        <CustomerTable
          customers={filteredCustomers}
          onSelect={handleSelectCustomer}
          onEdit={handleEditCustomer}
          onArchive={handleArchiveCustomer}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredCustomers.map((c) => (
          <CustomerCard
            key={c.id}
            customer={c}
            onSelect={handleSelectCustomer}
            onEdit={handleEditCustomer}
            onArchive={handleArchiveCustomer}
          />
        ))}
        {filteredCustomers.length === 0 && (
          <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-lg text-xs">
            No customers found.
          </div>
        )}
      </div>

      <CustomerDrawer
        isOpen={drawerOpen}
        mode={drawerMode}
        customer={selectedCustomer}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmitDrawer}
        onEdit={() => setDrawerMode('edit')}
        onArchive={handleArchiveCustomer}
      />
    </div>
  );
};
