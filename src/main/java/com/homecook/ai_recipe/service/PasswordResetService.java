package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.PasswordResetToken;
import com.homecook.ai_recipe.repo.PasswordResetTokenRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;


import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final PasswordResetTokenRepository tokenRepo;
    private final SecureRandom random = new SecureRandom();
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private final UserAccountRepository userRepo;

    /** 토큰 발급 (기본 TTL 30분) */
    public String issueToken(Long userId) {
        return issueToken(userId, Duration.ofMinutes(30));
    }

    public String issueToken(Long userId, Duration ttl) {
        byte[] buf = new byte[32]; // 256-bit
        random.nextBytes(buf);
        String token = URL_ENCODER.encodeToString(buf);

        Instant now = Instant.now();
        PasswordResetToken prt = PasswordResetToken.builder()
                .userId(userId)
                .token(token)
                .createdAt(now)
                .expiresAt(now.plus(ttl))
                .used(false)
                .build();
        tokenRepo.save(prt);
        return token;
    }

    /** 토큰 1회용 소비: 유효하면 사용 처리 후 userId 반환, 아니면 null */
    public Long consumeToken(String token) {
        var opt = tokenRepo.findByTokenAndUsedFalse(token);
        if (opt.isEmpty()) return null;

        var prt = opt.get();
        if (prt.getExpiresAt().isBefore(Instant.now())) {
            // 만료된 건 정리만 하고 실패 처리
            tokenRepo.delete(prt);
            return null;
        }
        prt.setUsed(true);
        tokenRepo.save(prt);
        return prt.getUserId();
    }
    public boolean consumeTokenAndReset(String token, String newPassword) {
        Long userId = consumeToken(token);
        if (userId == null) return false;

        var userOpt = userRepo.findById(userId);
        if (userOpt.isEmpty()) return false;

        var u = userOpt.get();
        String hash = BCrypt.hashpw(newPassword, BCrypt.gensalt(12));
        u.setPasswordHash(hash);
        userRepo.save(u);
        return true;
    }



    /** 청소(선택): 만료분 삭제 */
    public long cleanupExpired() {
        return tokenRepo.deleteByExpiresAtBefore(Instant.now());
    }
}
