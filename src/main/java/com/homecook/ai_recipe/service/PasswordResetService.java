package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.PasswordResetToken;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.PasswordResetTokenRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.bcrypt.BCrypt;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserAccountRepository userRepo;
    private final PasswordResetTokenRepository tokenRepo;

    private final SecureRandom random = new SecureRandom();

    /** 토큰 유효기간(분) */
    @Value("${app.reset-token.ttl-minutes:30}")
    private long ttlMinutes;

    /** 토큰 재요청 최소 간격(초) - 스팸 방지 */
    @Value("${app.reset-token.min-request-interval-seconds:60}")
    private long minIntervalSeconds;

    /** 컨트롤러에서 사용 가능한 헬퍼(요청자 확인용) */
    public Optional<UserAccount> findUserByEmail(String email) {
        return userRepo.findByEmail(email);
    }

    /** 직전 요청 이후 일정 시간 지나야 재요청 허용 */
    public boolean canRequestNow(Long userId) {
        var lastOpt = tokenRepo.findTopByUserIdOrderByCreatedAtDesc(userId);
        if (lastOpt.isEmpty()) return true;
        var last = lastOpt.get();
        return Duration.between(last.getCreatedAt(), LocalDateTime.now()).getSeconds() >= minIntervalSeconds;
    }

    /** 토큰 발급 + 저장 (문자열 반환) */
    @Transactional
    public String issueToken(String email) {
        UserAccount user = userRepo.findByEmail(email).orElseThrow(() ->
                new IllegalArgumentException("해당 이메일의 사용자가 없습니다.")
        );

        if (!canRequestNow(user.getId())) {
            throw new IllegalStateException("요청이 너무 자주 이루어집니다. 잠시 후 다시 시도하세요.");
        }

        String token = genToken();
        PasswordResetToken prt = PasswordResetToken.builder()
                .userId(user.getId())
                .token(token)
                .expiresAt(LocalDateTime.now().plusMinutes(ttlMinutes))
                .used(false)
                .build();
        tokenRepo.save(prt);
        return token;
    }

    /** 토큰 사용 + 비밀번호 변경 (성공 시 사용자 반환) */
    @Transactional
    public Optional<UserAccount> consumeTokenAndReset(String token, String newPlainPassword) {
        var prtOpt = tokenRepo.findByTokenAndUsedFalse(token);
        if (prtOpt.isEmpty()) return Optional.empty();

        var prt = prtOpt.get();
        if (LocalDateTime.now().isAfter(prt.getExpiresAt())) {
            return Optional.empty(); // 만료
        }

        var userOpt = userRepo.findById(prt.getUserId());
        if (userOpt.isEmpty()) return Optional.empty();

        var user = userOpt.get();

        // 비밀번호 해시 저장
        String hash = BCrypt.hashpw(newPlainPassword, BCrypt.gensalt(12));
        user.setPasswordHash(hash);
        userRepo.save(user);

        // 토큰 사용 처리
        prt.setUsed(true);
        tokenRepo.save(prt);

        return Optional.of(user);
    }

    private String genToken() {
        byte[] buf = new byte[32];
        random.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
