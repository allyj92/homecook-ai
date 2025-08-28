package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.PasswordResetToken;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.PasswordResetTokenRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private final UserAccountRepository userRepo;
    private final PasswordResetTokenRepository tokenRepo;
    private final SecureRandom random = new SecureRandom();

    // 이메일별 요청 타임스탬프 (간단 레이트리밋)
    private final Map<String, Instant> lastRequestAt = new ConcurrentHashMap<>();

    public Optional<UserAccount> findUserByEmail(String email) {
        return userRepo.findByEmail(email);
    }

    /** 과거 토큰 무효화 후 새 토큰 발급 */
    public String createTokenFor(UserAccount u) {
        // 이전 토큰들 사용 처리
        tokenRepo.findAll().stream()
                .filter(t -> Objects.equals(t.getUserId(), u.getId()))
                .filter(t -> t.getUsedAt() == null)
                .forEach(t -> { t.setUsedAt(Instant.now()); tokenRepo.save(t); });

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

    /** 2분 이내 중복요청 방지; true면 허용 */
    public boolean canRequestNow(String email) {
        Instant now = Instant.now();
        Instant prev = lastRequestAt.get(email.toLowerCase());
        if (prev != null && prev.plus(2, ChronoUnit.MINUTES).isAfter(now)) return false;
        lastRequestAt.put(email.toLowerCase(), now);
        return true;
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
