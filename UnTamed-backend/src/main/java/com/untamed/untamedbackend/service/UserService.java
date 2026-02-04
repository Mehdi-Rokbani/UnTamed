package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.RegisterRequest;
import com.untamed.untamedbackend.dto.UserResponse;
import com.untamed.untamedbackend.model.Role;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository repo;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public UserService(UserRepository repo) {
        this.repo = repo;
    }

    public UserResponse register(RegisterRequest req) {
        if (repo.existsByEmail(req.email())) {
            throw new IllegalArgumentException("Email already used");
        }

        User user = User.builder()
                .email(req.email())
                .password(encoder.encode(req.password()))
                .role(req.role())
                .enabled(true)
                .build();

        User saved = repo.save(user);

        return new UserResponse(saved.getId(), saved.getEmail(), saved.getRole().name());
    }
}
