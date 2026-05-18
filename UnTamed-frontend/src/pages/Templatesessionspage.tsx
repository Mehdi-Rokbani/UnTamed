import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  ActivitySessionResponse,
  ActivityStatus,
  ActivityTemplateResponse,
  AttendanceStatus,
  BookingStatus,
  GuideParticipantDto,
  GuideSessionDetailsResponse,
  GuideTemplateSessionsDashboardResponse,
  GuideTemplateSessionsSummary,
  MeetingPointLocation,
  RefundStatus,
} from "../types/activity";
import type { AddressResponse } from "../types/geo";
import {
  createSession,
  updateSession,
  deleteOrCancelSession,
  getGuideSessionDetails,
  getGuideTemplateSessionsDashboard,
  restoreSession,
  permanentlyDeleteSession,
} from "../api/activity.api";
import { removeGuideBooking } from "../api/guide.api";
import { BackButton } from "../components/BackButton";
import { OpenSessionChatButton } from "../components/OpenSessionChatButton";
import LocationPicker from "../components/LocationPicker";
import { formatTndMinor } from "../utils/money";
import styles from "../style/templateSessions.module.css";

const Icon = {
  RefreshCw: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  ),

  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),

  Clock: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),

  MapPin: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),

  Users: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),

  Edit: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  ),

  XCircle: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),

  Restore: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </svg>
  ),

  Trash: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 16H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  ),

  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),

  X: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

type ModalState =
  | null
  | { kind: "add" }
  | { kind: "edit"; session: ActivitySessionResponse };

type ParticipantFilter = "ALL" | BookingStatus;
type AttendanceFilter = "ALL" | AttendanceStatus;

type ToastType = "success" | "error" | "warning";

type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

type ConfirmAction =
  | null
  | {
      kind: "session-cancel-delete" | "session-permanent-delete";
      session: ActivitySessionResponse;
      title: string;
      message: string;
      confirmLabel: string;
      danger: boolean;
    };

let toastId = 0;
const DASHBOARD_PAGE_SIZE = 20;

function toLocalDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatMainDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoneyMinor(amount?: number | null, currency?: string | null) {
  void currency;
  return formatTndMinor(amount);
}

function guideRefundAmount(p: GuideParticipantDto) {
  if ((p.refundAmount ?? 0) > 0) return p.refundAmount ?? 0;
  if (p.status === "COMPLETED") return p.totalAmount ?? 0;
  return 0;
}

function guideRefundPolicyLabel(p: GuideParticipantDto) {
  return p.status === "COMPLETED" ? "100% refund" : "No refund needed";
}

function isSessionStarted(sessionStartAt?: string | null) {
  if (!sessionStartAt) return false;
  const time = new Date(sessionStartAt).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

function getApiErrorMessage(e: unknown) {
  if (typeof e === "object" && e !== null && "response" in e) {
    const err = e as { response?: { data?: { message?: string } } };
    return err.response?.data?.message ?? "Request failed";
  }

  return e instanceof Error ? e.message : "Request failed";
}

function friendlyApiMessage(message: string) {
  if (message.includes("confirmed bookings")) {
    return "This session has confirmed bookings, so it cannot be cancelled. Contact participants or wait until the session ends.";
  }

  if (message.includes("payment")) {
    return "This session has a booking currently in payment. Try again after payment is completed or expired.";
  }

  if (message.includes("archived")) {
    return "This activity is archived, so its sessions cannot be changed.";
  }

  if (message.includes("Only cancelled sessions can be restored")) {
    return "Only cancelled sessions can be restored.";
  }

  if (message.includes("Cannot restore a past session")) {
    return "Past sessions cannot be restored.";
  }

  return message;
}

function statusLabel(status: ActivityStatus) {
  if (status === "PUBLISHED") return "Live";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "COMPLETED") return "Completed";
  return "Draft";
}

function rowClass(status: ActivityStatus, history: boolean) {
  if (history) return styles.rowHistory;
  if (status === "PUBLISHED") return styles.rowLive;
  if (status === "CANCELLED") return styles.rowCancelled;
  return styles.rowDraft;
}

function dotClass(status: ActivityStatus) {
  if (status === "PUBLISHED") return styles.dotLive;
  if (status === "CANCELLED") return styles.dotCancelled;
  if (status === "COMPLETED") return styles.dotCompleted;
  return styles.dotDraft;
}

function participantInitial(username?: string | null, email?: string | null) {
  return (username ?? email ?? "U").slice(0, 1).toUpperCase();
}

function participantStatusClass(status: BookingStatus) {
  if (status === "COMPLETED") return styles.pStatusConfirmed;
  if (status === "CANCELLED" || status === "EXPIRED") return styles.pStatusCancelled;
  return styles.pStatusPending;
}

function refundBadgeLabel(status?: RefundStatus | null) {
  if (status === "NOT_REFUNDABLE") return "Not refundable";
  if (status === "REFUND_PENDING") return "Refund pending";
  if (status === "REFUNDED") return "Refunded";
  if (status === "PARTIALLY_REFUNDED") return "Partially refunded";
  if (status === "REFUND_FAILED") return "Refund failed";
  return "No refund";
}

function refundBadgeClass(status?: RefundStatus | null) {
  if (status === "REFUNDED") return styles.refundBadgeGreen;
  if (status === "PARTIALLY_REFUNDED") return styles.refundBadgeAmber;
  if (status === "REFUND_PENDING") return styles.refundBadgeBlue;
  if (status === "REFUND_FAILED") return styles.refundBadgeRed;
  return styles.refundBadgeMuted;
}

function attendanceLabel(status: AttendanceStatus) {
  if (status === "NOT_MARKED") return "NOT_CHECKED_IN";
  return status;
}

