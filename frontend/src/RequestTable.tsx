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
    if ((req.status === RequestStatus.Approved || req.status === RequestStatus.ExamScheduled) && onUpdate) {
      return (
        <button
          onClick={() => onUpdate(req)}
          className="p-1.5 rounded-full text-blue-600 bg-blue-100 hover:bg-blue-200 transition-colors"
          aria-label={`Update progress for ${req.certification.name}`}
          title="Update Progress"
        >
          <PencilIcon />
        </button>
      );
    }
    return <span className="text-gray-400">-</span>;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
      <table className="min-w-full text-sm text-left text-gray-600">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3">Credential Name</th>
            <th scope="col" className="px-6 py-3">
              {isEmployeeRequestedView ? 'Request Date' : 'Issued On'}
            </th>
            {isAcquiredView && <th scope="col" className="px-6 py-3">Expires On</th>}
            <th scope="col" className="px-6 py-3">Status</th>
            {isEmployeeRequestedView && <th scope="col" className="px-6 py-3 text-center">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={isAcquiredView ? 5 : 4} className="text-center py-8 text-gray-500">
                {isEmployeeRequestedView ? 'You have no pending requests.' : 'No credentials found on this profile.'}
              </td>
            </tr>
          ) : (
            requests.map(req => (
              <tr key={req.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{req.certification.name}</td>
                <td className="px-6 py-4">{formatDate(isEmployeeRequestedView ? req.requestDate : req.issuedOn)}</td>
                {isAcquiredView && <td className="px-6 py-4">{formatDate(req.certificationExpiryDate)}</td>}
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