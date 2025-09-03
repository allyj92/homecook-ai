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
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        try {
            boolean bootstrap = (refreshToken == null || refreshToken.isBlank());

            // 0) 기존에 섞여 있을 가능성이 있는 JSESSIONID 쿠키 둘 다 제거(도메인/호스트)
            //   - host-only 삭제 (Domain 미지정)
            response.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID","")
                            .httpOnly(true).secure(true)
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(0)
                            .build().toString());
            //   - 도메인 쿠키 삭제 (Domain=.recipfree.com)
            response.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID","")
                            .httpOnly(true).secure(true)
                            .domain(".recipfree.com")
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(0)
                            .build().toString());

            // 1) 유저 속성(데모)
            Map<String, Object> attrs = new LinkedHashMap<>();
            if (bootstrap) {
                attrs.put("id", "dev:" + java.util.UUID.randomUUID().toString().substring(0,8));
                attrs.put("name", "DevUser");
                attrs.put("provider", "bootstrap");
            } else {
                attrs.put("id", "rf:" + refreshToken.substring(0, Math.min(8, refreshToken.length())));
                attrs.put("name", "SessionUser");
                attrs.put("provider", "refresh");
            }

            var authorities = java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"));
            var principal   = new org.springframework.security.oauth2.core.user.DefaultOAuth2User(new java.util.HashSet<>(authorities), attrs, "id");
            var auth        = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, authorities);

            // 2) 세션 보장 (여기서 JSESSIONID는 컨테이너가 발급)
            request.getSession(true);

            // 3) SecurityContext 저장 (수동으로 JSESSIONID를 설정하지 않음!)
            var ctx = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            org.springframework.security.core.context.SecurityContextHolder.setContext(ctx);
            securityContextRepository.saveContext(ctx, request, response);

            // 4) refresh_token은 계속 발급(필요 시)
            String newRefresh = bootstrap ? ("DEV_REFRESH_" + java.util.UUID.randomUUID()) : "NEW_REFRESH_TOKEN";
            response.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("refresh_token", newRefresh)
                            .httpOnly(true).secure(true)
                            .domain(".recipfree.com") // 필요 없으면 이 줄 제거해서 host-only로 통일해도 OK
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(java.time.Duration.ofDays(30))
                            .build().toString());

            return ResponseEntity.ok(java.util.Map.of(
                    "user", java.util.Map.copyOf(attrs),
                    "bootstrap", bootstrap
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of(
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
