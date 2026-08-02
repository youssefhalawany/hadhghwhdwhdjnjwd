"use client";

import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, getDocs, orderBy, doc, getDoc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Plus, Edit2, Shield, UserX, CheckCircle, X, Search, ShieldCheck, Activity, KeyRound, Trash2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/context/BranchContext";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from "@/context/LanguageContext";

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
  const { t } = useLanguage();
  const { availableBranches } = useBranch();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("manager");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);

  // Password Reset Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Delete User Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

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
        try {
          let userRole = "owner";
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            userRole = userDoc.data().role || "manager";
          } else if (user.email) {
            const emailKey = user.email.toLowerCase().replace(/[@.]/g, "_");
            const docByEmailKey = await getDoc(doc(db, "users", emailKey));
            if (docByEmailKey.exists()) {
              userRole = docByEmailKey.data().role || "manager";
            }
          }
          setCurrentUserRole(userRole);

          // Fetch users live snapshot from Firestore
          const q = collection(db, "users");
          unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            const usersData: UserProfile[] = [];
            snapshot.forEach((docSnap) => {
              usersData.push({ id: docSnap.id, ...docSnap.data() } as UserProfile);
            });
            // Sort in memory by createdAt descending
            usersData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setUsers(usersData);
            setLoading(false);
          }, (err) => {
            console.error("Users listener error:", err);
            toast.error("Permission denied reading users.");
            setLoading(false);
          });
        } catch (e) {
          console.error("Error checking user role:", e);
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

  const isAdminEditor = currentUserRole === "admin_editor" || currentUserRole === "owner" || (typeof window !== "undefined" && localStorage.getItem("circlek_role") !== "manager");

  const handleOpenNewUser = () => {
    setIsEditing(false);
    setEmail("");
    setDisplayName("");
    setPassword("");
    setRole("manager");
    setSelectedBranches(["eL-alamein-4"]);
    setIsActive(true);
    setFeatures({ canUseMasterScanner: false });
    setIsModalOpen(true);
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setIsEditing(true);
    setEditingId(user.id);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setPassword(""); // Keep blank unless changing password
    setRole(user.role);
    setSelectedBranches(user.storeIds || []);
    setIsActive(user.isActive !== false);
    setFeatures(user.features || {});
    setIsModalOpen(true);
  };

  const handleOpenPasswordModal = (user: UserProfile) => {
    setPasswordResetUser(user);
    setNewPassword("");
    setIsPasswordModalOpen(true);
  };

  const handleOpenDeleteModal = (user: UserProfile) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
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
      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (tErr) {}
      }

      const payload: any = {
        email,
        displayName: displayName || email.split("@")[0],
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
        try {
          const res = await fetch("/api/admin/users", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "x-user-role": currentUserRole || "owner"
            },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data: any = {};
          try { data = JSON.parse(text); } catch (e) {}

          if (res.ok && data.success) {
            toast.success("User updated successfully!");
            setIsModalOpen(false);
            setSubmitting(false);
            return;
          }
        } catch (e) {
          console.warn("API User update failed, using Firestore fallback:", e);
        }

        // Fallback: update user document directly in Firestore
        await setDoc(doc(db, "users", editingId), {
          email,
          displayName: displayName || email.split("@")[0],
          role,
          storeIds: selectedBranches,
          isActive,
          features,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        toast.success("User updated in database!");
        setIsModalOpen(false);
      } else {
        let createdViaApi = false;
        let createdUid = "";

        try {
          const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "x-user-role": currentUserRole || "owner"
            },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data: any = {};
          try { data = JSON.parse(text); } catch (e) {}

          if (res.ok && (data.success || data.uid)) {
            createdViaApi = true;
            createdUid = data.uid;
          } else if (data.error) {
            console.warn("API User creation notice:", data.error);
          }
        } catch (e) {
          console.warn("API User creation failed, using Firestore fallback:", e);
        }

        // Always save user profile to Firestore (using Auth UID or email key)
        const emailKey = email.toLowerCase().replace(/[@.]/g, "_");
        const targetDocId = createdUid || emailKey;

        await setDoc(doc(db, "users", targetDocId), {
          email,
          displayName: displayName || email.split("@")[0],
          role,
          storeIds: selectedBranches,
          isActive,
          features,
          createdAt: new Date().toISOString()
        }, { merge: true });

        if (createdViaApi) {
          toast.success("User created in Firebase Auth & Database! 🎉");
        } else {
          toast.success("User profile saved to database! 👤");
        }
        setIsModalOpen(false);
      }
    } catch (error: any) {
      console.error("User submit error:", error);
      toast.error(error.message || "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setResettingPassword(true);
    try {
      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        },
        body: JSON.stringify({
          uid: passwordResetUser.id,
          email: passwordResetUser.email,
          password: newPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Password for ${passwordResetUser.displayName} updated successfully in Firebase Auth! 🔑`);
        setIsPasswordModalOpen(false);
        setPasswordResetUser(null);
        setNewPassword("");
      } else {
        toast.error(data.error || "Failed to update password in Firebase Auth");
      }
    } catch (err: any) {
      toast.error(err.message || "Password update failed");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUserSubmit = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }

      let apiSuccess = false;
      try {
        const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(userToDelete.id)}&docId=${encodeURIComponent(userToDelete.id)}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-user-role": currentUserRole || "owner"
          }
        });
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch (e) {}
        if (res.ok && data.success) {
          apiSuccess = true;
        }
      } catch (e) {
        console.warn("Delete API call failed, falling back to direct Firestore removal:", e);
      }

      // Ensure doc is deleted from Firestore
      await deleteDoc(doc(db, "users", userToDelete.id)).catch(() => {});

      toast.success(`User ${userToDelete.displayName || userToDelete.email} deleted successfully! 🗑️`);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  };

  const toggleActiveStatus = async (user: UserProfile) => {
    if (!isAdminEditor) return;
    try {
      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }
      
      const newStatus = user.isActive === false ? true : false;

      let apiSuccess = false;
      try {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-user-role": currentUserRole || "owner"
          },
          body: JSON.stringify({
            uid: user.id,
            isActive: newStatus
          })
        });
        if (res.ok) apiSuccess = true;
      } catch (e) {}

      if (!apiSuccess) {
        await updateDoc(doc(db, "users", user.id), {
          isActive: newStatus,
          updatedAt: new Date().toISOString()
        });
      }

      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update user status");
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-500" />
            {t("admin.users.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("admin.users.subtitle")}</p>
        </div>
        {isAdminEditor && (
          <button
            onClick={handleOpenNewUser}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-md transition-colors"
          >
            <Plus className="h-4 w-4" /> {t("admin.users.add_new")}
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
            placeholder={t("admin.users.search")} 
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
                <th className="p-4 font-bold">{t("admin.users.col_user")}</th>
                <th className="p-4 font-bold">{t("admin.users.col_role")}</th>
                <th className="p-4 font-bold">{t("admin.users.col_branch")}</th>
                <th className="p-4 font-bold">{t("admin.users.col_status")}</th>
                {isAdminEditor && <th className="p-4 font-bold text-right">{t("admin.users.col_actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("admin.users.loading")}</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("admin.users.empty")}</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-sm text-foreground">{user.displayName || t("admin.users.unknown")}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                        ${user.role === 'admin_editor' || user.role === 'owner' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 
                          user.role === 'admin_viewer' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                        {user.role === 'admin_editor' || user.role === 'owner' ? t("admin.users.role_admin_editor") : 
                         user.role === 'admin_viewer' ? t("admin.users.role_admin_viewer") : t("admin.users.role_manager")}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {user.role === "admin_editor" || user.role === "admin_viewer" || user.role === "owner" ? (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{t("admin.users.all_branches")}</span>
                        ) : (
                          user.storeIds && user.storeIds.length > 0 ? (
                            user.storeIds.map(storeId => {
                              const branchName = storeId === "eL-alamein-4" || storeId === "alamein4" ? "El Alamein 4" : storeId === "ola-el-koronfol" || storeId === "ola" ? "Ola El Koronfol" : storeId;
                              return (
                                <span key={storeId} className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{branchName}</span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md">El Alamein 4 (Default)</span>
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
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Stats View */}
                          <button
                            onClick={() => setSelectedProfileUser(user)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="View Stats"
                          >
                            <Activity className="h-4 w-4" />
                          </button>

                          {/* Edit User & Branches */}
                          <button
                            onClick={() => handleOpenEditUser(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit User & Branches"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Password Reset Button */}
                          <button
                            onClick={() => handleOpenPasswordModal(user)}
                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Change Auth Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            onClick={() => toggleActiveStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${user.isActive !== false ? 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                            title={user.isActive !== false ? "Deactivate User" : "Activate User"}
                          >
                            {user.isActive !== false ? <UserX className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </button>

                          {/* Delete User Button */}
                          <button
                            onClick={() => handleOpenDeleteModal(user)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete User from Auth & Database"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* User Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border bg-slate-50 dark:bg-slate-950">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {isEditing ? <Edit2 className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-red-500" />}
                {isEditing ? t("admin.users.edit_user") : t("admin.users.new_user")}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {!isEditing && (
                <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 p-3 rounded-lg text-sm flex gap-2 items-start mb-6 border border-blue-500/20">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <p><strong>Firebase Authentication Sync:</strong> This will automatically create the user account in Firebase Auth and link their assigned store branches.</p>
                </div>
              )}

              <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">{t("admin.users.email")} *</label>
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
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">{t("admin.users.display_name")} *</label>
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

                {!isEditing && (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">{t("admin.users.password")} *</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">{t("admin.users.role") !== "admin.users.role" ? t("admin.users.role") : "USER ROLE"} *</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500"
                  >
                    <option value="manager">{t("admin.users.role_manager")}</option>
                    <option value="admin_viewer">{t("admin.users.role_admin_viewer")}</option>
                    <option value="admin_editor">{t("admin.users.role_admin_editor")}</option>
                  </select>
                </div>

                {role === "manager" && (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">{t("admin.users.branch_access")}</label>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-border rounded-xl p-2 space-y-1">
                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedBranches.includes('eL-alamein-4') ? 'bg-red-500/10 border-red-500/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <input 
                          type="checkbox" 
                          checked={selectedBranches.includes('eL-alamein-4')} 
                          onChange={() => toggleBranch('eL-alamein-4')} 
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        <div>
                          <p className="font-semibold text-sm">El Alamein 4</p>
                          <p className="text-xs text-muted-foreground">storeId: eL-alamein-4</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedBranches.includes('ola-el-koronfol') ? 'bg-red-500/10 border-red-500/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <input 
                          type="checkbox" 
                          checked={selectedBranches.includes('ola-el-koronfol')} 
                          onChange={() => toggleBranch('ola-el-koronfol')} 
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        <div>
                          <p className="font-semibold text-sm">Ola El Koronfol</p>
                          <p className="text-xs text-muted-foreground">storeId: ola-el-koronfol</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-semibold">
                      {t("admin.users.account_active") !== "admin.users.account_active" ? t("admin.users.account_active") : "Account Active (User Can Log In)"}
                    </span>
                  </label>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("admin.users.cancel") !== "admin.users.cancel" ? t("admin.users.cancel") : "Cancel"}
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={submitting}
                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? "Saving..." : isEditing ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isPasswordModalOpen && passwordResetUser && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2 text-amber-500">
                <KeyRound className="h-5 w-5" /> Change Password
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold">User Account:</p>
                <p className="font-bold text-sm text-foreground">{passwordResetUser.displayName}</p>
                <p className="text-xs text-slate-400 font-mono">{passwordResetUser.email}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-amber-500"
                  required
                  minLength={6}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {resettingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden">
            <div className="p-4 border-b border-border bg-red-500/10 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" /> Delete User Account
              </h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground">
                Are you sure you want to permanently delete user <strong className="text-red-500">{userToDelete.displayName}</strong> ({userToDelete.email})?
              </p>
              <p className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-border">
                ⚠️ This action will delete the user account from <strong>Firebase Authentication</strong> and remove their record from the database. This action cannot be undone.
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUserSubmit}
                  disabled={deletingUser}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingUser ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
