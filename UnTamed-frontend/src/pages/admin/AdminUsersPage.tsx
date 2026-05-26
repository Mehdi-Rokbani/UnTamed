import { useEffect, useState } from "react";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminStatusBadge, { type AdminStatus } from "../../components/admin/AdminStatusBadge";
import {
  getAdminUsers,
  reactivateUser,
  suspendUser,
  type AdminUser,
} from "../../api/admin.api";
import styles from "../../style/admin.module.css";

function initials(name: string) {
  return name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "US";
}

function normalizeRole(role: string): Extract<AdminStatus, "ADMIN" | "GUIDE" | "ADVENTURER"> {
  if (role === "ADMIN" || role === "GUIDE") return role;
  return "ADVENTURER";
}

function normalizeUserStatus(status: string): Extract<AdminStatus, "ACTIVE" | "DISABLED" | "SUSPENDED" | "PENDING_VERIFICATION"> {
  if (status === "SUSPENDED" || status === "DISABLED" || status === "PENDING_VERIFICATION") return status;
  return "ACTIVE";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [action, setAction] = useState<"suspend" | "reactivate" | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await getAdminUsers({
        page,
        size: pageSize,
        query: debouncedQuery || undefined,
        role: roleFilter === "ALL" ? undefined : roleFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      setUsers(data.content);
      setTotalUsers(data.totalElements);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load admin users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    void loadUsers();
  }, [page, pageSize, debouncedQuery, roleFilter, statusFilter]);

  function updateRoleFilter(value: string) {
    setPage(0);
    setRoleFilter(value);
  }

  function updateStatusFilter(value: string) {
    setPage(0);
    setStatusFilter(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  function openActionModal(user: AdminUser, nextAction: "suspend" | "reactivate") {
    setSelectedUser(user);
    setAction(nextAction);
    setError(null);
    setSuccess(null);
  }

  function closeActionModal() {
    if (busyUserId) return;
    setSelectedUser(null);
    setAction(null);
  }

  async function confirmAction() {
    if (!selectedUser || !action) return;

    setBusyUserId(selectedUser.id);
    setError(null);
    setSuccess(null);

    try {
      if (action === "suspend") {
        await suspendUser(selectedUser.id);
        setSuccess(`${selectedUser.username || selectedUser.email} was suspended.`);
      } else {
        await reactivateUser(selectedUser.id);
        setSuccess(`${selectedUser.username || selectedUser.email} was reactivated.`);
      }
      setSelectedUser(null);
      setAction(null);
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "User action failed");
    } finally {
      setBusyUserId(null);
    }
  }

  function renderActions(user: AdminUser) {
    if (user.role === "ADMIN") {
      return <span className={styles.mutedText}>Protected</span>;
    }

    const status = normalizeUserStatus(user.status);

    return (
      <div className={styles.actions}>
        {status === "SUSPENDED" || status === "DISABLED" ? (
          <button
            className={`${styles.button} ${styles.buttonAccent}`}
            type="button"
            disabled={busyUserId === user.id}
            onClick={() => openActionModal(user, "reactivate")}
          >
            Reactivate
          </button>
        ) : (
          <button
            className={`${styles.button} ${styles.buttonDanger}`}
            type="button"
            disabled={busyUserId === user.id}
            onClick={() => openActionModal(user, "suspend")}
          >
            Suspend
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Users Management</h1>
          <p className={styles.pageSubtitle}>Search accounts, review roles, and control platform access.</p>
        </div>
        <button className={styles.button} type="button" onClick={() => void loadUsers()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p>}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading users...</p>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search by name or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.filters}>
              <select className={styles.select} value={roleFilter} onChange={(event) => updateRoleFilter(event.target.value)}>
                <option value="ALL">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="GUIDE">Guide</option>
                <option value="ADVENTURER">Adventurer</option>
                <option value="USER">User</option>
              </select>
              <select className={styles.select} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_VERIFICATION">Pending verification</option>
                <option value="DISABLED">Disabled</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        <AdminDataTable columns={["User", "Role", "Status", "Verified", "Joined", "Actions"]}>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className={styles.identity}>
                  <div className={styles.identityAvatar}>
                    {user.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : initials(user.username || user.email)}
                  </div>
                  <div>
                    <p className={styles.identityName}>{user.username || user.email}</p>
                    <p className={styles.mutedText}>{user.email}</p>
                  </div>
                </div>
              </td>
              <td><AdminStatusBadge status={normalizeRole(user.role)} /></td>
              <td><AdminStatusBadge status={normalizeUserStatus(user.status)} /></td>
              <td><AdminStatusBadge status={user.verified ? "VERIFIED" : "PENDING_VERIFICATION"} /></td>
              <td className={styles.mutedText}>{formatDate(user.createdAt)}</td>
              <td>{renderActions(user)}</td>
            </tr>
          ))}

          {!loading && users.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={6}>
                No users match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>
        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalUsers}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>

      {selectedUser && action && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeActionModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.resultLabel}>Account control</p>
                <h2 className={styles.modalTitle}>{action === "suspend" ? "Suspend user" : "Reactivate user"}</h2>
                <p className={styles.pageSubtitle}>{selectedUser.email}</p>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeActionModal} disabled={Boolean(busyUserId)}>
                X
              </button>
            </div>

            <p className={styles.modalHint}>
              {action === "suspend"
                ? "Suspending disables login and platform access for this user. Their data is not deleted."
                : "Reactivation enables login again, but does not automatically verify an unverified account."}
            </p>

            <div className={styles.modalActions}>
              <button className={styles.button} type="button" onClick={closeActionModal} disabled={Boolean(busyUserId)}>
                Cancel
              </button>
              <button
                className={`${styles.button} ${action === "suspend" ? styles.buttonDanger : styles.buttonAccent}`}
                type="button"
                disabled={Boolean(busyUserId)}
                onClick={() => void confirmAction()}
              >
                {busyUserId ? "Working..." : action === "suspend" ? "Confirm suspend" : "Confirm reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
