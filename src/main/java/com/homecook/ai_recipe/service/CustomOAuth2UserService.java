// src/main/java/com/homecook/ai_recipe/auth/CustomOAuth2UserService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.OAuthAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserAccountRepository userRepo;
    private final OAuthAccountService oauthService;

    @SuppressWarnings("unchecked")
    private static String firstNonNullStr(Object a, Object b) {
        if (a != null) return String.valueOf(a);
        if (b != null) return String.valueOf(b);
        return null;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        OAuth2User u = super.loadUser(req);

        String provider = req.getClientRegistration().getRegistrationId(); // google/naver/kakao
        Map<String, Object> a = new HashMap<>(u.getAttributes());
        a.put("provider", provider);

        // 공급자별 표준화
        String pid = null;
        if ("google".equals(provider)) {
            pid = String.valueOf(a.get("sub"));
        } else if ("naver".equals(provider)) {
            Object resp = a.get("response");
            if (resp instanceof Map r) a.putAll(r);
            pid = String.valueOf(a.get("id"));
        } else if ("kakao".equals(provider)) {
            pid = String.valueOf(a.get("id"));
            Object ka = a.get("kakao_account");
            if (ka instanceof Map acc) {
                a.putIfAbsent("email", acc.get("email"));
                Object profile = acc.get("profile");
                if (profile instanceof Map p) a.putIfAbsent("name", p.get("nickname"));
            }
        }
        a.put("id", pid);

        String email  = firstNonNullStr(a.get("email"), u.getAttribute("email"));
        String name   = firstNonNullStr(a.get("name"),  u.getAttribute("name"));
        String avatar = firstNonNullStr(a.get("picture"), u.getAttribute("picture"));
        boolean emailVerified =
                Boolean.TRUE.equals(a.get("email_verified")) ||
                        Boolean.TRUE.equals(u.getAttribute("email_verified"));

        // 1) provider+pid 로 기존 연결 시도
        var linked = oauthService.findByProvider(provider, pid);
        UserAccount user;
        if (linked.isPresent()) {
            user = linked.get();
        } else {
            // 2) 연결 없으면 email 기반으로 유저 생성/링크 생성
            if (email == null || String.valueOf(email).isBlank()) {
                // 이메일이 없으면 정책상 거절 (필요 시 dummy 이메일 전략 추가 가능)
                throw new OAuth2AuthenticationException("unauthenticated_no_email");
            }
            user = oauthService.createUserAndLink(String.valueOf(email),
                    name == null ? null : String.valueOf(name),
                    avatar == null ? null : String.valueOf(avatar),
                    provider, pid, emailVerified);
        }

        a.put("uid", user.getId());

        Set<GrantedAuthority> auths = new HashSet<>(u.getAuthorities());
        auths.add(new SimpleGrantedAuthority("ROLE_USER"));

        String nameKey = a.containsKey("sub") ? "sub" : "id";
        return new DefaultOAuth2User(auths, a, nameKey);
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... vals) {
        for (T v : vals) if (v != null) return v;
        return null;
    }
}
