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

    /** provider + providerId 로 기존 연결 조회 (반드시 실체 엔티티 반환: 프록시 금지) */
    @Transactional(readOnly = true)
    public Optional<UserAccount> findByProvider(String provider, String providerId) {
        return uapRepo.findByProviderAndProviderId(provider, providerId)
                .map(UserAuthProvider::getUser)
                .map(UserAccount::getId)       // 프록시 안전하게 ID만 추출
                .flatMap(userRepo::findById);  // 같은 트랜잭션에서 실체 로드
    }

    /** 보기 좋은 기본 표시명 생성 */
    private static String displayNameOrFallback(String name, String email) {
        if (name != null && !name.isBlank()) return name.trim();
        if (email != null && !email.isBlank()) {
            String local = email.trim();
            int at = local.indexOf('@');
            return (at > 0 ? local.substring(0, at) : local);
        }
        return "사용자";
    }

    /** 기존 유저에 소셜 계정만 링크(중복 안전) */
    @Transactional
    public void linkToExisting(Long userId, String provider, String providerId, String avatar, boolean emailVerifiedFromIdP) {
        if (userId == null || provider == null || providerId == null) return;

        // 이미 같은 링크가 있으면 스킵
        if (uapRepo.findByProviderAndProviderId(provider, providerId).isPresent()) return;

        // ★ 실체 로드(프록시 지양)
        UserAccount user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("user not found: " + userId));

        UserAuthProvider link = UserAuthProvider.builder()
                .user(user)
                .provider(provider)
                .providerId(providerId)
                .build();
        uapRepo.save(link);

        // 필요 시 프로필 보정
        refreshProfileIfNeeded(user, null, avatar, emailVerifiedFromIdP);
    }

    /**
     * JIT 가입/연결: provider+providerId 기준으로만 매핑
     * - 같은 이메일이어도 절대 병합하지 않음
     * - 이메일이 없어도 생성 허용
     */
    @Transactional
    public UserAccount createUserAndLink(String email,
                                         String name,
                                         String avatar,
                                         String provider,
                                         String providerId,
                                         boolean emailVerifiedFromIdP) {

        // 이미 같은 (provider, providerId)로 연결되어 있으면 그 사용자 반환(+프로필 보강)
        var mapped = uapRepo.findByProviderAndProviderId(provider, providerId)
                .map(UserAuthProvider::getUser);
        if (mapped.isPresent()) {
            var u = mapped.get();
            refreshProfileIfNeeded(u, name, avatar, emailVerifiedFromIdP);
            return u;
        }

        // 이메일 정규화(있으면 lower), 없어도 생성 가능
        String emailNorm = (email == null) ? null : email.trim().toLowerCase(Locale.ROOT);

        // 무조건 새 사용자 생성(동일 이메일이어도 새 계정)
        UserAccount u = buildNewUser(emailNorm, name, avatar, emailVerifiedFromIdP);

        try {
            userRepo.save(u);
        } catch (DataIntegrityViolationException dup) {
            // ★ DB에 email NOT NULL 또는 UNIQUE가 걸려 있을 수 있음 → null로 대체하여 재시도
            u.setEmail(null);
            userRepo.save(u);
        }

        // (provider, providerId) 링크 생성
        UserAuthProvider link = UserAuthProvider.builder()
                .user(u)
                .provider(provider)
                .providerId(providerId)
                .build();
        uapRepo.save(link);

        return u;
    }

    private UserAccount buildNewUser(String emailNorm, String name, String avatar, boolean emailVerifiedFromIdP) {
        String dummyHash = BCrypt.hashpw(
                Base64.getUrlEncoder().withoutPadding().encodeToString(rnd.generateSeed(24)),
                BCrypt.gensalt(12)
        );

        UserAccount u = new UserAccount();
        u.setEmail(emailNorm); // 중복이면 위에서 null로 재시도
        u.setName(displayNameOrFallback(name, emailNorm));
        u.setAvatar(avatar);
        u.setEmailVerified(emailVerifiedFromIdP);
        u.setPasswordHash(dummyHash);
        u.setCreatedAt(LocalDateTime.now());
        u.setUpdatedAt(LocalDateTime.now());
        return u;
    }

    /** 로그인 시 프로필 보강: 빈약하면 IdP 정보로 덮어쓰기 */
    @Transactional
    public void refreshProfileIfNeeded(UserAccount u,
                                       String idpName,
                                       String idpAvatar,
                                       boolean emailVerifiedFromIdP) {
        boolean changed = false;

        String currName = u.getName();
        boolean nameBad = (currName == null || currName.isBlank()
                || "user".equalsIgnoreCase(currName)
                || (u.getEmail() != null && currName.equalsIgnoreCase(u.getEmail()))
                || (u.getEmail() != null && currName.equalsIgnoreCase(u.getEmail().split("@")[0]))
        );
        if (nameBad && idpName != null && !idpName.isBlank()) {
            u.setName(idpName.trim());
            changed = true;
        }

        if ((u.getAvatar() == null || u.getAvatar().isBlank()) && idpAvatar != null && !idpAvatar.isBlank()) {
            u.setAvatar(idpAvatar.trim());
            changed = true;
        }

        if (emailVerifiedFromIdP && !u.isEmailVerified()) {
            u.setEmailVerified(true);
            changed = true;
        }

        if (changed) {
            u.setUpdatedAt(LocalDateTime.now());
            userRepo.save(u);
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

    /** 토큰 소비: 실제 연결 생성 (중복 안전) — 반환도 실체 엔티티로 */
    @Transactional
    public Optional<UserAccount> consumeLinkToken(String token) {
        var opt = linkRepo.findByToken(token);
        if (opt.isEmpty()) return Optional.empty();

        var t = opt.get();
        if (t.getExpiresAt().isBefore(Instant.now())) {
            linkRepo.delete(t);
            return Optional.empty();
        }

        // ★ 실체 로드
        var userOpt = userRepo.findById(t.getUserId());
        if (userOpt.isEmpty()) {
            linkRepo.delete(t);
            return Optional.empty();
        }
        var user = userOpt.get();

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

    /** 컨트롤러 등에서 안전하게 링크만 추가 (자동 병합 금지 유지) */
    @Transactional
    public void createLinkIfAbsent(String provider, String providerId, Long userId) {
        if (provider == null || providerId == null || userId == null) return;
        if (uapRepo.findByProviderAndProviderId(provider, providerId).isPresent()) return;

        // ★ 실체 로드
        var userOpt = userRepo.findById(userId);
        if (userOpt.isEmpty()) return;

        UserAuthProvider link = UserAuthProvider.builder()
                .user(userOpt.get())
                .provider(provider)
                .providerId(providerId)
                .build();
        uapRepo.save(link);
    }
}
