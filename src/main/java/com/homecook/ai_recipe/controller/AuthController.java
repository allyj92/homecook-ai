// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** 현재 로그인 상태 조회 */
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
        Map<String, Object> a = user.getAttributes();
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "id",       a.get("id"),
                "email",    a.get("email"),
                "name",     a.get("name"),
                "picture",  a.get("picture"),
                "provider", a.get("provider")
        ));
    }

    /** 액세스/세션 재발급: refresh 쿠키로 서버 세션 인증을 ‘다시’ 올린다 */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest request
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "unauthenticated"));
        }

        // TODO: refreshToken 검증 후 사용자 조회 (DB/Redis 등)
        // 여기선 데모용으로 최소 속성만 구성
        Map<String, Object> attrs = new LinkedHashMap<>();
        attrs.put("id", "rf:" + refreshToken.substring(0, Math.min(8, refreshToken.length())));
        attrs.put("email", null);
        attrs.put("name", "SessionUser");
        attrs.put("picture", null);
        attrs.put("provider", "refresh");

        // 권한 부여
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        var principal = new DefaultOAuth2User(new HashSet<>(authorities), attrs, "id");

        // 세션에 인증 컨텍스트 올리기
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        // 세션 생성 보장
        request.getSession(true);

        // (선택) refresh 토큰 회전
        String newRefresh = "NEW_REFRESH_TOKEN"; // TODO: 실제 회전 토큰
        ResponseCookie cookie = ResponseCookie.from("refresh_token", newRefresh)
                .httpOnly(true)
                .secure(true)
                .domain(".recipfree.com")
                .path("/")
                .sameSite("Lax")
                .maxAge(Duration.ofDays(30))
                .build();

        // 프론트에서 즉시 사용자 캐시에 쓸 수 있도록 user 반환
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("user", Map.copyOf(attrs)));
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
