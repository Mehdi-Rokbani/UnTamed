package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.booking.BookingRepository;
import com.untamed.untamedbackend.booking.BookingStatus;
import com.untamed.untamedbackend.guestpass.AttendanceStatus;
import com.untamed.untamedbackend.guestpass.GuestPass;
import com.untamed.untamedbackend.guestpass.GuestPassRepository;
import com.untamed.untamedbackend.guestpass.GuestPassStatus;
import com.untamed.untamedbackend.guidereview.GuideReviewRepository;
import com.untamed.untamedbackend.model.ActivitySession;
import com.untamed.untamedbackend.model.ActivityTemplate;
import com.untamed.untamedbackend.model.Level;
import com.untamed.untamedbackend.model.ReviewStatus;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.ActivitySessionRepository;
import com.untamed.untamedbackend.repository.ActivityTemplateRepository;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LevelingService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityTemplateRepository activityTemplateRepository;
    private final ReviewRepository reviewRepository;
    private final GuideReviewRepository guideReviewRepository;
    private final GuestPassRepository guestPassRepository;


    private static final int XP_COMPLETED_BOOKING = 30;
    private static final int XP_ATTENDANCE_PRESENT = 100;
    private static final int XP_ACTIVITY_REVIEW = 25;
    private static final int XP_GUIDE_REVIEW = 25;
    private static final int XP_FIRST_ATTENDED_CATEGORY = 40;

    public User recalculateUserLevel(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        int xp = calculateXp(userId);

        LevelSnapshot snapshot = resolveLevel(xp);

        user.setXp(xp);
        user.setLevel(snapshot.level());
        user.setLevelNumber(snapshot.levelNumber());
        user.setLevelTitle(snapshot.levelTitle());
        user.setXpToNextLevel(snapshot.xpToNextLevel());
        user.setLevelProgressPercent(snapshot.progressPercent());

        return userRepository.save(user);
    }

    public int calculateXp(String userId) {
        int xp = 0;

        List<Booking> completedBookings = bookingRepository.findByUserIdAndStatus(
                userId,
                BookingStatus.COMPLETED
        );

        // Small XP for completed/paid bookings
        xp += completedBookings.size() * XP_COMPLETED_BOOKING;

        // Main adventure XP only when attendance is PRESENT
        xp += calculateAttendancePresentBonus(completedBookings);

        // Category discovery XP only from attended activities
        xp += calculateFirstAttendedCategoryBonus(completedBookings);

        // Review XP
        long activityReviewsCount = reviewRepository.countByReviewerIdAndStatus(userId, ReviewStatus.VISIBLE);
        xp += (int) activityReviewsCount * XP_ACTIVITY_REVIEW;

        long guideReviewsCount = guideReviewRepository.countByReviewerIdAndStatus(userId, ReviewStatus.VISIBLE);
        xp += (int) guideReviewsCount * XP_GUIDE_REVIEW;

        return xp;
    }

    private int calculateFirstAttendedCategoryBonus(List<Booking> completedBookings) {
        if (completedBookings == null || completedBookings.isEmpty()) {
            return 0;
        }

        Set<String> bookingIds = completedBookings.stream()
                .map(Booking::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (bookingIds.isEmpty()) {
            return 0;
        }

        List<GuestPass> presentPasses = guestPassRepository.findByBookingIdInAndStatusAndAttendanceStatus(
                bookingIds,
                GuestPassStatus.ACTIVE,
                AttendanceStatus.PRESENT
        );

        Set<String> attendedSessionIds = presentPasses.stream()
                .map(GuestPass::getSessionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (attendedSessionIds.isEmpty()) {
            return 0;
        }

        List<ActivitySession> sessions = activitySessionRepository.findAllById(attendedSessionIds);

        Set<String> templateIds = sessions.stream()
                .map(ActivitySession::getTemplateId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (templateIds.isEmpty()) {
            return 0;
        }

        List<ActivityTemplate> templates = activityTemplateRepository.findAllById(templateIds);

        Set<String> uniqueCategoryIds = new HashSet<>();

        for (ActivityTemplate template : templates) {
            if (template.getCategoryIds() != null) {
                uniqueCategoryIds.addAll(template.getCategoryIds());
            }
        }

        return uniqueCategoryIds.size() * XP_FIRST_ATTENDED_CATEGORY;
    }

    private int calculateAttendancePresentBonus(List<Booking> completedBookings) {
        if (completedBookings == null || completedBookings.isEmpty()) {
            return 0;
        }

        Set<String> bookingIds = completedBookings.stream()
                .map(Booking::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (bookingIds.isEmpty()) {
            return 0;
        }

        List<GuestPass> presentPasses = guestPassRepository.findByBookingIdInAndStatusAndAttendanceStatus(
                bookingIds,
                GuestPassStatus.ACTIVE,
                AttendanceStatus.PRESENT
        );

        long attendedBookings = presentPasses.stream()
                .map(GuestPass::getBookingId)
                .filter(Objects::nonNull)
                .distinct()
                .count();

        return (int) attendedBookings * XP_ATTENDANCE_PRESENT;
    }

    public LevelSnapshot resolveLevel(int xp) {
        if (xp >= 12000) {
            return snapshot(xp, 10, "Untamed Legend", Level.LEGEND, 12000, -1);
        }
        if (xp >= 8500) {
            return snapshot(xp, 9, "Wilderness Expert", Level.EXPERT, 8500, 12000);
        }
        if (xp >= 6000) {
            return snapshot(xp, 8, "Trail Master", Level.EXPERT, 6000, 8500);
        }
        if (xp >= 4200) {
            return snapshot(xp, 7, "Expedition Leader", Level.ADVANCED, 4200, 6000);
        }
        if (xp >= 2800) {
            return snapshot(xp, 6, "Pathfinder", Level.ADVANCED, 2800, 4200);
        }
        if (xp >= 1800) {
            return snapshot(xp, 5, "Route Finder", Level.INTERMEDIATE, 1800, 2800);
        }
        if (xp >= 1000) {
            return snapshot(xp, 4, "Wild Explorer", Level.INTERMEDIATE, 1000, 1800);
        }
        if (xp >= 500) {
            return snapshot(xp, 3, "Weekend Explorer", Level.AMATEUR, 500, 1000);
        }
        if (xp >= 200) {
            return snapshot(xp, 2, "Trail Starter", Level.AMATEUR, 200, 500);
        }

        return snapshot(xp, 1, "Campfire Rookie", Level.BEGINNER, 0, 200);
    }

    private LevelSnapshot snapshot(
            int xp,
            int levelNumber,
            String levelTitle,
            Level level,
            int currentThreshold,
            int nextThreshold
    ) {
        if (nextThreshold <= 0) {
            return new LevelSnapshot(
                    levelNumber,
                    levelTitle,
                    level,
                    0,
                    100
            );
        }

        int xpIntoLevel = Math.max(0, xp - currentThreshold);
        int xpNeededForLevel = nextThreshold - currentThreshold;
        int xpToNext = Math.max(0, nextThreshold - xp);

        int progress = xpNeededForLevel <= 0
                ? 100
                : Math.min(100, (int) Math.round((xpIntoLevel * 100.0) / xpNeededForLevel));

        return new LevelSnapshot(
                levelNumber,
                levelTitle,
                level,
                xpToNext,
                progress
        );
    }

    public record LevelSnapshot(
            int levelNumber,
            String levelTitle,
            Level level,
            int xpToNextLevel,
            int progressPercent
    ) {}
}
