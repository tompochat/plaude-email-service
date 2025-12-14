import React from 'react';

interface MailIconProps {
  className?: string;
}

export function MailIcon({ className }: MailIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="502" 
      height="502" 
      fill="none" 
      viewBox="0 0 502 502" 
      className={className}
    >
      <path 
        stroke="currentColor" 
        strokeWidth="50" 
        d="M25 250.88C25 126.13 126.13 25 250.88 25s225.88 101.13 225.88 225.88-101.13 225.88-225.88 225.88H25z"
      />
    </svg>
  );
}
