import React from 'react';
import { RequestStatus } from '../types';

interface StatusBadgeProps {
  status: RequestStatus;
}

const statusColorMap: Record<RequestStatus, string> = {
  [RequestStatus.Pending]: 'bg-yellow-100 text-yellow-800',
  [RequestStatus.Approved]: 'bg-green-100 text-green-800',
  // Fix: Changed Denied to Rejected as per the enum definition in types.ts
  [RequestStatus.Rejected]: 'bg-red-100 text-red-800',
  [RequestStatus.ExamScheduled]: 'bg-blue-100 text-blue-800',
  [RequestStatus.Completed]: 'bg-purple-100 text-purple-800',
  // Fix: Added missing Fulfilled status
  [RequestStatus.Fulfilled]: 'bg-indigo-100 text-indigo-800',
  [RequestStatus.Active]: 'bg-green-100 text-green-800',
  [RequestStatus.Expired]: 'bg-gray-200 text-gray-700',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span
      className={`px-2.5 py-1 text-xs font-semibold leading-tight rounded-full ${statusColorMap[status]}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
