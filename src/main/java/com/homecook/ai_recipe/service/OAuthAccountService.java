// src/main/java/com/homecook/ai_recipe/service/OAuthAccountService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.AccountLinkToken;
import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.auth.UserAuthProvider;
import com.homecook.ai_recipe.repo.AccountLinkTokenRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.repo.UserAuthProviderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OAuthAccountService {

    private final UserAccountRepository userRepo;
    private final UserAuthProviderRepository uapRepo;
    private final AccountLinkTokenRepository linkRepo;

    private final SecureRandom rnd = new SecureRandom();

    /** provider+providerId로 바로 로그인 가능한 기존 연결 찾기 */
    @Transactional(readOnly = true)
    public Optional<UserAccount> findByProvider(String provider, String providerId) {
        return uapRepo.findByProviderAndProviderId(provider, providerId)
                .map(UserAuthProvider::getUser);
    }

    /** (필요 시) JIT 가입: 사용자 + provider 연결 생성 */
    @Transactional
    public UserAccount createUserAndLink(String email, String name, String avatar,
                                         String provider, String providerId,
                                         boolean emailVerifiedFromIdP) {
        // 1. 이메일 중복 체크
        Optional<UserAccount> existing = (email == null || email.isBlank())
                ? Optional.empty()
                : userRepo.findByEmail(email);

        if (existing.isPresent()) {
            UserAccount u = existing.get();
            // provider 연결이 이미 없으면 추가
            if (!uapRepo.existsByUserIdAndProvider(u.getId(), provider)) {
                UserAuthProvider link = UserAuthProvider.builder()
                        .user(u)
                        .provider(provider)
                        .providerId(providerId)
                        .build();
                uapRepo.save(link);
            }
            return u; // 기존 유저 반환
        }

        // 2. 없으면 새 계정 생성
        String dummyHash = BCrypt.hashpw(
                Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(rnd.generateSeed(24)),
                BCrypt.gensalt(12)
        );

        UserAccount u = new UserAccount();
        u.setEmail(email);
        u.setName((name != null && !name.isBlank()) ? name : (email != null ? email : "User"));
        u.setAvatar(avatar);
        u.setEmailVerified(emailVerifiedFromIdP);
        u.setPasswordHash(dummyHash); // null 방지용 임시 패스워드
        u.setCreatedAt(LocalDateTime.now());
        u.setUpdatedAt(LocalDateTime.now());
        userRepo.save(u);

        UserAuthProvider link = UserAuthProvider.builder()
                .user(u)
                .provider(provider)
                .providerId(providerId)
                .build();
        uapRepo.save(link);

        return u;
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

    /** 토큰 소비: 실제로 연결 생성 */
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
        // 이미 동일 provider로 연결돼 있지 않다면 생성
        if (!uapRepo.existsByUserIdAndProvider(user.getId(), t.getProvider())) {
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

    /** ★ 컨트롤러에서 호출: 없으면 링크 생성 (중복 안전) */
    @Transactional
    public void createLinkIfAbsent(String provider, String providerId, Long userId) {
        if (provider == null || providerId == null || userId == null) return;

        // 동일 provider로 이미 연결돼 있으면 스킵
        if (uapRepo.existsByUserIdAndProvider(userId, provider)) return;

        // provider+providerId 쌍으로도 이미 존재하면 스킵
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
