package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.booking.Booking;
import com.untamed.untamedbackend.model.Review;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.model.UserInsight;

public interface UserInsightService {

    UserInsight getOrCreate(String userId);

    UserInsight getByUserId(String userId);

    void onBookingCreated(Booking booking);

    void onBookingConfirmed(Booking booking);

    void onBookingCompleted(Booking booking);

    void onBookingCancelled(Booking booking);

    void onReviewCreated(Review review);

    void onProfileUpdated(User user);

    UserInsight rebuildForUser(String userId);
    
    UserInsight save(UserInsight insight);
}