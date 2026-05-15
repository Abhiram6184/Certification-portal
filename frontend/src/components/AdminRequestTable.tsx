import React from 'react';
import { CertificationRequest, RequestStatus } from '../types';
import StatusBadge from './StatusBadge';
import CheckIcon from './icons/CheckIcon';
import CloseIcon from './icons/CloseIcon';

interface AdminRequestTableProps {
  requests: CertificationRequest[];
  onApprove?: (request: CertificationRequest) => void;
  onDeny?: (request: CertificationRequest) => void;
}

const AdminRequestTable: React.FC<AdminRequestTableProps> = ({ requests, onApprove, onDeny }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderActions = (req: CertificationRequest) => {
    switch (req.status) {
      case RequestStatus.Pending:
        return (
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => onApprove && onApprove(req)}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
            >
              Approve
            </button>
            <button
              onClick={() => onDeny && onDeny(req)}
              className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Deny
            </button>
          </div>
        );
      case RequestStatus.Approved:
        // This state means approved but no voucher was available.
        return <span className="text-blue-600 dark:text-blue-400 text-xs italic">Awaiting Voucher</span>;
      case RequestStatus.Rejected:
        return <span className="text-gray-500 dark:text-gray-400 text-xs italic">Reviewed</span>;
      case RequestStatus.Fulfilled:
        return <span className="text-green-600 dark:text-green-400 text-xs font-semibold flex items-center justify-center gap-1"><CheckIcon /> Fulfilled</span>;
      default:
        return <span className="text-gray-400 dark:text-gray-500">-</span>;
    }
  };

  return (
    <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      <table className="min-w-full text-sm text-left text-gray-600 dark:text-gray-400">
        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-700">
          <tr>
            <th scope="col" className="px-6 py-3">Employee Name</th>
            <th scope="col" className="px-6 py-3">Certification</th>
            <th scope="col" className="px-6 py-3">Request Date</th>
            <th scope="col" className="px-6 py-3">Status</th>
            <th scope="col" className="px-6 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">
                No voucher requests found.
              </td>
            </tr>
          ) : (
            requests.map(req => (
              <tr key={req.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{req.user?.name || 'Unknown User'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{req.user?.email || 'No Email'}</div>
                  {req.personal_email && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Personal: {req.personal_email}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{req.certification?.name || 'Unknown Certification'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{req.certification?.vendor || 'Unknown Vendor'}</div>
                </td>
                <td className="px-6 py-4">{formatDate(req.requestDate)}</td>
                <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                <td className="px-6 py-4 text-center">
                  {renderActions(req)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminRequestTable;
