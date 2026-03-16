import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, Badge, LoadingSpinner } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, Button, Toast, ConfirmDialog } from "../../components/ui/Modal";
import { User, Lock, Palette, Users, Shield, Building, Plus, Edit, UserX, UserCheck } from "lucide-react";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import api from "../../api/client";

type Tab = "profile" | "security" | "appearance" | "users" | "organization";

const ALL_MODULES = ["dashboard", "hr", "finance", "accounting", "ict", "construction", "workforce", "predictive", "alerts"];

export default function Settings() {
  const { user, setUser } = useAuthStore();
  const { mode, toggle } = useThemeStore();
  const isAdmin = user?.role.name === "admin" || user?.role.name === "super_admin";

  const [tab, setTab] = useState<Tab>("profile");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Profile
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Admin: Users
  const [users, setUsers] = useState<Array<{
    id: string; email: string; firstName: string; lastName: string;
    role: { id: string; name: string }; isActive: boolean; moduleAccess: string[];
    organization: { id: string; name: string } | null; lastLoginAt: string | null;
  }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; modules: Array<{ moduleName: string; isEnabled: boolean }>; _count: { users: number } }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showModuleAccess, setShowModuleAccess] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ email: "", password: "", firstName: "", lastName: "", roleName: "employee", organizationId: "", moduleAccess: [] as string[] });
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (isAdmin && (tab === "users" || tab === "organization")) {
      fetchAdminData();
    }
  }, [tab, isAdmin]);

  const fetchAdminData = async () => {
    setLoadingUsers(true);
    try {
      const [usersRes, rolesRes, orgsRes] = await Promise.allSettled([
        api.get("/auth/users"),
        api.get("/auth/roles"),
        api.get("/auth/organizations"),
      ]);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.data.data || []);
      if (rolesRes.status === "fulfilled") setRoles(rolesRes.value.data.data || []);
      if (orgsRes.status === "fulfilled") setOrgs(orgsRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoadingUsers(false); }
  };

  const handleUpdateProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await api.put("/auth/profile", { firstName, lastName });
      setUser(res.data.data);
      setToast({ message: "Profile updated", type: "success" });
    } catch { setToast({ message: "Failed to update profile", type: "error" }); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { setToast({ message: "Password must be at least 8 characters", type: "error" }); return; }
    if (newPassword !== confirmPassword) { setToast({ message: "Passwords do not match", type: "error" }); return; }
    setSavingPassword(true);
    try {
      await api.put("/auth/change-password", { currentPassword, newPassword });
      setToast({ message: "Password changed. Please login again.", type: "success" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSavingPassword(false); }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.firstName || !newUser.lastName || !newUser.organizationId) {
      setToast({ message: "All fields required", type: "error" }); return;
    }
    setSavingUser(true);
    try {
      await api.post("/auth/users", newUser);
      setToast({ message: "User created", type: "success" });
      setShowCreateUser(false); fetchAdminData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSavingUser(false); }
  };

  const handleUpdateModuleAccess = async () => {
    if (!selectedUserId) return;
    try {
      await api.put(`/auth/users/${selectedUserId}/modules`, {
        modules: ALL_MODULES.map((m) => ({ moduleName: m, hasAccess: selectedModules.includes(m) })),
      });
      setToast({ message: "Module access updated", type: "success" });
      setShowModuleAccess(false); fetchAdminData();
    } catch { setToast({ message: "Failed to update", type: "error" }); }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    const u = users.find((u) => u.id === deactivateId);
    try {
      if (u?.isActive) {
        await api.put(`/auth/users/${deactivateId}/deactivate`);
      } else {
        await api.put(`/auth/users/${deactivateId}/activate`);
      }
      setToast({ message: u?.isActive ? "User deactivated" : "User activated", type: "success" });
      setShowDeactivate(false); setDeactivateId(null); fetchAdminData();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof User; adminOnly?: boolean }> = [
    { key: "profile", label: "Profile", icon: User },
    { key: "security", label: "Security", icon: Lock },
    { key: "appearance", label: "Appearance", icon: Palette },
    { key: "users", label: "User Management", icon: Users, adminOnly: true },
    { key: "organization", label: "Organization", icon: Building, adminOnly: true },
  ];

  return (
    <PageWrapper title="Settings" subtitle="Account & system configuration">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors text-left ${
                tab === t.key ? "bg-[#5B21B6] text-white" : "text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E]"
              }`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          {tab === "profile" && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Profile Information</h3></CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#5B21B6] flex items-center justify-center text-xl font-bold text-white">
                    {user?.firstName.charAt(0)}{user?.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-[#9B93B8]">{user?.email}</p>
                    <Badge variant="purple">{user?.role.name}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="First Name" value={firstName} onChange={setFirstName} />
                  <FormInput label="Last Name" value={lastName} onChange={setLastName} />
                </div>
                <FormInput label="Email" value={user?.email || ""} onChange={() => {}} disabled />
                <div className="flex justify-end">
                  <Button onClick={handleUpdateProfile} loading={savingProfile}>Save Changes</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {tab === "security" && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Change Password</h3></CardHeader>
              <CardBody className="space-y-4 max-w-md">
                <FormInput label="Current Password" value={currentPassword} onChange={setCurrentPassword} type="password" required />
                <FormInput label="New Password" value={newPassword} onChange={setNewPassword} type="password" required placeholder="Min 8 characters" />
                <FormInput label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} type="password" required />
                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} loading={savingPassword}>Change Password</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {tab === "appearance" && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Appearance</h3></CardHeader>
              <CardBody>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">Theme</p>
                    <p className="text-xs text-[#9B93B8]">Switch between light and dark mode</p>
                  </div>
                  <button onClick={toggle}
                    className={`relative w-14 h-7 rounded-full transition-colors ${mode === "dark" ? "bg-[#5B21B6]" : "bg-[#E8E4F3]"}`}>
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${mode === "dark" ? "left-7" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="text-xs text-[#9B93B8]">Current: {mode === "dark" ? "Dark" : "Light"} mode</p>
              </CardBody>
            </Card>
          )}

          {tab === "users" && isAdmin && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">User Management</h3>
                <Button onClick={() => {
                  setNewUser({ email: "", password: "", firstName: "", lastName: "", roleName: "employee", organizationId: orgs[0]?.id || "", moduleAccess: [] });
                  setShowCreateUser(true);
                }}><Plus size={16} /> Create User</Button>
              </div>

              {loadingUsers ? <LoadingSpinner /> : (
                <Card><CardBody className="overflow-x-auto p-0">
                  <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                    {["Name", "Email", "Role", "Org", "Modules", "Status", "Actions"].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>)}
                  </tr></thead><tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                        <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{u.firstName} {u.lastName}</td>
                        <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD] text-xs">{u.email}</td>
                        <td className="px-4 py-3"><Badge variant="purple">{u.role.name}</Badge></td>
                        <td className="px-4 py-3 text-xs text-[#9B93B8]">{u.organization?.name || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#9B93B8]">{u.moduleAccess.length} modules</td>
                        <td className="px-4 py-3"><Badge variant={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setSelectedUserId(u.id); setSelectedModules(u.moduleAccess); setShowModuleAccess(true); }}
                              className="p-1.5 rounded-[6px] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] text-[#9B93B8] hover:text-[#5B21B6]" title="Edit modules"><Shield size={14} /></button>
                            <button onClick={() => { setDeactivateId(u.id); setShowDeactivate(true); }}
                              className="p-1.5 rounded-[6px] hover:bg-red-50 dark:hover:bg-red-900/20 text-[#9B93B8] hover:text-red-500" title={u.isActive ? "Deactivate" : "Activate"}>
                              {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody></table>
                </CardBody></Card>
              )}

              {/* Create User Modal */}
              <Modal open={showCreateUser} onClose={() => setShowCreateUser(false)} title="Create User" size="md">
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="First Name" value={newUser.firstName} onChange={(v) => setNewUser((p) => ({ ...p, firstName: v }))} required />
                  <FormInput label="Last Name" value={newUser.lastName} onChange={(v) => setNewUser((p) => ({ ...p, lastName: v }))} required />
                  <FormInput label="Email" value={newUser.email} onChange={(v) => setNewUser((p) => ({ ...p, email: v }))} type="email" required />
                  <FormInput label="Password" value={newUser.password} onChange={(v) => setNewUser((p) => ({ ...p, password: v }))} type="password" required placeholder="Min 8 chars" />
                  <FormSelect label="Role" value={newUser.roleName} onChange={(v) => setNewUser((p) => ({ ...p, roleName: v }))} options={roles.map((r) => ({ value: r.name, label: r.name }))} />
                  <FormSelect label="Organization" value={newUser.organizationId} onChange={(v) => setNewUser((p) => ({ ...p, organizationId: v }))} options={orgs.map((o) => ({ value: o.id, label: o.name }))} required placeholder="Select org" />
                </div>
                <div className="mt-4">
                  <p className="text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-2">Module Access</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_MODULES.map((m) => (
                      <button key={m} onClick={() => setNewUser((p) => ({
                        ...p, moduleAccess: p.moduleAccess.includes(m) ? p.moduleAccess.filter((x) => x !== m) : [...p.moduleAccess, m]
                      }))}
                        className={`px-3 py-1.5 rounded-[20px] text-xs font-medium transition-colors ${
                          newUser.moduleAccess.includes(m) ? "bg-[#5B21B6] text-white" : "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6]"
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="ghost" onClick={() => setShowCreateUser(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser} loading={savingUser}>Create User</Button>
                </div>
              </Modal>

              {/* Module Access Modal */}
              <Modal open={showModuleAccess} onClose={() => setShowModuleAccess(false)} title="Edit Module Access" size="sm">
                <div className="flex flex-wrap gap-2 mb-6">
                  {ALL_MODULES.map((m) => (
                    <button key={m} onClick={() => setSelectedModules((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m])}
                      className={`px-3 py-1.5 rounded-[20px] text-xs font-medium transition-colors ${
                        selectedModules.includes(m) ? "bg-[#5B21B6] text-white" : "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6]"
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setShowModuleAccess(false)}>Cancel</Button>
                  <Button onClick={handleUpdateModuleAccess}>Save Access</Button>
                </div>
              </Modal>

              <ConfirmDialog open={showDeactivate} onClose={() => { setShowDeactivate(false); setDeactivateId(null); }} onConfirm={handleDeactivate}
                title={users.find((u) => u.id === deactivateId)?.isActive ? "Deactivate User" : "Activate User"}
                message={users.find((u) => u.id === deactivateId)?.isActive ? "This user will lose access. Continue?" : "This will restore the user's access. Continue?"}
                confirmLabel={users.find((u) => u.id === deactivateId)?.isActive ? "Deactivate" : "Activate"} />
            </>
          )}

          {tab === "organization" && isAdmin && (
            <>
              {loadingUsers ? <LoadingSpinner /> : (
                <div className="space-y-4">
                  {orgs.map((org) => (
                    <Card key={org.id}>
                      <CardHeader className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{org.name}</h3>
                          <p className="text-xs text-[#9B93B8]">{org.slug} · {org._count.users} user(s)</p>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <p className="text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-2">Enabled Modules</p>
                        <div className="flex flex-wrap gap-2">
                          {ALL_MODULES.map((m) => {
                            const enabled = org.modules.find((om) => om.moduleName === m)?.isEnabled ?? false;
                            return (
                              <button key={m}
                                onClick={async () => {
                                  try {
                                    await api.put(`/auth/organizations/${org.id}/modules`, { modules: [{ moduleName: m, isEnabled: !enabled }] });
                                    setToast({ message: `${m} ${!enabled ? "enabled" : "disabled"}`, type: "success" });
                                    fetchAdminData();
                                  } catch { setToast({ message: "Failed", type: "error" }); }
                                }}
                                className={`px-3 py-1.5 rounded-[20px] text-xs font-medium transition-colors ${
                                  enabled ? "bg-[#5B21B6] text-white" : "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#9B93B8]"
                                }`}>
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
