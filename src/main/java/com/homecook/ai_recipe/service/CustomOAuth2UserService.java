package com.homecook.ai_recipe.service;

import org.springframework.security.oauth2.client.userinfo.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.core.user.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {
    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        String registrationId = userRequest.getClientRegistration().getRegistrationId(); // naver, kakao, google, facebook
        OAuth2User user = delegate.loadUser(userRequest);
        Map<String, Object> attrs = user.getAttributes();

        Map<String, Object> mapped = switch (registrationId) {
            case "naver" -> mapNaver(attrs);
            case "kakao" -> mapKakao(attrs);
            case "google" -> mapGoogle(attrs);
            case "facebook" -> mapFacebook(attrs);
            default -> throw new OAuth2AuthenticationException(new OAuth2Error("unsupported_provider"),
                    "Unsupported provider: " + registrationId);
        };

        // 권한은 기본 유지
        return new DefaultOAuth2User(new HashSet<>(user.getAuthorities()), mapped, "id");
    }

    private Map<String, Object> mapNaver(Map<String, Object> attrs) {
        Object resp = attrs.get("response");
        if (!(resp instanceof Map)) {
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_user_info"), "Naver response missing");
        }
        Map<?,?> r = (Map<?,?>) resp;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",    asStr(r.get("id")));
        m.put("email", asStr(r.get("email")));
        m.put("name",  asStr(r.get("name")));
        m.put("picture", asStr(r.get("profile_image")));
        m.put("provider", "naver");
        return m;
    }

    private Map<String, Object> mapKakao(Map<String, Object> attrs) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", asStr(attrs.get("id")));
        Object account = attrs.get("kakao_account");
        if (account instanceof Map<?,?> acc) {
            m.put("email",  asStr(acc.get("email")));
            Object profile = acc.get("profile");
            if (profile instanceof Map<?,?> p) {
                m.put("name",    asStr(p.get("nickname")));
                m.put("picture", asStr(p.get("profile_image_url")));
            }
        }
        m.put("provider", "kakao");
        return m;
    }

    private Map<String, Object> mapGoogle(Map<String, Object> attrs) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",      asStr(attrs.get("sub"))); // OpenID
        m.put("email",   asStr(attrs.get("email")));
        m.put("name",    asStr(attrs.get("name")));
        m.put("picture", asStr(attrs.get("picture")));
        m.put("provider", "google");
        return m;
    }

    private Map<String, Object> mapFacebook(Map<String, Object> attrs) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",    asStr(attrs.get("id")));
        m.put("name",  asStr(attrs.get("name")));
        m.put("email", asStr(attrs.get("email")));
        m.put("provider", "facebook");
        return m;
    }

    private static String asStr(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
