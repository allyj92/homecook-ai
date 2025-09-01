// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            // 필요하다면 @CookieValue 로 기존 쿠키 읽기
            @CookieValue(name = "refresh_token", required = false) String refreshToken
    ) {
        // 1) 전달받은 refreshToken 검증/갱신 (서비스 로직)
        // var tokens = authService.refresh(refreshToken);
        String newRefresh = "NEW_REFRESH_TOKEN"; // 예시
        String accessToken = "NEW_ACCESS_TOKEN"; // 예시

        // 2) 새 리프레시 토큰을 쿠키로 내려보내기
        ResponseCookie cookie = ResponseCookie.from("refresh_token", newRefresh)
                .httpOnly(true)
                .secure(true)
                .domain(".recipfree.com")   // ★ 중요: 프론트/서브도메인 모두 커버
                .path("/")
                .sameSite("Lax")            // 또는 "None" (이때 secure 필수)
                .maxAge(Duration.ofDays(30))
                .build();

        return ResponseEntity
                .ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("accessToken", accessToken)); // 바디에 액세스토큰 등 필요 정보
    }
}
