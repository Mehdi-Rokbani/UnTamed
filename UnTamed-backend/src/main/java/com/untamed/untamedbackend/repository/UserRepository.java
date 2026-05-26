package com.untamed.untamedbackend.repository;

import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findById(String id);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    long countByRole(Role role);
    long countByRoleAndVerifiedFalse(Role role);
    long countByRoleAndSuspendedTrue(Role role);
    List<User> findAllByOrderByCreatedAtDesc();
    List<User> findByRoleOrderByCreatedAtDesc(Role role);
}
