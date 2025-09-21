// src/main/java/com/homecook/ai_recipe/service/OAuthAccountService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.AccountLinkToken;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.auth.UserAuthProvider;
import com.homecook.ai_recipe.repo.AccountLinkTokenRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.repo.UserAuthProviderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OAuthAccountService {

    private final UserAccountRepository userRepo;
    private final UserAuthProviderRepository uapRepo;
    private final AccountLinkTokenRepository linkRepo;

    private final SecureRandom rnd = new SecureRandom();

    /** provider + providerId 로 기존 연결 조회 */
    @Transactional(readOnly = true)
    public Optional<UserAccount> findByProvider(String provider, String providerId) {
        return uapRepo.findByProviderAndProviderId(provider, providerId)
                .map(UserAuthProvider::getUser);
    }

    /** 기존 유저에 소셜 계정만 링크(중복 안전) */
    @Transactional
    public void linkToExisting(Long userId, String provider, String providerId, String avatar, boolean emailVerifiedFromIdP) {
        if (userId == null || provider == null || providerId == null) return;

        // 이미 같은 링크가 있으면 스킵
        if (uapRepo.findByProviderAndProviderId(provider, providerId).isPresent()) return;

        // 유저 존재 확인
        userRepo.findById(userId).orElseThrow(() -> new IllegalArgumentException("user not found: " + userId));

        // 링크 생성
        // 링크 생성
        UserAccount proxy = new UserAccount();
        proxy.setId(userId); // 프록시로 id만 세팅

        UserAuthProvider link = UserAuthProvider.builder()
                .user(proxy)
                .provider(provider)
                .providerId(providerId)
                .build();

        uapRepo.save(link);

        // 필요 시 유저 필드 보정 (예: provider 쪽에서 이메일 인증했다면 email_verified 올리기, avatar 업데이트 등)
        // Optional: userRepo.findById(userId).ifPresent(u -> { ... });
    }

    /**
     * JIT 가입/연결: 이메일이 있으면 기존 유저 재사용 + 링크만 추가.
     * 없을 때에만 새 사용자 생성.
     */
    @Transactional
    public UserAccount createUserAndLink(String email,
                                         String name,
                                         String avatar,
                                         String provider,
                                         String providerId,
                                         boolean emailVerifiedFromIdP) {

        // 0) 이미 같은 (provider, providerId)로 연결되어 있으면 그 사용자 반환
        var mapped = uapRepo.findByProviderAndProviderId(provider, providerId)
                .map(UserAuthProvider::getUser);
        if (mapped.isPresent()) return mapped.get();

        // 1) 이메일 정규화
        String emailNorm = (email == null) ? null : email.trim().toLowerCase(Locale.ROOT);
        if (emailNorm == null || emailNorm.isBlank()) {
            throw new IllegalArgumentException("Email required to create user");
        }

        // 2) 이메일로 기존 유저 찾기 → 있으면 링크만 추가
        var existing = userRepo.findByEmailIgnoreCase(emailNorm);
        if (existing.isPresent()) {
            var user = existing.get();
            linkToExisting(user.getId(), provider, providerId, avatar, emailVerifiedFromIdP);
            return user;
        }

        // 3) 없을 때만 새 사용자 생성 (경합 대비 try-catch)
        try {
            String dummyHash = BCrypt.hashpw(
                    Base64.getUrlEncoder().withoutPadding()
                            .encodeToString(rnd.generateSeed(24)),
                    BCrypt.gensalt(12)
            );

            UserAccount u = new UserAccount();
            u.setEmail(emailNorm);
            u.setName((name != null && !name.isBlank()) ? name.trim() : emailNorm);
            u.setAvatar(avatar);
            u.setEmailVerified(emailVerifiedFromIdP);
            u.setPasswordHash(dummyHash);
            // createdAt/updatedAt은 @PrePersist/@PreUpdate에서 처리됨
            userRepo.save(u);

            // 4) (provider, providerId) 연결 생성
            UserAuthProvider link = UserAuthProvider.builder()
                    .user(u)
                    .provider(provider)
                    .providerId(providerId)
                    .build();
            uapRepo.save(link);

            return u;
        } catch (DataIntegrityViolationException e) {
            // 동시성: 누군가 먼저 같은 이메일로 생성했을 수 있으니 재조회 후 링크
            var user = userRepo.findByEmailIgnoreCase(emailNorm)
                    .orElseThrow(() -> e);
            linkToExisting(user.getId(), provider, providerId, avatar, emailVerifiedFromIdP);
            return user;
        }
    }

    /** 기존 로컬계정과 소셜을 묶기 위한 1회용 토큰 발급 */
    @Transactional
    public String issueLinkToken(Long userId, String provider, String providerId) {
        byte[] buf = new byte[32];
        rnd.nextBytes(buf);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);

        AccountLinkToken t = AccountLinkToken.builder()
                .userId(userId)
                .provider(provider)
                .providerId(providerId)
                .token(token)
                .expiresAt(Instant.now().plusSeconds(60 * 30))
                .build();
        linkRepo.save(t);
        return token;
    }

    /** 토큰 소비: 실제 연결 생성 (중복 안전) */
    @Transactional
    public Optional<UserAccount> consumeLinkToken(String token) {
        var opt = linkRepo.findByToken(token);
        if (opt.isEmpty()) return Optional.empty();

        var t = opt.get();
        if (t.getExpiresAt().isBefore(Instant.now())) {
            linkRepo.delete(t);
            return Optional.empty();
        }
        var user = userRepo.findById(t.getUserId()).orElse(null);
        if (user == null) {
            linkRepo.delete(t);
            return Optional.empty();
        }
        if (uapRepo.findByProviderAndProviderId(t.getProvider(), t.getProviderId()).isEmpty()) {
            UserAuthProvider link = UserAuthProvider.builder()
                    .user(user)
                    .provider(t.getProvider())
                    .providerId(t.getProviderId())
                    .build();
            uapRepo.save(link);
        }
        linkRepo.delete(t);
        return Optional.of(user);
    }

    /** 컨트롤러 등에서 안전하게 링크만 추가하고 싶을 때 */
    @Transactional
    public void createLinkIfAbsent(String provider, String providerId, Long userId) {
        if (provider == null || providerId == null || userId == null) return;
        if (uapRepo.findByProviderAndProviderId(provider, providerId).isPresent()) return;

        var user = userRepo.findById(userId).orElse(null);
        if (user == null) return;

        UserAuthProvider link = UserAuthProvider.builder()
                .user(user)
                .provider(provider)
                .providerId(providerId)
                .build();
        uapRepo.save(link);
    }
}
