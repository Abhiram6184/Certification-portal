import React from 'react';

const Loader2Icon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a8 8 0 0114.24-4.76" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 15a8 8 0 01-14.24 4.76" />
    </svg>
);

export default Loader2Icon;