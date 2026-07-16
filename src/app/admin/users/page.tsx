"use client";

import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, getDocs, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Plus, Edit2, Shield, UserX, CheckCircle, X, Search, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useBranch } from "@/context/BranchContext";

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  storeIds: string[];
  isActive: boolean;
  features?: any;
  createdAt?: string;
}

export default function UserManagementPage() {
  const { availableBranches } = useBranch();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("manager");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState("");
  
  // Form State
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<any>({});
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    // Determine current user's role
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userRole = userDoc.data().role || "manager";
          setCurrentUserRole(userRole);

          // Only fetch users if they have an admin role
          if (userRole === "admin_editor" || userRole === "admin_viewer" || userRole === "owner") {
            const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
            unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
              const usersData: UserProfile[] = [];
              snapshot.forEach((doc) => {
                usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
              });
              setUsers(usersData);
              setLoading(false);
            }, (err) => {
              console.error("Users listener error:", err);
              toast.error("Permission denied reading users.");
              setLoading(false);
            });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, []);

  const isAdminEditor = currentUserRole === "admin_editor" || currentUserRole === "owner";

  const handleOpenNewUser = () => {
    setIsEditing(false);
    setEmail("");
    setDisplayName("");
    setPassword("");
    setRole("manager");
    setSelectedBranches([]);
    setIsActive(true);
    setFeatures({ canUseMasterScanner: false });
    setIsModalOpen(true);
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setIsEditing(true);
    setEditingId(user.id);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setPassword(""); // Keep blank unless changing
    setRole(user.role);
    setSelectedBranches(user.storeIds || []);
    setIsActive(user.isActive !== false);
    setFeatures(user.features || {});
    setIsModalOpen(true);
  };

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchId) 
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminEditor) {
      toast.error("You don't have permission to perform this action.");
      return;
    }

    if (!isEditing && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not authenticated");
      
      const token = await currentUser.getIdToken();

      const payload: any = {
        email,
        displayName,
        role,
        storeIds: selectedBranches,
        isActive,
        features
      };
      
      if (password) {
        payload.password = password;
      }

      if (isEditing) {
        payload.uid = editingId;
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update user");
        toast.success("User updated successfully!");
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create user");
        toast.success("User created successfully!");
      }
      
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActiveStatus = async (user: UserProfile) => {
    if (!isAdminEditor) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          uid: user.id,
          isActive: user.isActive === false ? true : false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(`User ${user.isActive === false ? 'activated' : 'deactivated'} successfully!`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-500" />
            User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage access for all system users.</p>
        </div>
        {isAdminEditor && (
          <button
            onClick={handleOpenNewUser}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-md transition-colors"
          >
            <Plus className="h-4 w-4" /> Add New User
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by email or name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none flex-grow text-sm placeholder:text-muted-foreground"
          />
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4 font-bold">User</th>
                <th className="p-4 font-bold">Role</th>
                <th className="p-4 font-bold">Branch Access</th>
                <th className="p-4 font-bold">Status</th>
                {isAdminEditor && <th className="p-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-sm text-foreground">{user.displayName || "Unknown User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                        ${user.role === 'admin_editor' ? 'bg-red-500/10 text-red-600' : 
                          user.role === 'admin_viewer' ? 'bg-blue-500/10 text-blue-600' : 
                          'bg-emerald-500/10 text-emerald-600'}`}>
                        {user.role === 'admin_editor' ? 'Admin Editor' : 
                         user.role === 'admin_viewer' ? 'Admin Viewer' : 'Manager'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {user.role === "admin_editor" || user.role === "admin_viewer" ? (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">All Branches</span>
                        ) : (
                          user.storeIds && user.storeIds.length > 0 ? (
                            user.storeIds.map(storeId => {
                              const branchName = storeId === "eL-alamein-4" ? "El Alamein 4" : storeId === "ola-el-koronfol" ? "Ola El Koronfol" : storeId;
                              return (
                                <span key={storeId} className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{branchName}</span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-red-500 font-semibold bg-red-500/10 px-2 py-0.5 rounded-md">No Access</span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {user.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-500/10 px-2 py-1 rounded-full">
                          <UserX className="h-3 w-3" /> Inactive
                        </span>
                      )}
                    </td>
                    {isAdminEditor && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditUser(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleActiveStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${user.isActive !== false ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                            title={user.isActive !== false ? "Deactivate User" : "Activate User"}
                          >
                            {user.isActive !== false ? <UserX className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border bg-slate-50 dark:bg-slate-950">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {isEditing ? <Edit2 className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-red-500" />}
                {isEditing ? "Edit User" : "Add New User"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {!isEditing && (
                <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 p-3 rounded-lg text-sm flex gap-2 items-start mb-6 border border-blue-500/20">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <p><strong>Note:</strong> The user will be created without affecting your current session.</p>
                </div>
              )}

              <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email Address *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Display Name *</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Password {isEditing ? "(Leave blank to keep unchanged)" : "*"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500"
                    required={!isEditing}
                  />
                  {!isEditing && <p className="text-xs text-muted-foreground mt-1">Must be at least 6 characters. The user will use this to log in for the first time.</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Role *</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500"
                  >
                    <option value="manager">Manager - Branch management access</option>
                    <option value="admin_viewer">Admin Viewer - View only access to all data</option>
                    <option value="admin_editor">Admin Editor - Full administrative access</option>
                  </select>
                </div>

                {role === "manager" && (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Branch Access</label>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-border rounded-xl p-2 space-y-1">
                      {availableBranches.length > 0 ? availableBranches.map(branch => {
                        // We map branch IDs to storeIds (e.g. "alamein4" -> "eL-alamein-4")
                        const mappedStoreId = branch.id === "alamein4" ? "eL-alamein-4" : branch.id === "ola" ? "ola-el-koronfol" : branch.id;
                        const isChecked = selectedBranches.includes(mappedStoreId);
                        
                        return (
                          <label key={branch.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-red-500/10 border-red-500/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => toggleBranch(mappedStoreId)}
                              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                            />
                            <div>
                              <p className="font-semibold text-sm">{branch.name}</p>
                              <p className="text-xs text-muted-foreground">storeId: {mappedStoreId} • ✓ Active</p>
                            </div>
                          </label>
                        )
                      }) : (
                         <div className="p-3 text-sm text-muted-foreground">
                           <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedBranches.includes('eL-alamein-4') ? 'bg-red-500/10 border-red-500/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                             <input type="checkbox" checked={selectedBranches.includes('eL-alamein-4')} onChange={() => toggleBranch('eL-alamein-4')} className="w-4 h-4 text-red-600 rounded focus:ring-red-500"/>
                             <div><p className="font-semibold text-sm">El Alamein 4</p><p className="text-xs text-muted-foreground">storeId: eL-alamein-4</p></div>
                           </label>
                           <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedBranches.includes('ola-el-koronfol') ? 'bg-red-500/10 border-red-500/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                             <input type="checkbox" checked={selectedBranches.includes('ola-el-koronfol')} onChange={() => toggleBranch('ola-el-koronfol')} className="w-4 h-4 text-red-600 rounded focus:ring-red-500"/>
                             <div><p className="font-semibold text-sm">Ola El Koronfol</p><p className="text-xs text-muted-foreground">storeId: ola-el-koronfol</p></div>
                           </label>
                         </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Select which branches this user can access. Manager roles typically need at least one branch.</p>
                  </div>
                )}
                
                <div className="mt-4 pt-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Special Features</label>
                  <div className="bg-slate-50 dark:bg-slate-950 border border-border rounded-xl p-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-semibold text-sm">Master Item Scanner</p>
                        <p className="text-xs text-muted-foreground">Scan barcodes to view detailed pricing and supplier history.</p>
                      </div>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={features.canUseMasterScanner || false}
                          onChange={(e) => setFeatures({...features, canUseMasterScanner: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                      </div>
                    </label>
                  </div>
                </div>
                
                <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-950 flex justify-end gap-3 mt-4 -mx-6 -mb-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : (isEditing ? "Save Changes" : <><Plus className="h-4 w-4" /> Create User</>)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
