"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  Plus, Edit2, Shield, UserX, CheckCircle, X, Search, ShieldCheck, 
  Activity, KeyRound, Trash2, Lock, AlertTriangle, RefreshCw, Sparkles, Building, Mail, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/context/BranchContext";
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
  updatedAt?: string;
  hasAuthAccount?: boolean;
  authUid?: string;
  authDisabled?: boolean;
}

export default function UserManagementPage() {
  const { t } = useLanguage();
  const { availableBranches } = useBranch();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("owner");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncingAuth, setSyncingAuth] = useState(false);

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

  // Helper to get auth token
  const getAuthToken = async () => {
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch (e) {
        console.warn("Failed to get ID token:", e);
      }
    }
    return "";
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          let userRole = "owner";
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            userRole = userDoc.data().role || "owner";
          } else if (user.email) {
            const emailKey = user.email.toLowerCase().replace(/[@.]/g, "_");
            const docByEmailKey = await getDoc(doc(db, "users", emailKey));
            if (docByEmailKey.exists()) {
              userRole = docByEmailKey.data().role || "owner";
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
            // Sort by createdAt descending
            usersData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setUsers(usersData);
            setLoading(false);
          }, (err) => {
            console.warn("Firestore users listener notice:", err);
            // Fallback: fetch via API route
            fetchUsersFromApi();
          });
        } catch (e) {
          console.error("Error checking user role:", e);
          fetchUsersFromApi();
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

  const fetchUsersFromApi = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      });
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error("Fetch users API error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAuthAccounts = async () => {
    setSyncingAuth(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users?action=sync", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Auth synchronization completed successfully! ⚡");
        await fetchUsersFromApi();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to sync users with Auth");
    } finally {
      setSyncingAuth(false);
    }
  };

  const isAdminEditor = currentUserRole === "admin_editor" || currentUserRole === "owner" || currentUserRole === "admin" || (typeof window !== "undefined" && localStorage.getItem("circlek_role") !== "manager");

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
    setPassword(""); // Blank unless admin specifically wants to change
    setRole(user.role || "manager");
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
      const token = await getAuthToken();

      const payload: any = {
        email: email.toLowerCase().trim(),
        displayName: displayName.trim() || email.split("@")[0],
        role,
        storeIds: role === "manager" ? selectedBranches : [],
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
            "Authorization": `Bearer ${token}`,
            "x-user-role": currentUserRole || "owner"
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to update user");
        }

        toast.success(`User ${displayName || email} updated successfully in Firebase Auth & Database! ✨`);
        setIsModalOpen(false);
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-user-role": currentUserRole || "owner"
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to create user in Firebase Auth");
        }

        toast.success(`User ${email} created & authenticated successfully in Firebase! 🎉`);
        setIsModalOpen(false);
      }
    } catch (error: any) {
      console.error("User save error:", error);
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
      const token = await getAuthToken();

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
      if (res.ok && data.success) {
        toast.success(`Password for ${passwordResetUser.displayName || passwordResetUser.email} updated in Firebase Auth! 🔑`);
        setIsPasswordModalOpen(false);
        setPasswordResetUser(null);
        setNewPassword("");
      } else {
        toast.error(data.error || "Failed to update password");
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
      const token = await getAuthToken();

      const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(userToDelete.id)}&docId=${encodeURIComponent(userToDelete.id)}&email=${encodeURIComponent(userToDelete.email)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`User ${userToDelete.displayName || userToDelete.email} permanently deleted from Firebase Auth & Database! 🗑️`);
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete user");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  };

  const toggleActiveStatus = async (user: UserProfile) => {
    if (!isAdminEditor) return;
    const newStatus = user.isActive === false ? true : false;
    
    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: newStatus } : u));

    try {
      const token = await getAuthToken();
      
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        },
        body: JSON.stringify({
          uid: user.id,
          email: user.email,
          isActive: newStatus
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`User ${user.displayName || user.email} ${newStatus ? 'activated & enabled' : 'deactivated & logged out'} in Firebase! ⚡`);
      } else {
        // Revert on error
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !newStatus } : u));
        toast.error(data.error || "Failed to update active status");
      }
    } catch (error: any) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !newStatus } : u));
      toast.error(error.message || "Failed to update user status");
    }
  };

  const filteredUsers = users.filter(user => 
    (user.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncAuthAccounts}
              disabled={syncingAuth}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-2 font-medium text-sm transition-colors border border-border disabled:opacity-50"
              title="Ensure all users exist in Firebase Authentication"
            >
              <RefreshCw className={`h-4 w-4 ${syncingAuth ? 'animate-spin text-red-500' : 'text-slate-500'}`} />
              {syncingAuth ? "Syncing Auth..." : "Sync Auth Accounts"}
            </button>

            <button
              onClick={handleOpenNewUser}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold text-sm shadow-md transition-colors"
            >
              <Plus className="h-4 w-4" /> {t("admin.users.add_new")}
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-grow">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={t("admin.users.search")} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none flex-grow text-sm placeholder:text-muted-foreground"
            />
          </div>
          <div className="text-xs font-semibold text-muted-foreground px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {filteredUsers.length} {filteredUsers.length === 1 ? "User" : "Users"}
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[850px]">
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
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
                      {t("admin.users.loading")}
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("admin.users.empty")}</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            {user.displayName || t("admin.users.unknown")}
                            {user.role === "owner" && (
                              <span className="text-[10px] uppercase font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20">
                                Owner
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                        ${user.role === 'owner' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          user.role === 'admin_editor' || user.role === 'admin' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 
                          user.role === 'admin_viewer' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                        {user.role === 'owner' ? '👑 Owner' :
                         user.role === 'admin_editor' || user.role === 'admin' ? t("admin.users.role_admin_editor") : 
                         user.role === 'admin_viewer' ? t("admin.users.role_admin_viewer") : t("admin.users.role_manager")}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {user.role === "owner" || user.role === "admin_editor" || user.role === "admin_viewer" || user.role === "admin" ? (
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
                            <span className="text-xs text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md">El Alamein 4</span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {user.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                          <UserX className="h-3 w-3" /> Inactive
                        </span>
                      )}
                    </td>
                    {isAdminEditor && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Stats View */}
                          <button
                            onClick={() => setSelectedProfileUser(user)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="View User Details"
                          >
                            <Activity className="h-4 w-4" />
                          </button>

                          {/* Edit User & Branches */}
                          <button
                            onClick={() => handleOpenEditUser(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit User & Permissions"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Password Reset Button */}
                          <button
                            onClick={() => handleOpenPasswordModal(user)}
                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Reset Firebase Auth Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            onClick={() => toggleActiveStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${user.isActive !== false ? 'text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                            title={user.isActive !== false ? "Deactivate User (Disable Login)" : "Activate User (Allow Login)"}
                          >
                            {user.isActive !== false ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>

                          {/* Delete User Button */}
                          <button
                            onClick={() => handleOpenDeleteModal(user)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Permanently Delete User"
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
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
                <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-xs flex gap-2.5 items-start mb-6 border border-emerald-500/20">
                  <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                  <p><strong>100% Automated Firebase Sync:</strong> Creating this user will automatically configure their Firebase Authentication login credentials, security claims, and Firestore profile.</p>
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
                      disabled={isEditing}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500 disabled:opacity-60"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">{t("admin.users.display_name")} *</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Full Name"
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
                      minLength={6}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">{t("admin.users.role") !== "admin.users.role" ? t("admin.users.role") : "USER ROLE"} *</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500 font-medium"
                  >
                    <option value="manager">{t("admin.users.role_manager")}</option>
                    <option value="admin_viewer">{t("admin.users.role_admin_viewer")}</option>
                    <option value="admin_editor">{t("admin.users.role_admin_editor")}</option>
                    <option value="owner">👑 Owner / Superadmin</option>
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
                          <p className="text-xs text-muted-foreground">Branch ID: eL-alamein-4</p>
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
                          <p className="text-xs text-muted-foreground">Branch ID: ola-el-koronfol</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2 text-amber-500">
                <KeyRound className="h-5 w-5" /> Change Password in Firebase Auth
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground font-semibold">User Account:</p>
                <p className="font-bold text-sm text-foreground">{passwordResetUser.displayName || passwordResetUser.email}</p>
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                Are you sure you want to permanently delete user <strong className="text-red-500">{userToDelete.displayName || userToDelete.email}</strong> ({userToDelete.email})?
              </p>
              <p className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-border">
                ⚠️ This will automatically delete their <strong>Firebase Authentication login account</strong>, Firestore document, active login tokens, and active sessions.
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

      {/* User Details Modal */}
      {selectedProfileUser && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2 text-indigo-600">
                <Activity className="h-5 w-5" /> User Details & Auth State
              </h3>
              <button onClick={() => setSelectedProfileUser(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold">Display Name</p>
                  <p className="font-bold text-foreground mt-0.5">{selectedProfileUser.displayName || "N/A"}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold">Role</p>
                  <p className="font-bold text-foreground mt-0.5 capitalize">{selectedProfileUser.role}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">Email Address</p>
                <p className="font-mono text-xs text-foreground font-bold">{selectedProfileUser.email}</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">Firestore Document ID / Auth UID</p>
                <p className="font-mono text-xs text-slate-500 break-all">{selectedProfileUser.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold">Login Status</p>
                  <p className={`font-bold mt-0.5 text-xs ${selectedProfileUser.isActive !== false ? 'text-emerald-500' : 'text-red-500'}`}>
                    {selectedProfileUser.isActive !== false ? 'Active (Can Log In)' : 'Disabled / Deactivated'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold">Created At</p>
                  <p className="font-bold text-foreground mt-0.5 text-xs">
                    {selectedProfileUser.createdAt ? new Date(selectedProfileUser.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedProfileUser(null)}
                  className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
