// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.*;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SecurityContextRepository securityContextRepository;
    private final SecurityContextHolderStrategy contextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();

    public AuthController(ObjectProvider<SecurityContextRepository> repoProvider) {
        // 빈이 없으면 기본 구현으로 대체하여 안전하게
        this.securityContextRepository =
                repoProvider.getIfAvailable(HttpSessionSecurityContextRepository::new);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
        Map<String, Object> a = user.getAttributes();
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "id", a.get("id"),
                "email", a.get("email"),
                "name", a.get("name"),
                "picture", a.get("picture"),
                "provider", a.get("provider")
        ));
    }

    // src/main/java/com/homecook/ai_recipe/controller/AuthController.java
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        try {
            if (refreshToken == null || refreshToken.isBlank()) {
                return ResponseEntity.status(401).body(Map.of("message", "unauthenticated"));
            }

            // TODO: 실제 refreshToken 검증 → 사용자 로드
            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("id", "rf:" + refreshToken.substring(0, Math.min(8, refreshToken.length())));
            attrs.put("name", "SessionUser");
            attrs.put("provider", "refresh");

            var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var principal = new DefaultOAuth2User(new HashSet<>(authorities), attrs, "id");
            var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);

            // 1) 예전/중복 JSESSIONID 모두 제거 (host-only, .recipfree.com 두 버전)
            ResponseCookie clearHost = ResponseCookie.from("JSESSIONID", "")
                    .httpOnly(true).secure(true).path("/").maxAge(0)
                    .build();
            ResponseCookie clearDot = ResponseCookie.from("JSESSIONID", "")
                    .httpOnly(true).secure(true).path("/").domain(".recipfree.com").maxAge(0)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, clearHost.toString());
            response.addHeader(HttpHeaders.SET_COOKIE, clearDot.toString());

            // 2) 새 세션 보장 + 새 세션ID 강제 발급 → Set-Cookie(JSESSIONID=...)가 응답에 실림
            request.getSession(true);
            String newSid = request.changeSessionId();

            // 3) SecurityContext 생성/저장
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, request, response);

            // 4) (선택) refresh_token 회전
            ResponseCookie rotated = ResponseCookie.from("refresh_token", "NEW_REFRESH_TOKEN")
                    .httpOnly(true).secure(true)
                    .domain(".recipfree.com") // refresh 토큰은 도메인 전체 공유 원하면 유지
                    .path("/")
                    .sameSite("Lax")
                    .maxAge(java.time.Duration.ofDays(30))
                    .build();

            // 5) (디버그) 새 세션ID도 바디로 내려 확인 용도
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, rotated.toString())
                    .body(Map.of("user", Map.copyOf(attrs), "sessionId", newSid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("message","refresh_failed", "error", e.getClass().getSimpleName(), "detail", e.getMessage()));
        }
    }
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
