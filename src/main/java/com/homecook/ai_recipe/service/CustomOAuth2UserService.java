package com.homecook.ai_recipe.service;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) {
        OAuth2User raw = super.loadUser(req);
        String provider = req.getClientRegistration().getRegistrationId(); // google/naver/kakao/...

        // ★ 와일드카드 금지: 전부 Map<String,Object> 로 강제
        Map<String, Object> src = castMap(raw.getAttributes());

        Map<String, Object> std = new LinkedHashMap<>();
        std.put("provider", provider);

        switch (provider) {
            case "google" -> {
                String id = str(src.get("sub"));
                String email = str(src.get("email"));
                String name = strOr(src.get("name"),
                        (str(src.get("given_name")) + " " + str(src.get("family_name"))).trim());
                String picture = str(src.get("picture"));

                std.put("id", id);
                std.put("email", email);
                std.put("name", name);
                std.put("picture", picture);
            }
            case "naver" -> {
                // response 하위
                Map<String,Object> resp = castMap(src.get("response"));
                std.put("id",      str(resp.get("id")));
                std.put("email",   str(resp.get("email")));
                std.put("name",    str(resp.get("name")));
                std.put("picture", str(resp.get("profile_image")));
            }
            case "kakao" -> {
                Map<String,Object> acc  = castMap(src.get("kakao_account"));
                Map<String,Object> prof = castMap(acc.get("profile"));
                std.put("id",      str(src.get("id")));
                std.put("email",   str(acc.get("email")));
                std.put("name",    strOr(prof.get("nickname"), "카카오 사용자"));
                std.put("picture", str(prof.get("profile_image_url")));
            }
            case "facebook" -> {
                std.put("id",      str(src.get("id")));
                std.put("email",   str(src.get("email")));
                std.put("name",    str(src.get("name")));
                std.put("picture", ""); // 필요시 별도 호출
            }
            default -> {
                std.put("id",      strOr(src.get("id"), str(src.get("sub"))));
                std.put("email",   str(src.get("email")));
                std.put("name",    strOr(src.get("name"), ""));
                std.put("picture", strOr(src.get("picture"), ""));
            }
        }

        var roles = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        return new DefaultOAuth2User(new HashSet<>(roles), std, "id");
    }

    /* ---------- helpers ---------- */

    @SuppressWarnings("unchecked")
    private static Map<String,Object> castMap(Object o) {
        if (o instanceof Map<?,?> m) {
            // 키를 문자열로 강제 캐스팅 (신뢰 가능한 외부 프로바이더 응답 전제)
            return (Map<String,Object>) m;
        }
        return Collections.emptyMap();
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }

    private static String strOr(Object o, String fallback) {
        String s = str(o);
        return s.isEmpty() ? fallback : s;
    }
}
