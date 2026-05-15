import React, { useState } from 'react';
import { CertificationRequest, RequestStatus } from '../types';
import Modal from './Modal';

interface UpdateProgressModalProps {
  request: CertificationRequest;
  onClose: () => void;
  onSave: (updates: Partial<CertificationRequest>) => void;
}

const UpdateProgressModal: React.FC<UpdateProgressModalProps> = ({ request, onClose, onSave }) => {
  const [examDate, setExamDate] = useState(request.examDate || '');
  const [result, setResult] = useState<'Pass' | 'Fail' | ''>('');

  const handleSave = () => {
    const updates: Partial<CertificationRequest> = {};
    if (request.status === RequestStatus.Approved && examDate) {
      updates.examDate = new Date(examDate).toISOString();
      updates.status = RequestStatus.ExamScheduled;
    } else if (request.status === RequestStatus.ExamScheduled && result) {
      updates.result = result;
      updates.status = RequestStatus.Completed;
    }
    onSave(updates);
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-bold leading-6 text-gray-900" id="modal-title">
          Update Progress: {request.certification.name}
        </h3>
        <div className="mt-4 space-y-4">
          {request.status === RequestStatus.Approved && (
            <div>
              <label htmlFor="examDate" className="block text-sm font-medium text-gray-700">
                Scheduled Exam Date & Time
              </label>
              <input
                type="datetime-local"
                id="examDate"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2"
              />
            </div>
          )}

          {request.status === RequestStatus.ExamScheduled && (
            <div>
              <label htmlFor="result" className="block text-sm font-medium text-gray-700">
                Exam Result
              </label>
              <select
                id="result"
                value={result}
                onChange={(e) => setResult(e.target.value as 'Pass' | 'Fail')}
                className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2"
              >
                <option value="" disabled>Select result...</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </div>
          )}
        </div>
      </div>
      <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-xl">
        <button
          type="button"
          onClick={handleSave}
          disabled={ (request.status === RequestStatus.Approved && !examDate) || (request.status === RequestStatus.ExamScheduled && !result) }
          className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default UpdateProgressModal;