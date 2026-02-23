package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.AuthToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Optional;

public interface AuthTokenRepository extends MongoRepository<AuthToken, String> {

    Optional<AuthToken> findFirstByTokenHashAndTypeAndUsedAtIsNullAndExpiresAtAfter(
            String tokenHash,
            AuthToken.Type type,
            Instant now
    );
}
