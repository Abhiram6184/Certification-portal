import React from 'react';
import { RequestStatus } from '../types';

interface StatusBadgeProps {
  status: RequestStatus;
}

const statusColorMap: Record<RequestStatus, string> = {
  [RequestStatus.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
  [RequestStatus.Approved]: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
  [RequestStatus.Rejected]: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  [RequestStatus.ExamScheduled]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  [RequestStatus.Completed]: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  [RequestStatus.Fulfilled]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
  [RequestStatus.Active]: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
  [RequestStatus.Expired]: 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span
      className={`px-2.5 py-1 text-xs font-semibold leading-tight rounded-full ${statusColorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-200'}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;