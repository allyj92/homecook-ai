// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private static final String REFRESH_COOKIE = "refresh_token";
    private static final String SESSION_COOKIE  = "RFSESSIONID"; // application.yml 과 동일

    private final SecurityContextRepository securityContextRepository;

    public AuthController(SecurityContextRepository securityContextRepository) {
        this.securityContextRepository = securityContextRepository;
    }

    /* ---------- 공통 쿠키 유틸 ---------- */

    private static Optional<String> readCookie(HttpServletRequest req, String name) {
        Cookie[] cs = req.getCookies();
        if (cs == null) return Optional.empty();
        for (Cookie c : cs) {
            if (name.equals(c.getName())) return Optional.ofNullable(c.getValue());
        }
        return Optional.empty();
    }

    /** refresh_token 쿠키 생성/삭제 (SameSite=Lax, Secure, HttpOnly) */
    private static ResponseCookie buildRefreshCookie(String value, boolean expireNow) {
        var b = ResponseCookie.from(REFRESH_COOKIE, value == null ? "" : value)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .sameSite("Lax");
        // 필요시 도메인 고정 (예: 서브도메인 공유) → 환경에 맞춰 주석 해제
        // b.domain(".recipfree.com");

        if (expireNow) b.maxAge(0);
        else b.maxAge(Duration.ofDays(30));
        return b.build();
    }

    /** 세션 쿠키 제거용 */
    private static ResponseCookie buildSessionKiller() {
        var b = ResponseCookie.from(SESSION_COOKIE, "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .sameSite("Lax")
                .maxAge(0);
        // 필요시 도메인 고정 → 환경에 맞춰 주석 해제
        // b.domain(".recipfree.com");

        return b.build();
    }

    private static void setCookie(HttpServletResponse res, ResponseCookie c) {
        res.addHeader(HttpHeaders.SET_COOKIE, c.toString());
    }

    /* ---------- API ---------- */

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
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        try {
            String refreshToken = readCookie(request, REFRESH_COOKIE).orElse(null);
            if (refreshToken == null || refreshToken.isBlank()) {
                log.debug("[AUTH] refresh: no refresh_token -> 401");
                // 세션 & 리프레시 쿠키 정리
                setCookie(response, buildSessionKiller());
                setCookie(response, buildRefreshCookie("", true));
                return ResponseEntity.status(401)
                        .body(Map.of("authenticated", false, "reason", "no_refresh_token"));
            }

            // 데모: refresh 토큰 → 유저 속성 복원 (실서비스에선 서명검증/DB조회)
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

            // 세션 보장 + 컨텍스트 저장
            request.getSession(true);
            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);
            securityContextRepository.saveContext(ctx, request, response);

            // refresh 토큰 로테이트(샘플: 새 UUID)
            String newRefresh = UUID.randomUUID().toString();
            setCookie(response, buildRefreshCookie(newRefresh, false));
            log.debug("[AUTH] refresh: ok -> new refresh issued {}", newRefresh.substring(0, 8));

            return ResponseEntity.ok(Map.of("user", Map.copyOf(attrs)));
        } catch (Exception e) {
            log.error("[AUTH] refresh failed", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "message", "refresh_failed",
                    "error", e.getClass().getSimpleName(),
                    "detail", e.getMessage()
            ));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        try {
            // 시큐리티 컨텍스트/세션 무효화
            SecurityContextHolder.clearContext();
            var session = request.getSession(false);
            if (session != null) session.invalidate();
        } finally {
            // 쿠키 제거
            setCookie(response, buildRefreshCookie("", true));
            setCookie(response, buildSessionKiller());
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** 테스트/디버그: refresh_token 발급 + 세션 생성 (GET/POST 허용) */
    @RequestMapping(value = "/bootstrap-cookie", method = { RequestMethod.POST, RequestMethod.GET })
    public ResponseEntity<?> bootstrapCookie(HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true); // RFSESSIONID 보장
        String issued = UUID.randomUUID().toString();
        setCookie(response, buildRefreshCookie(issued, false));
        log.debug("[AUTH] bootstrap-cookie: issued={}", issued.substring(0, 8));
        return ResponseEntity.ok(Map.of("ok", true, "refreshShort", issued.substring(0, 8)));
    }
}
