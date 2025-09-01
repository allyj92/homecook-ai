// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** 현재 로그인 상태 조회 */
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
        Map<String, Object> a = user.getAttributes(); // CustomOAuth2UserService에서 통일한 키 사용
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "id",       a.get("id"),
                "email",    a.get("email"),
                "name",     a.get("name"),
                "picture",  a.get("picture"),
                "provider", a.get("provider")
        ));
    } // ← ★ 여기 닫힘이 꼭 있어야 함!

    /** 액세스 토큰 재발급 (리프레시 쿠키 필요) */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "unauthenticated"));
        }

        // TODO: 실제 검증/회전 로직으로 교체
        String newRefresh = "NEW_REFRESH_TOKEN";
        String accessToken = "NEW_ACCESS_TOKEN";

        ResponseCookie cookie = ResponseCookie.from("refresh_token", newRefresh)
                .httpOnly(true)
                .secure(true)
                .domain(".recipfree.com") // 프론트/서브도메인 공통
                .path("/")
                .sameSite("Lax")          // 크로스사이트 필요 시 "None" (Secure 필수)
                .maxAge(Duration.ofDays(30))
                .build();

        return ResponseEntity
                .ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("accessToken", accessToken));
    }

    /** 로그아웃(옵션): 리프레시 쿠키 제거 */
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie clear = ResponseCookie.from("refresh_token", "")
                .httpOnly(true).secure(true)
                .domain(".recipfree.com").path("/")
                .sameSite("Lax").maxAge(0)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clear.toString())
                .body(Map.of("ok", true));
    }
}
