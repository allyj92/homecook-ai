// src/main/java/com/homecook/ai_recipe/service/CustomOAuth2UserService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final OAuthAccountService oauthService;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        OAuth2User raw = super.loadUser(req);

        final String provider = req.getClientRegistration().getRegistrationId(); // google/naver/kakao
        Map<String, Object> attrs = new LinkedHashMap<>(raw.getAttributes());
        attrs.put("provider", provider);

        // 1) 공급자별 표준화 + pid 추출
        String pid = normalizeAttributes(provider, attrs);
        attrs.put("id", pid); // 공통 키로 고정

        // 표준 키 확보(없으면 최대한 보완)
        String email   = firstNonBlank(str(attrs.get("email")),   str(raw.getAttribute("email")));
        String name    = firstNonBlank(str(attrs.get("name")),    str(raw.getAttribute("name")));
        String picture = firstNonBlank(str(attrs.get("picture")), str(raw.getAttribute("picture")));
        boolean emailVerified =
                Boolean.TRUE.equals(attrs.get("email_verified")) ||
                        Boolean.TRUE.equals(raw.getAttribute("email_verified"));

        // 2) provider+pid 로만 연결(이메일 병합 금지)
        var linked = oauthService.findByProvider(provider, pid);
        UserAccount user;
        if (linked.isPresent()) {
            user = linked.get();
        } else {
            // 일부 공급자는 email 미제공 가능 → 정책상 이메일 필수면 여기서 에러
            if (isBlank(email)) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("unauthenticated_no_email"),
                        "Email not provided by " + provider
                );
            }
            user = oauthService.createUserAndLink(email, name, picture, provider, pid, emailVerified);
        }

        // 3) 표준 속성 확정
        attrs.put("uid", user.getId());
        if (email != null)   attrs.put("email", email);
        if (name != null)    attrs.put("name", name);
        if (picture != null) attrs.put("picture", picture);
        attrs.putIfAbsent("email_verified", emailVerified);

        // 4) 권한
        Set<GrantedAuthority> auths = new HashSet<>(raw.getAuthorities());
        auths.add(new SimpleGrantedAuthority("ROLE_USER"));

        // 5) nameAttributeKey
        String nameAttributeKey = req.getClientRegistration()
                .getProviderDetails()
                .getUserInfoEndpoint()
                .getUserNameAttributeName();
        if (isBlank(nameAttributeKey)) {
            nameAttributeKey = attrs.containsKey("sub") ? "sub" : "id";
        }

        return new DefaultOAuth2User(auths, attrs, nameAttributeKey);
    }

    /** 공급자별 원본 속성을 표준 키(email, name, picture, id/sub)로 보완/정규화하고 pid를 반환 */
    @SuppressWarnings("unchecked")
    private static String normalizeAttributes(String provider, Map<String, Object> a) {
        String pid = null;

        switch (provider) {
            case "google" -> {
                // OIDC 표준: sub/email/name/picture
                pid = str(a.get("sub"));
            }
            case "naver" -> {
                // 네이버는 response에 중첩
                Object resp = a.get("response");
                if (resp instanceof Map<?, ?> r) {
                    a.putAll((Map<String, Object>) r);
                }
                pid = str(a.get("id"));
                if (a.get("email") == null)   a.put("email", a.get("email")); // 이미 위 putAll로 평탄화됨
                if (a.get("name") == null)    a.put("name", firstNonBlank(str(a.get("name")), str(a.get("nickname"))));
                if (a.get("picture") == null) a.put("picture", a.get("profile_image"));
            }
            case "kakao" -> {
                // kakao: id 최상위, 상세는 kakao_account.profile.*
                pid = str(a.get("id"));
                Object ka = a.get("kakao_account");
                if (ka instanceof Map<?, ?> acc) {
                    if (a.get("email") == null) a.put("email", acc.get("email"));
                    Object profile = acc.get("profile");
                    if (profile instanceof Map<?, ?> p) {
                        if (a.get("name") == null) a.put("name", p.get("nickname"));
                        if (a.get("picture") == null) {
                            Object pic = ((Map<?, ?>) p).get("profile_image_url");
                            if (pic == null) pic = ((Map<?, ?>) p).get("thumbnail_image_url");
                            if (pic != null) a.put("picture", pic);
                        }
                    }
                }
            }
            default -> {
                if (pid == null) pid = firstNonBlank(str(a.get("id")), str(a.get("sub")));
            }
        }

        if (pid == null || pid.isBlank()) {
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_provider_id"),
                    "Provider id (pid) not found for " + provider);
        }
        return pid;
    }

    /* ---------- utils ---------- */
    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }
    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static String firstNonBlank(String... xs) {
        if (xs == null) return null;
        for (String x : xs) if (!isBlank(x)) return x;
        return null;
    }
}
