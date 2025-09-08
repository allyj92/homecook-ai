// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SecurityContextRepository securityContextRepository;

    public AuthController(SecurityContextRepository securityContextRepository) {
        this.securityContextRepository = securityContextRepository;
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

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        try {
            // 0) refresh_token 없으면 401
            if (refreshToken == null || refreshToken.isBlank()) {
                // (선택) 세션/쿠키 정리
                response.addHeader(HttpHeaders.SET_COOKIE,
                        ResponseCookie.from("JSESSIONID","")
                                .httpOnly(true).secure(true)
                                .path("/")
                                .sameSite("Lax")
                                .maxAge(0).build().toString());
                return ResponseEntity.status(401).body(Map.of("authenticated", false, "reason", "no_refresh_token"));
            }

            // 1) 토큰 → 유저 속성 (데모: 서명검증/DB 조회 대신 prefix만 사용)
            String shortId = refreshToken.substring(0, Math.min(8, refreshToken.length()));
            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("id", "rf:" + shortId);
            attrs.put("name", "SessionUser");
            attrs.put("provider", "refresh");
            attrs.put("email", "rf_" + shortId + "@recipfree.com");
            attrs.put("picture", "https://picsum.photos/seed/rf_" + shortId + "/200/200");

            var roles = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var principal = new DefaultOAuth2User(new HashSet<>(roles), attrs, "id");
            var auth = new UsernamePasswordAuthenticationToken(principal, null, roles);

            // 2) 세션 보장 + 시큐리티 컨텍스트 저장
            request.getSession(true);
            var ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);

            // Repository가 HttpSession에 컨텍스트 저장하게 해줌
            securityContextRepository.saveContext(ctx, request, response);

            // 3) refresh_token 로테이트(옵션)
            String newRefresh = "NEW_REFRESH_TOKEN"; // 실제로는 서명된 토큰으로 발급
            response.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("refresh_token", newRefresh)
                            .httpOnly(true).secure(true)
                            .domain(".recipfree.com") // 프런트가 recipfree.com이면 유지
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(Duration.ofDays(30))
                            .build().toString());

            return ResponseEntity.ok(Map.of("user", Map.copyOf(attrs)));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "message","refresh_failed",
                    "error", e.getClass().getSimpleName(),
                    "detail", e.getMessage()
            ));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie clear = ResponseCookie.from("refresh_token", "")
                .httpOnly(true).secure(true).domain(".recipfree.com").path("/").sameSite("Lax").maxAge(0).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, clear.toString()).body(Map.of("ok", true));
    }
}
