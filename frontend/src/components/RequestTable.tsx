import React from 'react';
import { CertificationRequest, RequestStatus } from '../types';
import StatusBadge from './StatusBadge';
import PencilIcon from './icons/PencilIcon';

interface RequestTableProps {
  requests: CertificationRequest[];
  view: 'acquired' | 'requested';
  onUpdate?: (request: CertificationRequest) => void;
}

const RequestTable: React.FC<RequestTableProps> = ({ requests, view, onUpdate }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const isAcquiredView = view === 'acquired';
  const isEmployeeRequestedView = view === 'requested';

  const renderEmployeeActions = (req: CertificationRequest) => {
    if ((req.status === RequestStatus.Fulfilled || req.status === RequestStatus.ExamScheduled) && onUpdate) {
      return (
        <button
          onClick={() => onUpdate(req)}
          className="p-1.5 rounded-full text-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-colors"
          aria-label={`Update progress for ${req.certification.name}`}
          title="Update Progress"
        >
          <PencilIcon />
        </button>
      );
    }
    return <span className="text-gray-400 dark:text-gray-500">-</span>;
  };

  return (
    <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      <table className="min-w-full text-sm text-left text-gray-600 dark:text-gray-400">
        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-700">
          <tr>
            <th scope="col" className="px-6 py-3">Credential Name</th>
            <th scope="col" className="px-6 py-3">
              {isEmployeeRequestedView ? 'Request Date' : 'Issued On'}
            </th>
            <th scope="col" className="px-6 py-3">Voucher Details</th>
            <th scope="col" className="px-6 py-3">Status</th>
            {isEmployeeRequestedView && <th scope="col" className="px-6 py-3 text-center">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={isAcquiredView ? 5 : 5} className="text-center py-8 text-gray-500 dark:text-gray-400">
                {isEmployeeRequestedView ? 'You have no pending requests.' : 'No credentials found on this profile.'}
              </td>
            </tr>
          ) : (
            requests.map(req => (
              <tr key={req.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{req.certification.name}</td>
                <td className="px-6 py-4">{formatDate(isEmployeeRequestedView ? req.requestDate : req.issuedOn)}</td>
                <td className="px-6 py-4">
                  {req.voucherId ? (
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 block">ID: {req.voucherId}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                {isEmployeeRequestedView && (
                  <td className="px-6 py-4 text-center">
                    {renderEmployeeActions(req)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RequestTable;