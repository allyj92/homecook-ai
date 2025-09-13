package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.*;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CustomOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final OidcUserService delegate = new OidcUserService();
    private final OAuthAccountService oauthService;

    @Override
    public OidcUser loadUser(OidcUserRequest req) throws OAuth2AuthenticationException {
        // 1) 기본 OIDC 사용자 불러오기
        OidcUser base = delegate.loadUser(req);

        // 2) 공급자/식별자 정규화
        String provider = req.getClientRegistration().getRegistrationId(); // "google"
        String pid = base.getSubject();                                    // sub

        // 3) claims 보강
        Map<String, Object> claims = new HashMap<>(base.getClaims());
        claims.put("provider", provider);
        claims.put("id", pid); // 컨트롤러 공통키

        String email = base.getEmail();
        String name  = base.getFullName();
        if (name == null) name = (String) claims.getOrDefault("name", null);
        String avatar = (String) claims.getOrDefault("picture", null);
        boolean emailVerified = Boolean.TRUE.equals(claims.get("email_verified"));

        // 4) 기존 링크 확인 → 없으면 이메일 기반으로 유저 생성+링크
        var linked = oauthService.findByProvider(provider, pid);
        com.homecook.ai_recipe.auth.UserAccount ua;
        if (linked.isPresent()) {
            ua = linked.get();
        } else {
            if (email == null || email.isBlank()) {
                // 구글에선 거의 안 생기지만, 정책상 이메일 없으면 거절
                throw new OAuth2AuthenticationException("unauthenticated_no_email");
            }
            ua = oauthService.createUserAndLink(email, name, avatar, provider, pid, emailVerified);
        }

        // 5) uid 주입 (컨트롤러에서 빠른 식별에 사용)
        claims.put("uid", ua.getId());

        // 6) 기존 토큰/권한 유지하며 claims만 커스텀
        final String nameKey = "sub";
        return new DefaultOidcUser(base.getAuthorities(), base.getIdToken(), base.getUserInfo(), nameKey) {
            @Override public Map<String, Object> getClaims() { return claims; }
            @SuppressWarnings("unchecked")
            @Override public <A> A getAttribute(String name) { return (A) claims.get(name); }
        };
    }
}
