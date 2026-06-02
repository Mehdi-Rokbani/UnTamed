package com.untamed.untamedbackend.admin;

import com.untamed.untamedbackend.dto.PaginatedResponse;
import com.untamed.untamedbackend.revenue.AdminRevenueSummaryResponse;
import com.untamed.untamedbackend.revenue.PayoutBatchResponse;
import com.untamed.untamedbackend.revenue.RevenueRecordResponse;
import com.untamed.untamedbackend.revenue.RevenueService;
import com.untamed.untamedbackend.revenue.RunWeeklyPayoutsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final AdminAuditLogService adminAuditLogService;
    private final AdminReportService adminReportService;
    private final RevenueService revenueService;

    public AdminController(
            AdminService adminService,
            AdminAuditLogService adminAuditLogService,
            AdminReportService adminReportService,
            RevenueService revenueService
    ) {
        this.adminService = adminService;
        this.adminAuditLogService = adminAuditLogService;
        this.adminReportService = adminReportService;
        this.revenueService = revenueService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
                "status", "OK",
                "message", "Admin access granted"
        );
    }

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        return adminService.getStats();
    }

    @GetMapping("/overview")
    public AdminOverviewResponse overview() {
        return adminService.getOverview();
    }

    @GetMapping("/revenue/summary")
    public AdminRevenueSummaryResponse revenueSummary() {
        return revenueService.getAdminRevenueSummary();
    }

    @GetMapping("/revenue/records")
    public List<RevenueRecordResponse> revenueRecords() {
        return revenueService.getAdminRevenueRecords();
    }

    @GetMapping("/payouts")
    public List<PayoutBatchResponse> payoutBatches() {
        return revenueService.getAdminPayoutBatches();
    }

    @PostMapping("/payouts/{batchId}/mark-paid")
    public PayoutBatchResponse markPayoutPaid(@PathVariable String batchId) {
        return revenueService.markPayoutBatchPaid(batchId);
    }

    @PostMapping("/payouts/run-weekly")
    public RunWeeklyPayoutsResponse runWeeklyPayouts() {
        List<PayoutBatchResponse> created = revenueService.createWeeklyPayoutBatches();
        int scheduledRecords = created.stream()
                .mapToInt(PayoutBatchResponse::totalBookings)
                .sum();
        return new RunWeeklyPayoutsResponse(
                created.size(),
                scheduledRecords,
                created
        );
    }

    @GetMapping("/alerts")
    public PaginatedResponse<AdminAlertResponse> alerts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status
    ) {
        return adminService.getAlertsPage(page, size, query, type, severity, status);
    }

    @PatchMapping("/alerts/{id}/acknowledge")
    public AdminAlertResponse acknowledgeAlert(@PathVariable String id, Authentication authentication) {
        return adminService.acknowledgeAlert(id, authentication);
    }

    @PatchMapping("/alerts/{id}/resolve")
    public AdminAlertResponse resolveAlert(@PathVariable String id, Authentication authentication) {
        return adminService.resolveAlert(id, authentication);
    }

    @PatchMapping("/alerts/{id}/reopen")
    public AdminAlertResponse reopenAlert(@PathVariable String id, Authentication authentication) {
        return adminService.reopenAlert(id, authentication);
    }

    @GetMapping("/reports")
    public PaginatedResponse<AdminReportResponse> reports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String sort
    ) {
        return adminReportService.listReports(page, size, status, targetType, reason, sort);
    }

    @GetMapping("/reports/{reportId}")
    public AdminReportResponse report(@PathVariable String reportId) {
        return adminReportService.getReport(reportId);
    }

    @PatchMapping("/reports/{reportId}/resolve")
    public AdminReportResponse resolveReport(
            @PathVariable String reportId,
            @Valid @RequestBody(required = false) ReviewReportRequest request,
            Authentication authentication
    ) {
        return adminReportService.resolveReport(reportId, request, authentication);
    }

    @PatchMapping("/reports/{reportId}/reject")
    public AdminReportResponse rejectReport(
            @PathVariable String reportId,
            @Valid @RequestBody(required = false) ReviewReportRequest request,
            Authentication authentication
    ) {
        return adminReportService.rejectReport(reportId, request, authentication);
    }

    @GetMapping("/users")
    public PaginatedResponse<AdminUserResponse> users(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        return adminService.getUsersPage(page, size, query, role, status);
    }

    @PatchMapping("/users/{id}/suspend")
    public AdminUserResponse suspendUser(@PathVariable String id, Authentication authentication) {
        return adminService.suspendUser(id, authentication);
    }

    @PatchMapping("/users/{id}/reactivate")
    public AdminUserResponse reactivateUser(@PathVariable String id, Authentication authentication) {
        return adminService.reactivateUser(id, authentication);
    }

    @GetMapping("/guides")
    public PaginatedResponse<AdminGuideResponse> guides(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status
    ) {
        return adminService.getGuidesPage(page, size, query, status);
    }

    @GetMapping("/guides/{id}/suspension-impact")
    public AdminGuideSuspensionImpactResponse guideSuspensionImpact(@PathVariable String id) {
        return adminService.getGuideSuspensionImpact(id);
    }

    @GetMapping("/sessions")
    public PaginatedResponse<AdminSessionResponse> sessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status
    ) {
        return adminService.getSessionsPage(page, size, query, status);
    }

    @GetMapping("/activities")
    public PaginatedResponse<AdminActivityResponse> activities(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category
    ) {
        return adminService.getActivitiesPage(page, size, query, status, category);
    }

    @PatchMapping("/activities/{id}/disable")
    public AdminActivityResponse disableActivity(
            @PathVariable String id,
            @Valid @RequestBody(required = false) AdminActivityModerationRequest request,
            Authentication authentication
    ) {
        return adminService.disableActivity(id, request, authentication);
    }

    @PatchMapping("/activities/{id}/republish")
    public AdminActivityResponse republishActivity(
            @PathVariable String id,
            @Valid @RequestBody(required = false) AdminActivityModerationRequest request,
            Authentication authentication
    ) {
        return adminService.republishActivity(id, request, authentication);
    }

    @GetMapping("/refunds/pending")
    public List<AdminRefundItemResponse> pendingRefunds() {
        return adminService.getPendingRefunds();
    }

    @GetMapping("/refunds")
    public List<AdminRefundItemResponse> refunds() {
        return adminService.getRefunds();
    }

    @GetMapping("/audit-logs")
    public PaginatedResponse<AdminAuditLogResponse> auditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String adminId,
            @RequestParam(required = false) String targetId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate
    ) {
        return adminAuditLogService.listLogsPage(page, size, query, action, targetType, adminId, targetId, fromDate, toDate);
    }

    @PostMapping("/refunds/{bookingId}/process")
    public AdminRefundItemResponse processRefund(
            @PathVariable String bookingId,
            @RequestBody(required = false) AdminProcessRefundRequest request,
            Authentication authentication
    ) {
        return adminService.processRefund(bookingId, request, authentication);
    }

    @PatchMapping("/sessions/{sessionId}/cancel")
    public AdminCancelSessionResponse cancelSession(
            @PathVariable String sessionId,
            @Valid @RequestBody(required = false) AdminCancelSessionRequest request,
            Authentication authentication
    ) {
        return adminService.cancelSession(sessionId, request, authentication);
    }

    @PatchMapping("/guides/{id}/verify")
    public AdminGuideResponse verifyGuide(
            @PathVariable String id,
            @Valid @RequestBody(required = false) AdminGuideVerifyRequest request,
            Authentication authentication
    ) {
        return adminService.verifyGuide(id, request, authentication);
    }

    @PatchMapping("/guides/{id}/suspend")
    public AdminGuideResponse suspendGuide(
            @PathVariable String id,
            @Valid @RequestBody(required = false) AdminGuideSuspendRequest request,
            Authentication authentication
    ) {
        return adminService.suspendGuide(id, request, authentication);
    }

    @PatchMapping("/guides/{id}/reactivate")
    public AdminGuideResponse reactivateGuide(
            @PathVariable String id,
            @RequestBody(required = false) AdminGuideReactivateRequest request,
            Authentication authentication
    ) {
        return adminService.reactivateGuide(id, request, authentication);
    }
}
