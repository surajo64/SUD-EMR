import React from 'react';

const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white bg-opacity-90">
      <div className="relative h-24 w-24">
        {/* Spinning border */}
        <div className="animate-spin rounded-full h-full w-full border-t-4 border-green-500 border-solid"></div>

        {/* eDokta Text inside */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-green-600 font-bold text-sm">SUD EMR</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;