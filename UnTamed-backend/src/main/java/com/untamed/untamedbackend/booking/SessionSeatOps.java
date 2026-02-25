package com.untamed.untamedbackend.booking;

import com.untamed.untamedbackend.model.ActivitySession;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
public class SessionSeatOps {

    private final MongoTemplate mongoTemplate;

    public ActivitySession getSessionOrThrow(String sessionId) {
        ActivitySession s = mongoTemplate.findById(sessionId, ActivitySession.class);
        if (s == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, BookingErrors.SESSION_NOT_FOUND);
        return s;
    }

    /** Atomic reserve: only succeeds if bookedCount + delta <= capacity */
    public boolean tryReserveSeats(String sessionId, int delta) {
        Query q = new Query(Criteria.where("_id").is(sessionId)
                .and("bookedCount").lte(capacityMinus(delta))); // placeholder, will override below
        // We can’t reference capacityMinus(delta) because capacity is in-doc.
        // Use $expr via raw Document in Query: easiest is to build with BasicQuery.
        // But to keep compatibility, we do a two-step atomic check using a FindAndModify with $expr via MongoTemplate's BasicQuery.

        // Build MongoDB query:
        // { _id: sessionId, $expr: { $lte: [ { $add: ["$bookedCount", delta] }, "$capacity" ] } }
        org.bson.Document filter = new org.bson.Document("_id", sessionId)
                .append("$expr", new org.bson.Document("$lte",
                        java.util.List.of(
                                new org.bson.Document("$add", java.util.List.of("$bookedCount", delta)),
                                "$capacity"
                        )
                ));

        org.springframework.data.mongodb.core.query.BasicQuery basicQuery =
                new org.springframework.data.mongodb.core.query.BasicQuery(filter);

        Update u = new Update().inc("bookedCount", delta);

        ActivitySession updated = mongoTemplate.findAndModify(
                basicQuery,
                u,
                FindAndModifyOptions.options().returnNew(true),
                ActivitySession.class
        );

        return updated != null;
    }

    /** Release seats (safe) */
    public void releaseSeats(String sessionId, int delta) {
        if (delta <= 0) return;

        Query q = new Query(Criteria.where("_id").is(sessionId)
                .and("bookedCount").gte(delta));

        Update u = new Update().inc("bookedCount", -delta);

        ActivitySession updated = mongoTemplate.findAndModify(
                q,
                u,
                FindAndModifyOptions.options().returnNew(true),
                ActivitySession.class
        );

        // If null: bookedCount was smaller than delta (data inconsistency). We still fail loudly.
        if (updated == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot release seats (bookedCount too low)");
        }
    }

    // not used (kept for compilation clarity)
    private int capacityMinus(int delta) { return Integer.MAX_VALUE; }
}