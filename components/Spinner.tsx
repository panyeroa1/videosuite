
import React from 'react';

interface SpinnerProps {
    message?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-text-main p-4">
      <div className="w-12 h-12 border-4 border-primary-soft border-t-primary rounded-full animate-spin"></div>
      {message && <p className="text-lg font-medium text-center whitespace-pre-wrap">{message}</p>}
    </div>
  );
};
