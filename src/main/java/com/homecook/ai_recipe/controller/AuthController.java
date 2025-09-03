// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
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

    /**
     * 부트스트랩 모드: refresh_token 없더라도 일단 세션/쿠키를 만들어 준다.
     * (실서비스 전에는 반드시 원복하거나 토글 플래그로 제한)
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest req,
            HttpServletResponse res
    ) {
        try {
            boolean bootstrap = (refreshToken == null || refreshToken.isBlank());

            // 0) 사용자 속성(데모)
            Map<String, Object> attrs = new LinkedHashMap<>();
            if (bootstrap) {
                attrs.put("id", "dev:" + UUID.randomUUID().toString().substring(0, 8));
                attrs.put("name", "DevUser");
                attrs.put("provider", "bootstrap");
            } else {
                attrs.put("id", "rf:" + refreshToken.substring(0, Math.min(8, refreshToken.length())));
                attrs.put("name", "SessionUser");
                attrs.put("provider", "refresh");
            }

            var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var principal = new DefaultOAuth2User(new HashSet<>(authorities), attrs, "id");
            var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);

            // 1) 이전 JSESSIONID 클리어(혹시 모를 중복 제거)
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID", "").httpOnly(true).secure(true).path("/").maxAge(0).build().toString());

            // 2) 세션 생성 + 새 세션ID 발급
            req.getSession(true);
            String newSid = req.changeSessionId();

            // 3) SecurityContext 저장
            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);
            try {
                securityContextRepository.saveContext(ctx, req, res);
            } catch (Exception ignore) {
                req.getSession(true).setAttribute(
                        HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, ctx);
            }

            // 4) JSESSIONID 수동 세팅(★ host-only로 우선 고정) — 둘 중 하나만 사용!
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID", newSid)
                            .httpOnly(true)
                            .secure(true)
                            .path("/")       // host-only
                            .sameSite("Lax")
                            .build().toString());

            // 5) refresh_token도 보장(부트스트랩이면 새로 발급)
            String newRefresh = bootstrap ? ("DEV_REFRESH_" + UUID.randomUUID()) : "NEW_REFRESH_TOKEN";
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("refresh_token", newRefresh)
                            .httpOnly(true)
                            .secure(true)
                            .domain(".recipfree.com") // refresh는 도메인 공유가 편함
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(Duration.ofDays(30))
                            .build().toString());

            return ResponseEntity.ok(Map.of("user", Map.copyOf(attrs), "sessionId", newSid, "bootstrap", bootstrap));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "message","refresh_failed", "error", e.getClass().getSimpleName(), "detail", e.getMessage()
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
