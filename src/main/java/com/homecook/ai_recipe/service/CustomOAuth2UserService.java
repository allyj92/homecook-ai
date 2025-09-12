// src/main/java/com/homecook/ai_recipe/service/CustomOAuth2UserService.java
package com.homecook.ai_recipe.service;


import com.homecook.ai_recipe.domain.User;
import com.homecook.ai_recipe.repo.UserRepository;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequestEntityConverter;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestOperations;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final OAuth2UserRequestEntityConverter requestConverter = new OAuth2UserRequestEntityConverter();
    private final RestOperations rest;
    private final UserRepository userRepository;

    public CustomOAuth2UserService(UserRepository userRepository) {
        RestTemplate rt = new RestTemplate();
        rt.setErrorHandler(new OAuth2ErrorResponseErrorHandler());
        this.rest = rt;
        this.userRepository = userRepository;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        // 1) 각 공급자 UserInfo 호출
        Map<String, Object> src = fetchUserAttributes(req);
        String provider = req.getClientRegistration().getRegistrationId(); // google | naver | kakao | facebook ...

        // 2) 표준 스키마로 평탄화
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
                Map<String, Object> resp = castMap(src.get("response"));
                std.put("id",      str(resp.get("id")));
                std.put("email",   str(resp.get("email")));
                std.put("name",    str(resp.get("name")));
                std.put("picture", str(resp.get("profile_image")));
            }
            case "kakao" -> {
                Map<String, Object> acc  = castMap(src.get("kakao_account"));
                Map<String, Object> prof = castMap(acc.get("profile"));
                std.put("id",      str(src.get("id")));
                std.put("email",   str(acc.get("email")));
                std.put("name",    strOr(prof.get("nickname"), "카카오 사용자"));
                std.put("picture", str(prof.get("profile_image_url")));
            }
            case "facebook" -> {
                std.put("id",      str(src.get("id")));
                std.put("email",   str(src.get("email")));
                std.put("name",    str(src.get("name")));
                std.put("picture", ""); // 필요 시 Graph API로 별도 조회
            }
            default -> {
                std.put("id",      strOr(src.get("id"), str(src.get("sub"))));
                std.put("email",   str(src.get("email")));
                std.put("name",    strOr(src.get("name"), ""));
                std.put("picture", strOr(src.get("picture"), ""));
            }
        }

        // 3) 필수 키 검증
        if (std.get("id") == null || String.valueOf(std.get("id")).isBlank()) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_user_info"),
                    "Missing provider user id"
            );
        }

        // 4) DB 업서트 (provider + providerUserId 기준)
        String providerUserId = String.valueOf(std.get("id"));
        User user = userRepository
                .findByProviderAndProviderUserId(provider, providerUserId)
                .orElseGet(User::new);

        user.setProvider(provider);
        user.setProviderUserId(providerUserId);
        if (std.get("email") != null && !String.valueOf(std.get("email")).isBlank())
            user.setEmail(String.valueOf(std.get("email")));
        if (std.get("name") != null) user.setName(String.valueOf(std.get("name")));
        if (std.get("picture") != null) user.setPicture(String.valueOf(std.get("picture")));

        user = userRepository.save(user);

        // 5) 컨트롤러서 바로 userId 사용할 수 있도록 넣어둠
        std.put("uid", user.getId()); // 내 DB PK

        // 6) 권한 부여 및 반환 (이 principal은 OAuth2AuthenticationToken에 실림)
        Collection<GrantedAuthority> roles = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        return new DefaultOAuth2User(new HashSet<>(roles), std, "id");
    }

    /* ------------------ 내부 헬퍼 ------------------ */

    private Map<String, Object> fetchUserAttributes(OAuth2UserRequest req) {
        RequestEntity<?> request = requestConverter.convert(req);
        ResponseEntity<Map> resp = ((RestTemplate) rest).exchange(request, Map.class);
        Map<String, Object> body = resp.getBody();
        return body != null ? body : Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object o) {
        if (o instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return Collections.emptyMap();
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }

    private static String strOr(Object o, String fallback) {
        String s = str(o);
        return s.isEmpty() ? fallback : s;
    }
}
