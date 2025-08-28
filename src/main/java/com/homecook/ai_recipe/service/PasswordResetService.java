// src/main/java/com/homecook/ai_recipe/service/PasswordResetService.java
package com.homecook.ai_recipe.service;


import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.PasswordResetToken;
import com.homecook.ai_recipe.repo.PasswordResetTokenRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private final UserAccountRepository userRepo;
    private final PasswordResetTokenRepository tokenRepo;
    private final SecureRandom random = new SecureRandom();

    public Optional<UserAccount> findUserByEmail(String email) {
        return userRepo.findByEmail(email);
    }

    public String createTokenFor(UserAccount u) {
        byte[] buf = new byte[32];
        random.nextBytes(buf);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);

        PasswordResetToken t = new PasswordResetToken();
        t.setUserId(u.getId());
        t.setToken(token);
        t.setExpiresAt(Instant.now().plus(30, ChronoUnit.MINUTES));
        tokenRepo.save(t);
        return token;
    }

    public Optional<UserAccount> consumeTokenAndReset(String token, String newPwHash) {
        return tokenRepo.findByToken(token)
                .filter(t -> t.getUsedAt() == null)
                .filter(t -> t.getExpiresAt() != null && t.getExpiresAt().isAfter(Instant.now()))
                .flatMap(t -> userRepo.findById(t.getUserId()).map(u -> {
                    u.setPasswordHash(newPwHash);
                    userRepo.save(u);
                    t.setUsedAt(Instant.now());
                    tokenRepo.save(t);
                    return u;
                }));
    }
}
