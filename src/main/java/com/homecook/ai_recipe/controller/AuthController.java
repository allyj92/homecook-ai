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
    private final SecurityContextHolderStrategy ctxHolder = SecurityContextHolder.getContextHolderStrategy();

    public AuthController(ObjectProvider<SecurityContextRepository> repoProvider) {
        this.securityContextRepository = repoProvider.getIfAvailable(HttpSessionSecurityContextRepository::new);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("authenticated", false));
        Map<String, Object> a = user.getAttributes();
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "id", a.get("id"), "email", a.get("email"),
                "name", a.get("name"), "picture", a.get("picture"),
                "provider", a.get("provider")
        ));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest req,
            HttpServletResponse res
    ) {
        try {
            if (refreshToken == null || refreshToken.isBlank()) {
                return ResponseEntity.status(401).body(Map.of("message", "unauthenticated"));
            }

            // TODO: refreshToken 검증 → 사용자 조회
            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("id", "rf:" + refreshToken.substring(0, Math.min(8, refreshToken.length())));
            attrs.put("name", "SessionUser");
            attrs.put("provider", "refresh");

            var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var principal = new DefaultOAuth2User(new HashSet<>(authorities), attrs, "id");
            var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);

            // 1) 중복 JSESSIONID 정리: host-only / .recipfree.com 둘 다 제거
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID","").httpOnly(true).secure(true)
                            .path("/").maxAge(0).build().toString());
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID","").httpOnly(true).secure(true)
                            .domain(".recipfree.com").path("/").maxAge(0).build().toString());

            // 2) 새 세션 보장 + 새 세션ID 강제 발급
            req.getSession(true);
            String newSid = req.changeSessionId(); // ← 톰캣이 JSESSIONID 교체하도록 강제

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

            // 4) (중요) JSESSIONID를 수동으로도 내려서 확실히 브라우저에 심는다
            //    — 운영에서 하나만 쓰세요: host-only *또는* .recipfree.com
            // (A) host-only(아펙스만 쓸 때)
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID", newSid)
                            .httpOnly(true).secure(true)
                            .path("/")
                            .sameSite("Lax")
                            .build().toString());
            // (B) 도메인 공유(서브도메인까지 쓸 때) ⇒ 위(A) 대신 이 한 줄만 사용
            // res.addHeader(HttpHeaders.SET_COOKIE,
            //         ResponseCookie.from("JSESSIONID", newSid)
            //                 .httpOnly(true).secure(true)
            //                 .domain(".recipfree.com")
            //                 .path("/")
            //                 .sameSite("Lax")
            //                 .build().toString());

            // 5) (선택) refresh_token 회전
            res.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("refresh_token", "NEW_REFRESH_TOKEN")
                            .httpOnly(true).secure(true)
                            .domain(".recipfree.com")   // refresh는 도메인 전체 공유가 보통 편함
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(java.time.Duration.ofDays(30))
                            .build().toString());

            return ResponseEntity.ok(Map.of("user", Map.copyOf(attrs), "sessionId", newSid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "message", "refresh_failed",
                    "error", e.getClass().getSimpleName(),
                    "detail", e.getMessage()
            ));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        var clear = ResponseCookie.from("refresh_token","")
                .httpOnly(true).secure(true).domain(".recipfree.com").path("/")
                .sameSite("Lax").maxAge(0).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, clear.toString()).body(Map.of("ok", true));
    }
}
