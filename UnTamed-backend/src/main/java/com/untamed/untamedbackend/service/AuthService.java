package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.LoginRequest;
import com.untamed.untamedbackend.dto.LoginResponse;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository repo;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository repo, JwtService jwtService) {
        this.repo = repo;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest req) {
        User user = repo.findByEmail(req.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!user.isEnabled()) {
            throw new BadCredentialsException("Account disabled");
        }

        if (!encoder.matches(req.password(), user.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token);
    }

}
