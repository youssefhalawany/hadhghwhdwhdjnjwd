"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type BranchId = "alamein4" | "ola" | "all"; // 'all' might be used for owner/manager overview

interface BranchContextType {
  currentBranch: BranchId;
  setBranch: (branch: BranchId) => void;
  availableBranches: { id: BranchId; name: string }[];
  setAvailableBranches: (branches: { id: BranchId; name: string }[]) => void;
}

const BranchContext = createContext<BranchContextType>({
  currentBranch: "alamein4", // Default
  setBranch: () => {},
  availableBranches: [],
  setAvailableBranches: () => {},
});

export const BRANCHES = [
  { id: "alamein4" as BranchId, name: "El Alamein 4" },
  { id: "ola" as BranchId, name: "Ola El Koronfol" },
];

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [currentBranch, setCurrentBranch] = useState<BranchId>("alamein4");
  const [availableBranches, setAvailableBranchesState] = useState<{ id: BranchId; name: string }[]>(BRANCHES);

  useEffect(() => {
    // Load saved branch on mount
    const saved = localStorage.getItem("circlek_current_branch");
    if (saved === "alamein4" || saved === "ola" || saved === "all") {
      setCurrentBranch(saved as BranchId);
    }
  }, []);

  const setBranch = (branch: BranchId) => {
    setCurrentBranch(branch);
    localStorage.setItem("circlek_current_branch", branch);
  };

  return (
    <BranchContext.Provider
      value={{
        currentBranch,
        setBranch,
        availableBranches,
        setAvailableBranches: setAvailableBranchesState,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
