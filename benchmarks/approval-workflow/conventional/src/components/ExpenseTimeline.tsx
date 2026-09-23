import React from 'react';
import { WorkflowEvent, User } from '../types/expense';

interface ExpenseTimelineProps {
  history: WorkflowEvent[];
  users: User[];
}

export const ExpenseTimeline: React.FC<ExpenseTimelineProps> = ({ history, users }) => {
  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || id;

  if (!history || history.length === 0) {
    return <p className="text-xs text-slate-500">No workflow history recorded.</p>;
  }

  return (
    <div className="workflow-timeline space-y-4 border-l-2 border-slate-800 pl-4 my-4">
      {history.map((evt, idx) => (
        <div key={idx} className="timeline-item relative">
          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-4 ring-slate-900" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 capitalize">
              {evt.action} → <span className="text-cyan-400">{evt.state}</span>
            </span>
            <span className="text-[10px] text-slate-500">{evt.timestamp}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">By {getUserName(evt.actor)}</p>
          {evt.comment && (
            <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900 p-2 rounded mt-1">
              "{evt.comment}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
