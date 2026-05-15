import React from 'react';
import Loader2Icon from '../icons/Loader2Icon';
import SparklesIcon from '../icons/SparklesIcon';

interface ProcessingStatusProps {
    fileName: string;
    progress: number;
    isSaving?: boolean;
}

export default function ProcessingStatus({ fileName, progress, isSaving = false }: ProcessingStatusProps) {
  
  const text = isSaving ? 'Syncing credentials...' : 'Analyzing & extracting data...';

  return (
    <div className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl">
      <div className="p-8">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center bg-red-50 dark:bg-red-500/10">
             <Loader2Icon className="w-8 h-8 text-red-600 dark:text-red-400 animate-spin" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{text}</h3>
            <p className="text-gray-600 dark:text-gray-400 font-medium truncate">{fileName}</p>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                <div className="bg-red-600 h-2 rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{Math.round(progress)}% complete</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-2">
            <SparklesIcon />
            <span>Processing with Gemini AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}