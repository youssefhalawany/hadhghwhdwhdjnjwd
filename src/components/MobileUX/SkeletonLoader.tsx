import React from "react";

export function SkeletonBlock({
  width = "100%",
  height = "20px",
  borderRadius = "8px",
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          position: relative;
          overflow: hidden;
          background-color: rgba(34, 211, 238, 0.05); /* Cyan tint base */
        }
        .animate-shimmer::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            transparent,
            rgba(34, 211, 238, 0.15), /* Glowing cyan core */
            transparent
          );
          animation: shimmer 1.5s infinite ease-in-out;
        }
      `}</style>
      <div
        className={`animate-shimmer ${className}`}
        style={{ width, height, borderRadius }}
      />
    </>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-6 p-4 w-full h-full">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <SkeletonBlock width="48px" height="48px" borderRadius="24px" />
          <div className="flex flex-col gap-2">
            <SkeletonBlock width="120px" height="16px" />
            <SkeletonBlock width="80px" height="12px" />
          </div>
        </div>
        <SkeletonBlock width="32px" height="32px" borderRadius="16px" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonBlock key={i} height="100px" borderRadius="16px" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonSchedule() {
  return (
    <div className="flex flex-col gap-4 p-4 w-full h-full mt-4">
      <SkeletonBlock width="150px" height="24px" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex justify-between items-center">
            <SkeletonBlock width="100px" height="18px" />
            <SkeletonBlock width="60px" height="18px" borderRadius="12px" />
          </div>
          <SkeletonBlock width="100%" height="40px" borderRadius="12px" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="flex flex-col gap-4 p-4 w-full h-full mt-2">
      {/* Header bar fake */}
      <SkeletonBlock width="120px" height="28px" />
      <SkeletonBlock width="100%" height="80px" borderRadius="16px" className="mb-4" />
      
      {/* List items fake */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 items-center p-4 rounded-xl bg-white/5 border border-white/5">
          <SkeletonBlock width="40px" height="40px" borderRadius="8px" />
          <div className="flex flex-col gap-2 flex-1">
            <SkeletonBlock width="60%" height="16px" />
            <SkeletonBlock width="30%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}
