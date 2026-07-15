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
    <div
      className={`animate-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "rgba(148, 163, 184, 0.1)", // Subtle slate-400 with opacity
      }}
    />
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
