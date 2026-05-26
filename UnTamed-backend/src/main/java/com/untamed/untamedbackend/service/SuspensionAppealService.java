package com.untamed.untamedbackend.service;

import com.untamed.untamedbackend.dto.SuspensionAppealRequest;
import com.untamed.untamedbackend.dto.SuspensionAppealResponse;
import com.untamed.untamedbackend.model.User;
import com.untamed.untamedbackend.repository.UserRepository;
import com.untamed.untamedbackend.report.ReportResponse;
import com.untamed.untamedbackend.report.ReportService;
import com.untamed.untamedbackend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class SuspensionAppealService {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ReportService reportService;

    public SuspensionAppealResponse submitAppeal(SuspensionAppealRequest request) {
        String token = request.appealToken() == null ? "" : request.appealToken().trim();
        if (!jwtService.isValid(token, JwtService.TokenType.APPEAL)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired appeal token.");
        }

        User user = findAppealUser(token);
        if (!user.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This account is not suspended.");
        }

        ReportResponse report = reportService.createSuspensionAppeal(user, request.description());
        return new SuspensionAppealResponse(
                "Your appeal has been submitted for review.",
                report.id()
        );
    }

    private User findAppealUser(String token) {
        try {
            String userId = jwtService.extractUserId(token);
            return userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.UNAUTHORIZED,
                            "Invalid or expired appeal token."
                    ));
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired appeal token.");
        }
    }
}
