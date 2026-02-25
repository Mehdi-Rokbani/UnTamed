package com.untamed.untamedbackend.booking;

public final class BookingErrors {
    private BookingErrors() {}

    public static final String NOT_AUTHENTICATED = "Not authenticated";
    public static final String INVALID_DELTA = "Delta must be >= 1";
    public static final String INVALID_PEOPLE = "numberOfPeople must be >= 1";

    public static final String SESSION_NOT_FOUND = "Session not found";
    public static final String SESSION_NOT_PUBLISHED = "Session not published";
    public static final String SESSION_CUTOFF = "Booking changes are blocked within 5 hours of start";
    public static final String GUIDE_CANNOT_BOOK_OWN = "Guide cannot book their own session";

    public static final String BOOKING_NOT_FOUND = "Booking not found";
    public static final String BOOKING_NOT_OWNED = "Not your booking";
    public static final String BOOKING_NOT_ACTIVE = "Booking is not active";
    public static final String SOLD_OUT = "Not enough spots left";
}