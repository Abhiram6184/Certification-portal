import React, { useState } from 'react';
import { User, VoucherRequestData } from '../types';
import { certificationMap } from '../constants';

interface RequestVoucherPageProps {
  currentUser: User;
  onSubmit: (formData: VoucherRequestData) => Promise<void>;
  onBack: () => void;
}

const RequestVoucherPage: React.FC<RequestVoucherPageProps> = ({ currentUser, onSubmit, onBack }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedCertification, setSelectedCertification] = useState<string>('');
  const [email, setEmail] = useState<string>(currentUser.email || '');
  const [personalEmail, setPersonalEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; } | null>(null);
  const [errors, setErrors] = useState<{ email?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.endsWith('@celebaltech.com')) {
      newErrors.email = 'Email must end with @celebaltech.com';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!selectedProvider || !selectedCertification) {
      setResult({ success: false, message: 'Please select both provider and certification type.' });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const formData: VoucherRequestData = {
        name: currentUser.name,
        email: email,
        personal_email: personalEmail.trim() ? personalEmail.trim() : undefined,
        cert_provider: selectedProvider,
        cert_type: selectedCertification
      };
      await onSubmit(formData);
      setResult({ success: true, message: 'Request submitted successfully! This tab will now close.' });
      setTimeout(() => {
        window.close();
      }, 2000); // 2 seconds delay
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Network error. Please try again.' });
      setIsSubmitting(false); // Stop submitting on error
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Request New Voucher</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-md dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600 dark:border-slate-600"
            >
                Back to Dashboard
            </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 shadow-lg border border-gray-200 dark:border-slate-700">
            <p className="text-gray-600 dark:text-gray-400 mb-6">Complete the form below to request a voucher for a new certification. The request will be sent to the L&D team for approval.</p>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee Name *</label>
                <input type="text" value={currentUser.name} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Email ID *</label>
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@celebaltech.com"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 dark:text-gray-100 ${ errors.email ? 'border-red-500' : 'border-gray-300 dark:border-slate-600' }`}
                required
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personal Email ID (Optional)</label>
                <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="e.g., alex.doe@email.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 dark:text-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Provide a personal email if you prefer to receive voucher details there.</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Certification Provider *</label>
                <select
                value={selectedProvider}
                onChange={(e) => { setSelectedProvider(e.target.value); setSelectedCertification(''); }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 dark:text-gray-100"
                required
                >
                <option value="">Select certification provider...</option>
                {Object.keys(certificationMap).map(provider => (<option key={provider} value={provider}>{provider}</option>))}
                </select>
            </div>
            {selectedProvider && (
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Specific Certification *</label>
                <select
                    value={selectedCertification}
                    onChange={(e) => setSelectedCertification(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 dark:text-gray-100"
                    required
                >
                    <option value="">Select specific certification...</option>
                    {certificationMap[selectedProvider as keyof typeof certificationMap]?.map(cert => (<option key={cert} value={cert}>{cert}</option>))}
                </select>
                </div>
            )}
            {result && (
                <div className={`p-3 rounded-md ${result.success ? 'bg-green-50 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-500/20 dark:text-red-200'}`}>
                {result.success ? '✅' : '❌'} {result.message}
                </div>
            )}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button type="button" onClick={onBack} className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-slate-600 dark:text-gray-200 dark:hover:bg-slate-500">Cancel</button>
                <button
                type="submit"
                disabled={isSubmitting || !selectedProvider || !selectedCertification || !email}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                {isSubmitting ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Submitting...</>) : 'Submit Request'}
                </button>
            </div>
            </form>
        </div>
    </div>
  );
};

export default RequestVoucherPage;