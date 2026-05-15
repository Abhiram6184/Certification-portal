import React from 'react';

const AwardIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25l-2.47 1.29.47-2.75-2-1.94 2.76-.4L12 8l1.24 2.45 2.76.4-2 1.94.47 2.75L12 14.25z" />
    </svg>
);

export default AwardIcon;