function attendanceStatusClass(status: AttendanceStatus) {
  if (status === "PRESENT") return styles.attendancePresent;
  if (status === "ABSENT") return styles.attendanceAbsent;
  return styles.attendanceNotChecked;
}

function bookingHasAttendance(p: GuideParticipantDto, filter: AttendanceFilter) {
  if (filter === "ALL") return true;
  return (p.passes ?? []).some((pass) => pass.attendanceStatus === filter);
}

function isPastSession(session: ActivitySessionResponse) {
  return new Date(session.endAt).getTime() < Date.now();
}

function isHistorySession(session: ActivitySessionResponse) {
  return (
    isPastSession(session) ||
    session.status === "COMPLETED" ||
    session.status === "CANCELLED"
  );
}

function dashboardTemplateToActivityTemplate(
  data: GuideTemplateSessionsDashboardResponse["template"]
): ActivityTemplateResponse {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    difficulty: data.difficulty,
    price: data.price,
    guideId: "",
    addressId: data.addressId ?? "",
    tags: [],
    safetyNotes: [],
    rating: { average: 0, count: 0 },
    images: data.images ?? [],
    categoryIds: data.categoryIds ?? [],
    archived: data.archived,
    archivedAt: data.archivedAt ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function dashboardSessionToActivitySession(
  session: GuideTemplateSessionsDashboardResponse["sessions"]["content"][number]
): ActivitySessionResponse {
  return {
    id: session.sessionId,
    templateId: session.templateId,
    guideId: "",
    startAt: session.startAt,
    endAt: session.endAt,
    capacity: session.capacity,
    bookedCount: session.bookedCount,
    status: session.status,
    meetingPoint: session.meetingPoint ?? null,
    meetingPointLocation: session.meetingPointLocation ?? null,
    sessionNote: session.sessionNote ?? null,
    template: null,
    rating: null,
  };
}

function meetingPointToAddress(value?: MeetingPointLocation | null): AddressResponse | null {
  if (!value) return null;

  return {
    id: value.placeId ?? `${value.latitude}:${value.longitude}`,
    provider: "locationiq",
    providerPlaceId: value.placeId ?? `${value.latitude}:${value.longitude}`,
    displayName: value.address || value.label,
    governorate: null,
    delegation: null,
    locality: null,
    latitude: value.latitude,
    longitude: value.longitude,
    usesCount: null,
  };
}

function addressToMeetingPoint(value: AddressResponse): MeetingPointLocation {
  return {
    label: value.displayName,
    address: value.displayName,
    latitude: value.latitude,
    longitude: value.longitude,
    placeId: value.providerPlaceId ?? value.id ?? null,
    source: "LOCATIONIQ",
  };
}

function meetingPointDisplay(session: Pick<ActivitySessionResponse, "meetingPoint" | "meetingPointLocation">) {
  return session.meetingPointLocation?.label
    || session.meetingPointLocation?.address
    || session.meetingPoint
    || "";
}

export default function TemplateSessionsPage() {
  const { id } = useParams<{ id: string }>();

  const [template, setTemplate] = useState<ActivityTemplateResponse | null>(null);
  const [sessions, setSessions] = useState<ActivitySessionResponse[]>([]);
  const [dashboardSummary, setDashboardSummary] =
    useState<GuideTemplateSessionsSummary | null>(null);
  const [sessionPage, setSessionPage] =
    useState<GuideTemplateSessionsDashboardResponse["sessions"] | null>(null);
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState<"active" | "history">("active");

  const [modal, setModal] = useState<ModalState>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [participantsModal, setParticipantsModal] =
    useState<GuideSessionDetailsResponse | null>(null);
  const [participantFilter, setParticipantFilter] =
    useState<ParticipantFilter>("ALL");
  const [attendanceFilter, setAttendanceFilter] =
    useState<AttendanceFilter>("ALL");
  const [expandedBookings, setExpandedBookings] =
    useState<Set<string>>(new Set());
  const [moderationTarget, setModerationTarget] =
    useState<GuideParticipantDto | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [loadingParticipantsId, setLoadingParticipantsId] =
    useState<string | null>(null);

  const [formStartAt, setFormStartAt] = useState("");
  const [formEndAt, setFormEndAt] = useState("");
  const [formCapacity, setFormCapacity] = useState(10);
  const [formMeetingPoint, setFormMeetingPoint] = useState("");
  const [formMeetingPointLocation, setFormMeetingPointLocation] = useState<MeetingPointLocation | null>(null);
  const [formSessionNote, setFormSessionNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);

  function showToast(type: ToastType, message: string) {
    const toast: ToastMessage = {
      id: ++toastId,
      type,
      message,
    };

    setToasts((prev) => [...prev, toast]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4500);
  }

  function closeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function refresh(options?: { page?: number; append?: boolean; silent?: boolean }) {
    if (!id) return;

    const page = options?.page ?? 0;
    const append = options?.append ?? false;
    const silent = options?.silent ?? false;

    if (append) setLoadingMoreSessions(true);
    else if (!silent) setLoading(true);

    if (!append) setErr(null);

    try {
      const dashboard = await getGuideTemplateSessionsDashboard(id, page, DASHBOARD_PAGE_SIZE);
      const nextSessions = dashboard.sessions.content
        .map(dashboardSessionToActivitySession)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      setTemplate(dashboardTemplateToActivityTemplate(dashboard.template));
      setDashboardSummary(dashboard.summary);
      setSessionPage(dashboard.sessions);
      setSessions((prev) => {
        if (!append) return nextSessions;

        const byId = new Map(prev.map((session) => [session.id, session]));
        nextSessions.forEach((session) => byId.set(session.id, session));
        return Array.from(byId.values()).sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        );
      });
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      if (append) setLoadingMoreSessions(false);
      else if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [id]);

  const activeSessions = useMemo(() => {
    return sessions.filter((s) => !isHistorySession(s));
  }, [sessions]);

  const historySessions = useMemo(() => {
    return sessions.filter((s) => isHistorySession(s));
  }, [sessions]);

  const visibleSessions = tab === "active" ? activeSessions : historySessions;

  const publishedCount = useMemo(() => {
    return sessions.filter((s) => s.status === "PUBLISHED").length;
  }, [sessions]);

  const totalBooked = useMemo(() => {
    return sessions.reduce((sum, s) => sum + (s.bookedCount ?? 0), 0);
  }, [sessions]);

  const hasMoreSessions = Boolean(sessionPage && !sessionPage.last);

  async function handleLoadMoreSessions() {
    if (!sessionPage || sessionPage.last || loadingMoreSessions) return;
    await refresh({ page: sessionPage.page + 1, append: true, silent: true });
  }

  const filteredParticipants = useMemo(() => {
    if (!participantsModal) return [];

    return participantsModal.bookings.filter((p) => {
      const matchesBooking =
        participantFilter === "ALL" || p.status === participantFilter;
      const matchesAttendance = bookingHasAttendance(p, attendanceFilter);
      return matchesBooking && matchesAttendance;
    });
  }, [participantsModal, participantFilter, attendanceFilter]);

  const attendanceSummary = useMemo(() => {
    if (!participantsModal) {
      return { totalPasses: 0, present: 0, absent: 0, notCheckedIn: 0 };
    }

    if (participantsModal.attendanceSummary) {
      return participantsModal.attendanceSummary;
    }

    const passes = participantsModal.bookings
      .flatMap((booking) => booking.passes ?? [])
      .filter((pass) => pass.status === "ACTIVE");
    return {
      totalPasses: passes.length,
      present: passes.filter((pass) => pass.attendanceStatus === "PRESENT").length,
      absent: passes.filter((pass) => pass.attendanceStatus === "ABSENT").length,
      notCheckedIn: passes.filter((pass) => pass.attendanceStatus === "NOT_MARKED").length,
    };
  }, [participantsModal]);

  function resetForm() {
    setFormStartAt("");
    setFormEndAt("");
    setFormCapacity(10);
    setFormMeetingPoint("");
    setFormMeetingPointLocation(null);
    setFormSessionNote("");
    setFormError(null);
  }

  function closeModal() {
    setModal(null);
    resetForm();
  }

  function openAddSessionModal() {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

    setFormStartAt(toLocalDateTimeInputValue(start));
    setFormEndAt(toLocalDateTimeInputValue(end));
    setFormCapacity(10);
    setFormMeetingPoint("");
    setFormMeetingPointLocation(null);
    setFormSessionNote("");
    setFormError(null);
    setModal({ kind: "add" });
  }

  function openEditSessionModal(session: ActivitySessionResponse) {
    setFormStartAt(toLocalDateTimeInputValue(new Date(session.startAt)));
    setFormEndAt(toLocalDateTimeInputValue(new Date(session.endAt)));
    setFormCapacity(session.capacity);
    setFormMeetingPoint(meetingPointDisplay(session));
    setFormMeetingPointLocation(session.meetingPointLocation ?? null);
    setFormSessionNote(session.sessionNote ?? "");
    setFormError(null);
    setModal({ kind: "edit", session });
  }

  function handleStartAtChange(value: string) {
    setFormStartAt(value);

    if (!value) return;

    const start = new Date(value);
    const currentEnd = formEndAt ? new Date(formEndAt) : null;

    if (!currentEnd || currentEnd <= start) {
      const suggestedEnd = new Date(start.getTime() + 3 * 60 * 60 * 1000);
      setFormEndAt(toLocalDateTimeInputValue(suggestedEnd));
    }
  }

  function validateSessionForm(editingSession?: ActivitySessionResponse) {
    if (!formStartAt || !formEndAt) {
      return "Start and end date are required.";
    }

    const startAt = new Date(formStartAt);
    const endAt = new Date(formEndAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return "Invalid session date.";
    }

    if (startAt <= new Date()) {
      return "Start time must be in the future.";
    }

    if (endAt <= startAt) {
      return "End time must be after start time.";
    }

    if (formCapacity < 3) {
      return "Capacity must be at least 3 participants.";
    }

    if (editingSession && formCapacity < (editingSession.bookedCount ?? 0)) {
      return "Capacity cannot be lower than booked seats.";
    }

    if (!formMeetingPointLocation) {
      return "Choose a meeting point from the map or address search.";
    }

    if (formMeetingPoint.length > 300) {
      return "Meeting point display text must be 300 characters or less.";
    }

    if (formSessionNote.length > 1000) {
      return "Session note must be 1000 characters or less.";
    }

    return null;
  }

  async function handleAddSession() {
    if (!id) return;

    const validationError = validateSessionForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSavingForm(true);
    setFormError(null);
    setErr(null);

    try {
      const startAt = new Date(formStartAt);
      const endAt = new Date(formEndAt);

      await createSession(id, {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        capacity: formCapacity,
        meetingPoint: formMeetingPoint.trim() || null,
        meetingPointLocation: formMeetingPointLocation,
        sessionNote: formSessionNote.trim() || null,
      });

      await refresh({ silent: true });
      closeModal();
      setTab("active");
      showToast("success", "Session added successfully.");
    } catch (e) {
      setFormError(getApiErrorMessage(e));
    } finally {
      setSavingForm(false);
    }
  }

  async function handleEditSession(session: ActivitySessionResponse) {
    const validationError = validateSessionForm(session);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSavingForm(true);
    setFormError(null);
    setErr(null);

    try {
      const startAt = new Date(formStartAt);
      const endAt = new Date(formEndAt);

      await updateSession(session.id, {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        capacity: formCapacity,
        meetingPoint: formMeetingPoint.trim(),
        meetingPointLocation: formMeetingPointLocation,
        sessionNote: formSessionNote.trim(),
      });

      await refresh({ silent: true });
      closeModal();
      showToast("success", "Session updated successfully.");
    } catch (e) {
      setFormError(getApiErrorMessage(e));
    } finally {
      setSavingForm(false);
    }
  }

  async function handlePublish(sessionId: string, published: boolean) {
    setBusyId(sessionId);
    setErr(null);

    try {
      await updateSession(sessionId, {
        status: published ? "PUBLISHED" : "DRAFT",
      });

      await refresh({ silent: true });
      showToast(
        "success",
        published ? "Session published." : "Session moved to draft."
      );
    } catch (e) {
      showToast("error", friendlyApiMessage(getApiErrorMessage(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelOrDelete(session: ActivitySessionResponse) {
    const booked = session.bookedCount ?? 0;
    const hasBookings = booked > 0;
    let refundNotice = "";

    if (hasBookings) {
      setBusyId(session.id);
      try {
        const details = await getGuideSessionDetails(session.id);
        const paid = details.bookings.filter((b) => b.status === "COMPLETED").length;
        const pending = details.bookings.filter((b) => b.status === "PENDING").length;
        const paying = details.bookings.filter((b) => b.status === "PAYING").length;
        const parts: string[] = [];
        if (paid > 0) parts.push("Paid participants will receive a full refund.");
        if (pending > 0) parts.push("Pending bookings will be cancelled with no refund.");
        if (paying > 0) parts.push("This session has payments in progress. The backend may block cancellation.");
        refundNotice = parts.length ? ` ${parts.join(" ")}` : "";
      } catch {
        refundNotice = " Refund details could not be loaded, but the backend will apply the correct policy.";
      } finally {
        setBusyId(null);
      }
    }

    setConfirmAction({
      kind: "session-cancel-delete",
      session,
      title: hasBookings ? "Cancel this session?" : "Delete this session?",
      message: hasBookings
        ? `Cancelling this session will move it to history and apply refund rules.${refundNotice}`
        : "This session has no bookings and can be permanently deleted.",
      confirmLabel: hasBookings ? "Cancel session" : "Delete session",
      danger: true,
    });
  }

  function handlePermanentDelete(session: ActivitySessionResponse) {
    setConfirmAction({
      kind: "session-permanent-delete",
      session,
      title: "Delete cancelled session permanently?",
      message:
        "This will permanently delete the cancelled session and its cancelled booking history. This action cannot be undone.",
      confirmLabel: "Delete permanently",
      danger: true,
    });
  }

  async function handleRestoreSession(session: ActivitySessionResponse) {
    setBusyId(session.id);
    setErr(null);

    try {
      await restoreSession(session.id);
      await refresh({ silent: true });

      setTab("active");
      showToast("success", "Session restored as draft.");
    } catch (e) {
      showToast("error", friendlyApiMessage(getApiErrorMessage(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmSessionAction() {
    if (!confirmAction) return;

    const session = confirmAction.session;
    const kind = confirmAction.kind;

    setConfirmAction(null);
    setBusyId(session.id);
    setErr(null);

    try {
      if (kind === "session-permanent-delete") {
        const res = await permanentlyDeleteSession(session.id);

        await refresh({ silent: true });

        showToast(
          "success",
          res.message || "Cancelled session was permanently deleted."
        );

        return;
      }

      const res = await deleteOrCancelSession(session.id);

      if (res.action === "DELETED") {
        await refresh({ silent: true });
        showToast("success", res.message || "Session deleted successfully.");
        return;
      }

      await refresh({ silent: true });

      if (res.action === "CANCELLED") {
        setTab("history");
        showToast("warning", res.message || "Session was cancelled.");
        return;
      }

      showToast("warning", res.message || "Session was kept for history.");
    } catch (e) {
      showToast("error", friendlyApiMessage(getApiErrorMessage(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewParticipants(sessionId: string) {
    setLoadingParticipantsId(sessionId);
    setErr(null);

    try {
      const details = await getGuideSessionDetails(sessionId);
      setParticipantFilter("ALL");
      setAttendanceFilter("ALL");
      setExpandedBookings(new Set());
      setParticipantsModal(details);
    } catch (e) {
      showToast("error", getApiErrorMessage(e));
    } finally {
      setLoadingParticipantsId(null);
    }
  }

  function toggleExpandedBooking(bookingId: string) {
    setExpandedBookings((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  }

  function openModeration(p: GuideParticipantDto) {
    setModerationTarget(p);
    setModerationReason("");
    setModerationError(null);
  }

  async function confirmModeration() {
    if (!moderationTarget || !participantsModal) return;
    const reason = moderationReason.trim();
    const refundAmount = guideRefundAmount(moderationTarget);
    if (!reason) {
      setModerationError("Please add a reason.");
      return;
    }

    setModerationBusy(true);
    setModerationError(null);
    try {
      await removeGuideBooking(moderationTarget.bookingId, reason);
      const details = await getGuideSessionDetails(participantsModal.session.id);
      setParticipantsModal(details);
      await refresh({ silent: true });
      showToast(
        "success",
        refundAmount > 0
          ? `Booking removed. Refund of ${formatTndMinor(refundAmount)} has been initiated.`
          : "Booking removed. No payment was captured."
      );
      setModerationTarget(null);
      setModerationReason("");
    } catch (e) {
      setModerationError(getApiErrorMessage(e));
    } finally {
      setModerationBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <BackButton
          fallbackTo="/guide/activities"
          label="Activities"
          className={styles.backBtn}
          variant="plain"
        />

        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>
              {template?.title ?? "Activity Sessions"}
            </h1>

            {template?.archived && (
              <span className={styles.archivedChip}>Archived</span>
            )}
          </div>

          <div className={styles.headerActions}>
            <button type="button" className={styles.btnGhost} onClick={() => refresh()}>
              <Icon.RefreshCw />
              Refresh
            </button>

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={openAddSessionModal}
              disabled={template?.archived}
              title={
                template?.archived
                  ? "Archived activities cannot receive new sessions."
                  : undefined
              }
            >
              <Icon.Plus />
              New Session
            </button>
          </div>
        </div>
      </header>

      {template?.archived && (
        <div className={styles.noticeBanner}>
          This activity is archived. You can view its history, but you cannot add,
          edit, or publish sessions.
        </div>
      )}

      <section className={styles.metricsBar}>
        <div className={styles.metric}>
          <span className={styles.metricVal}>
            {dashboardSummary?.totalSessions ?? sessions.length}
          </span>
          <span className={styles.metricLabel}>Total sessions</span>
        </div>

        <div className={styles.metric}>
          <span className={`${styles.metricVal} ${styles.metricGreen}`}>
            {publishedCount}
          </span>
          <span className={styles.metricLabel}>Published</span>
        </div>

        <div className={styles.metric}>
          <span className={`${styles.metricVal} ${styles.metricBlue}`}>
            {dashboardSummary?.upcomingSessions ?? activeSessions.length}
          </span>
          <span className={styles.metricLabel}>Active</span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricVal}>
            {dashboardSummary
              ? dashboardSummary.completedSessions + dashboardSummary.cancelledSessions
              : historySessions.length}
          </span>
          <span className={styles.metricLabel}>Past</span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricVal}>
            {dashboardSummary?.totalParticipants ?? totalBooked}
          </span>
          <span className={styles.metricLabel}>Booked seats</span>
        </div>
      </section>

      {err && <div className={styles.errBanner}>⚠️ {err}</div>}

      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          Loading sessions…
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Icon.Calendar />
          </div>

          <p className={styles.emptyTitle}>No sessions yet</p>
          <p className={styles.emptySub}>
            Add your first session to schedule this activity.
          </p>

          {!template?.archived && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={openAddSessionModal}
            >
              <Icon.Plus />
              Add First Session
            </button>
          )}
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <>
          <div className={styles.tabBar}>
            <button
              type="button"
              className={`${styles.tab} ${tab === "active" ? styles.tabActive : ""}`}
              onClick={() => setTab("active")}
            >
              Active & Upcoming
              <span className={styles.tabCount}>{activeSessions.length}</span>
            </button>

            <button
              type="button"
              className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`}
              onClick={() => setTab("history")}
            >
              History
              <span className={styles.tabCount}>{historySessions.length}</span>
            </button>
          </div>

          <section className={styles.sessionTable}>
            <div className={styles.tableHeader}>
              <span>Date & Time</span>
              <span>Capacity</span>
              <span>Actions</span>
            </div>

            <div className={styles.tableBody}>
              {visibleSessions.length === 0 ? (
                <div className={styles.emptyTab}>
                  {tab === "active"
                    ? "No active or upcoming sessions."
                    : "No past sessions yet."}
                </div>
              ) : (
                visibleSessions.map((s) => {
                  const isBusy = busyId === s.id;
                  const isPublished = s.status === "PUBLISHED";
                  const isHistory = isHistorySession(s);
                  const isCancelled = s.status === "CANCELLED";
                  const isCompleted = s.status === "COMPLETED";
                  const isPast = isPastSession(s);

                  const canManage = !template?.archived && !isHistory;
                  const canEdit = canManage;
                  const canTogglePublish = canManage && (s.bookedCount ?? 0) === 0;
                  const canCancelOrDelete =
                    !template?.archived &&
                    !isCompleted &&
                    !isPast &&
                    !isHistory;

                  const canRestoreOrPermanentDelete =
                    isHistory &&
                    s.status === "CANCELLED" &&
                    !isPast &&
                    !template?.archived;

                  const booked = s.bookedCount ?? 0;
                  const capacity = Math.max(s.capacity ?? 0, 1);
                  const percent = Math.min(100, Math.round((booked / capacity) * 100));
                  const spotsLeft = Math.max(0, capacity - booked);

                  const fillClass =
                    percent >= 100
                      ? styles.fillFull
                      : percent >= 70
                        ? styles.fillWarn
                        : styles.fillOk;

                  const spotsClass =
                    spotsLeft <= 0
                      ? styles.spotsFull
                      : spotsLeft <= 3
                        ? styles.spotsWarn
                        : "";

                  return (
                    <article
                      key={s.id}
                      className={`${styles.sessionRow} ${rowClass(s.status, isHistory)}`}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowStatusLine}>
                          <span className={`${styles.statusDot} ${dotClass(s.status)}`} />
                          <span className={styles.statusText}>
                            {isHistory && !isCancelled && !isCompleted
                              ? "History"
                              : statusLabel(s.status)}
                          </span>

                          {!isHistory && <span className={styles.upcomingBadge}>Upcoming</span>}
                        </div>

                        <div className={styles.rowDate}>{formatMainDate(s.startAt)}</div>

                        <div className={styles.rowTimeLine}>
                          <span className={styles.rowTimeIcon}>
                            <Icon.Clock />
                          </span>

                          <span className={styles.rowTimeText}>
                            {formatTime(s.startAt)} — {formatTime(s.endAt)}
                          </span>

                          {meetingPointDisplay(s) && (
                            <>
                              <span className={styles.rowTimeDivider} />
                              <span className={styles.rowMeetingIcon}>
                                <Icon.MapPin />
                              </span>
                              <span className={styles.rowMeetingText}>
                                {meetingPointDisplay(s)}
                              </span>
                            </>
                          )}
                        </div>

                        {s.sessionNote && <div className={styles.rowNote}>{s.sessionNote}</div>}
                      </div>

                      <div className={styles.rowCapacity}>
                        <div className={styles.capacityNums}>
                          <span className={styles.capacityBooked}>{booked}</span>
                          <span className={styles.capacitySlash}>/</span>
                          <span className={styles.capacityTotal}>{capacity}</span>
                        </div>

                        <div className={styles.capacityBar}>
                          <div
                            className={`${styles.capacityFill} ${fillClass}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {!isHistory && (
                          <span className={`${styles.spotsLeft} ${spotsClass}`}>
                            {spotsLeft} open
                          </span>
                        )}
                      </div>

                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${styles.actBtn} ${styles.actBtnParticipants}`}
                          disabled={loadingParticipantsId === s.id}
                          onClick={() => handleViewParticipants(s.id)}
                        >
                          <Icon.Users />
                          {booked}
                        </button>

                        <OpenSessionChatButton
                          sessionId={s.id}
                          className={styles.actBtn}
                          label="Session chat"
                        />

                        {canEdit && (
                          <button
                            type="button"
                            className={styles.actBtn}
                            disabled={isBusy}
                            onClick={() => openEditSessionModal(s)}
                          >
                            <Icon.Edit />
                            Edit
                          </button>
                        )}

                        {canTogglePublish && (
                          <button
                            type="button"
                            className={
                              isPublished ? styles.actBtnSecondary : styles.actBtnPrimary
                            }
                            disabled={isBusy}
                            onClick={() => handlePublish(s.id, !isPublished)}
                          >
                            {isBusy
                              ? "Working..."
                              : isPublished
                                ? "Unpublish"
                                : "Publish"}
                          </button>
                        )}

                        {canCancelOrDelete && (
                          <button
                            type="button"
                            className={styles.actBtnDangerText}
                            disabled={isBusy}
                            onClick={() => handleCancelOrDelete(s)}
                            title={booked > 0 ? "Cancel session" : "Delete session"}
                          >
                            <Icon.XCircle />
                            {booked > 0 ? "Cancel" : "Delete"}
                          </button>
                        )}

                        {canRestoreOrPermanentDelete && (
                          <>
                            <button
                              type="button"
                              className={styles.actBtnRestore}
                              disabled={isBusy}
                              onClick={() => handleRestoreSession(s)}
                              title="Restore session as draft"
                            >
                              <Icon.Restore />
                              Restore
                            </button>

                            <button
                              type="button"
                              className={styles.actBtnDangerText}
                              disabled={isBusy}
                              onClick={() => handlePermanentDelete(s)}
                              title="Delete permanently"
                            >
                              <Icon.Trash />
                              Delete permanently
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          {hasMoreSessions && (
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={handleLoadMoreSessions}
                disabled={loadingMoreSessions}
              >
                {loadingMoreSessions ? "Loading..." : "Load more sessions"}
              </button>
            </div>
          )}
        </>
      )}

      {participantsModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setParticipantsModal(null)}
        >
          <div className={`${styles.modal} ${styles.participantsModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Session Participants</h2>
                <p className={styles.modalSub}>
                  {formatDateTime(participantsModal.session.startAt)}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setParticipantsModal(null)}
              >
                <Icon.X />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.pMetrics}>
                <div className={styles.pMetric}>
                  <span className={styles.pMetricVal}>
                    {participantsModal.totalBookings}
                  </span>
                  <span className={styles.pMetricLabel}>Bookings</span>
                </div>

                <div className={styles.pMetric}>
                  <span className={styles.pMetricVal}>
                    {participantsModal.totalPeople}
                  </span>
                  <span className={styles.pMetricLabel}>People</span>
                </div>

                <div className={styles.pMetric}>
                  <span className={`${styles.pMetricVal} ${styles.pMetricGreen}`}>
                    {participantsModal.completedCount}
                  </span>
                  <span className={styles.pMetricLabel}>Confirmed</span>
                </div>

                <div className={styles.pMetric}>
                  <span className={`${styles.pMetricVal} ${styles.pMetricOrange}`}>
                    {participantsModal.pendingCount}
                  </span>
                  <span className={styles.pMetricLabel}>Pending</span>
                </div>
              </div>

              <div className={styles.attendanceMetrics}>
                <div className={styles.attendanceMetric}>
                  <span className={styles.pMetricVal}>{attendanceSummary.totalPasses}</span>
                  <span className={styles.pMetricLabel}>Total passes</span>
                </div>
                <div className={styles.attendanceMetric}>
                  <span className={`${styles.pMetricVal} ${styles.pMetricGreen}`}>{attendanceSummary.present}</span>
                  <span className={styles.pMetricLabel}>Present</span>
                </div>
                <div className={styles.attendanceMetric}>
                  <span className={`${styles.pMetricVal} ${styles.pMetricRed}`}>{attendanceSummary.absent}</span>
                  <span className={styles.pMetricLabel}>Absent</span>
                </div>
                <div className={styles.attendanceMetric}>
                  <span className={styles.pMetricVal}>{attendanceSummary.notCheckedIn}</span>
                  <span className={styles.pMetricLabel}>Not checked in</span>
                </div>
              </div>

              <div className={styles.filterRow}>
                {[
                  { key: "ALL", label: "All" },
                  { key: "COMPLETED", label: "Confirmed" },
                  { key: "PENDING", label: "Pending" },
                  { key: "CANCELLED", label: "Cancelled" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`${styles.filterBtn} ${
                      participantFilter === f.key ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setParticipantFilter(f.key as ParticipantFilter)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className={styles.filterRow}>
                {[
                  { key: "ALL", label: "All attendance" },
                  { key: "PRESENT", label: "Present" },
                  { key: "ABSENT", label: "Absent" },
                  { key: "NOT_MARKED", label: "Not checked in" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`${styles.filterBtn} ${
                      attendanceFilter === f.key ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setAttendanceFilter(f.key as AttendanceFilter)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredParticipants.length === 0 ? (
                <div className={styles.emptyParticipants}>
                  No participants match this filter.
                </div>
              ) : (
                <div className={styles.participantsList}>
                  {filteredParticipants.map((p) => {
                    const passes = p.passes ?? [];
                    const isExpanded = expandedBookings.has(p.bookingId);
                    const canModerate =
                      !isSessionStarted(participantsModal.session.startAt) &&
                      (p.status === "PENDING" || p.status === "COMPLETED");

                    return (
                      <article key={p.bookingId} className={styles.participantCard}>
                        <div
                          role="button"
                          tabIndex={0}
                          className={styles.participantRow}
                          onClick={() => toggleExpandedBooking(p.bookingId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleExpandedBooking(p.bookingId);
                            }
                          }}
                          aria-expanded={isExpanded}
                        >
                      <Link
                        to={`/users/${p.userId}`}
                        className={styles.profileAvatarLink}
                        aria-label={`View ${(p.username ?? "participant")}'s public profile`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className={styles.pAvatar}>
                          {p.profileImageUrl ? (
                            <img
                              src={p.profileImageUrl}
                              alt={p.username ?? "User"}
                            />
                          ) : (
                            <span>{participantInitial(p.username, p.email)}</span>
                          )}
                        </div>
                      </Link>

                      <div className={styles.pInfo}>
                        <Link
                          to={`/users/${p.userId}`}
                          className={styles.pName}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {p.username ?? "Unknown user"}
                        </Link>
                        <span className={styles.pEmail}>{p.email ?? p.userId}</span>
                        <span className={styles.pDate}>
                          Booked {formatDateTime(p.createdAt)}
                        </span>
                      </div>

                      <div className={styles.pMeta}>
                        <span className={styles.pPeopleBadge}>
                          {p.numberOfPeople}×
                        </span>

                        <span
                          className={`${styles.pStatusBadge} ${participantStatusClass(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                        <span className={styles.expandHint}>
                          {isExpanded ? "Hide guests" : `${passes.length || p.numberOfPeople} guests`}
                        </span>
                      </div>
                    </div>

                    {(p.status === "CANCELLED" || canModerate) && (
                      <div className={styles.moderationPanel}>
                        {p.status === "CANCELLED" && (
                          <div className={styles.cancelMeta}>
                            <span className={`${styles.refundBadge} ${refundBadgeClass(p.refundStatus)}`}>
                              {refundBadgeLabel(p.refundStatus)}
                            </span>
                            {(p.refundAmount ?? 0) > 0 && (
                              <span>{formatMoneyMinor(p.refundAmount, p.refundCurrency)} refund</span>
                            )}
                            {p.cancelledBy && <span>Cancelled by {p.cancelledBy.toLowerCase()}</span>}
                            {p.cancelledAt && <span>{formatDateTime(p.cancelledAt)}</span>}
                            {p.cancellationReason && <span>{p.cancellationReason}</span>}
                          </div>
                        )}

                        {canModerate && (
                          <button
                            type="button"
                            className={p.status === "COMPLETED" ? styles.moderationDanger : styles.moderationButton}
                            onClick={() => openModeration(p)}
                          >
                            {p.status === "COMPLETED" ? "Remove & refund" : "Cancel pending"}
                          </button>
                        )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className={styles.passDetails}>
                        {passes.length === 0 ? (
                          <div className={styles.noPasses}>
                            No guest passes were created for this booking yet.
                          </div>
                        ) : (
                          passes.map((pass) => (
                            <div key={pass.passId} className={styles.passDetailRow}>
                              <div className={styles.passDetailMain}>
                                <strong>{pass.guestName || "Guest"}</strong>
                                <span>
                                  Pass {pass.passNumber} of {pass.totalPasses}
                                  {pass.mainBooker && <em>Main booker</em>}
                                </span>
                              </div>
                              <div className={styles.passDetailMeta}>
                                {pass.status === "CANCELLED" && (
                                  <span className={`${styles.attendanceBadge} ${styles.attendanceAbsent}`}>
                                    PASS CANCELLED
                                  </span>
                                )}
                                <span
                                  className={`${styles.attendanceBadge} ${attendanceStatusClass(
                                    pass.attendanceStatus
                                  )}`}
                                >
                                  {attendanceLabel(pass.attendanceStatus)}
                                </span>
                                <small>
                                  {pass.markedAt ? `Marked ${formatDateTime(pass.markedAt)}` : "Not marked"}
                                  {pass.markedByGuideId ? ` by ${pass.markedByGuideId}` : ""}
                                </small>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnGhost}
                type="button"
                onClick={() => setParticipantsModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  {modal.kind === "add" ? "Add New Session" : "Edit Session"}
                </h2>
                <p className={styles.modalSub}>
                  Sessions start as draft. Publish when ready.
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={closeModal}
              >
                <Icon.X />
              </button>
            </div>

            <div className={styles.modalBody}>
              {formError && <div className={styles.formErr}>⚠️ {formError}</div>}

              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Start Date & Time</label>

                    <input
                      className={styles.formInput}
                      type="datetime-local"
                      value={formStartAt}
                      min={toLocalDateTimeInputValue(new Date())}
                      onChange={(e) => handleStartAtChange(e.target.value)}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>End Date & Time</label>

                    <input
                      className={styles.formInput}
                      type="datetime-local"
                      value={formEndAt}
                      min={formStartAt || toLocalDateTimeInputValue(new Date())}
                      onChange={(e) => setFormEndAt(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    Capacity{" "}
                    {modal.kind === "edit" && (
                      <span className={styles.formLabelHint}>
                        min {modal.session.bookedCount ?? 0} booked seats
                      </span>
                    )}
                  </label>

                  <input
                    className={styles.formInput}
                    type="number"
                    min={
                      modal.kind === "edit"
                        ? Math.max(3, modal.session.bookedCount ?? 0)
                        : 3
                    }
                    max={500}
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                  />

                  <span className={styles.formHint}>
                    Capacity cannot be lower than booked seats.
                  </span>
                </div>

                <div className={styles.formField}>
                  <LocationPicker
                    label="Meeting Point"
                    placeholder="Search the exact meeting address..."
                    value={meetingPointToAddress(formMeetingPointLocation)}
                    onChange={(value) => {
                      const next = value ? addressToMeetingPoint(value) : null;
                      setFormMeetingPointLocation(next);
                      setFormMeetingPoint(next?.label ?? "");
                    }}
                  />
                  {formMeetingPoint && !formMeetingPointLocation && (
                    <span className={styles.formHint}>
                      Existing text meeting point: {formMeetingPoint}
                    </span>
                  )}
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    Session Note{" "}
                    <span className={styles.formLabelHint}>optional</span>
                  </label>

                  <textarea
                    className={styles.formInput}
                    rows={4}
                    maxLength={1000}
                    value={formSessionNote}
                    onChange={(e) => setFormSessionNote(e.target.value)}
                    placeholder="Example: Bring water and arrive 15 minutes early."
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} type="button" onClick={closeModal}>
                Cancel
              </button>

              <button
                className={styles.btnPrimary}
                type="button"
                disabled={
                  savingForm ||
                  !formStartAt ||
                  !formEndAt ||
                  !formMeetingPointLocation ||
                  formCapacity < 3 ||
                  new Date(formEndAt) <= new Date(formStartAt)
                }
                onClick={() =>
                  modal.kind === "add"
                    ? handleAddSession()
                    : handleEditSession(modal.session)
                }
              >
                {savingForm
                  ? "Saving..."
                  : modal.kind === "add"
                    ? "Add Session"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {moderationTarget && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !moderationBusy && setModerationTarget(null)}
        >
          <div className={`${styles.modal} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  Remove participant booking?
                </h2>
                <p className={styles.modalSub}>{moderationTarget.username ?? moderationTarget.email ?? moderationTarget.userId}</p>
              </div>
              <button
                className={styles.modalClose}
                type="button"
                disabled={moderationBusy}
                onClick={() => setModerationTarget(null)}
              >
                <Icon.X />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={moderationTarget.status === "COMPLETED" ? styles.confirmBoxDanger : styles.confirmBox}>
                <div>
                  <span>Booking total</span>
                  <strong>{formatTndMinor(moderationTarget.totalAmount ?? 0)}</strong>
                </div>
                <div>
                  <span>Refund policy</span>
                  <strong>{guideRefundPolicyLabel(moderationTarget)}</strong>
                </div>
                <div>
                  <span>Estimated refund amount</span>
                  <strong>{formatTndMinor(guideRefundAmount(moderationTarget))}</strong>
                </div>
                <p>
                  {moderationTarget.status === "COMPLETED"
                    ? "Stripe refund will be triggered for this paid booking."
                    : "No refund needed because payment was not captured."}
                </p>
              </div>
              <label className={styles.formField}>
                <span className={styles.formLabel}>Reason</span>
                <textarea
                  className={styles.formInput}
                  value={moderationReason}
                  onChange={(event) => setModerationReason(event.target.value)}
                  placeholder="Participant cannot attend / guide removed participant"
                  rows={4}
                />
              </label>
              {moderationError && <div className={styles.formError}>{moderationError}</div>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} type="button" disabled={moderationBusy} onClick={() => setModerationTarget(null)}>
                Keep booking
              </button>
              <button
                className={moderationTarget.status === "COMPLETED" ? styles.modalBtnDanger : styles.btnPrimary}
                type="button"
                disabled={moderationBusy}
                onClick={() => void confirmModeration()}
              >
                {moderationBusy ? "Removing..." : "Cancel it"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className={`${styles.modal} ${styles.confirmModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{confirmAction.title}</h2>
                <p className={styles.modalSub}>Please review before continuing.</p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setConfirmAction(null)}
              >
                <Icon.X />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div
                className={
                  confirmAction.danger
                    ? styles.confirmBoxDanger
                    : styles.confirmBox
                }
              >
                {confirmAction.message}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnGhost}
                type="button"
                onClick={() => setConfirmAction(null)}
              >
                Keep session
              </button>

              <button
                className={
                  confirmAction.danger
                    ? styles.modalBtnDanger
                    : styles.btnPrimary
                }
                type="button"
                onClick={confirmSessionAction}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.toastStack} aria-live="polite">
        {toasts.map((t) => {
          const toastClass =
            {
              success: styles.toast_success,
              warning: styles.toast_warning,
              error: styles.toast_error,
            }[t.type] ?? "";

          return (
            <div key={t.id} className={`${styles.toastItem} ${toastClass}`}>
              <span className={styles.toastIcon}>
                {t.type === "success" ? "✓" : t.type === "warning" ? "!" : "×"}
              </span>

              <span className={styles.toastText}>{t.message}</span>

              <button
                type="button"
                className={styles.toastClose}
                onClick={() => closeToast(t.id)}
              >
                <Icon.X />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
