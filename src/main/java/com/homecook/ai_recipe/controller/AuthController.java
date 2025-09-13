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
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
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

// 변경 후

        @GetMapping("/me")
        public Map<String, Object> me(
                @AuthenticationPrincipal OAuth2User user,
                OAuth2AuthenticationToken authToken   // ★ 추가
) {
            if (user == null) return Map.of("authenticated", false);

            var a = user.getAttributes();

            // provider fallback: attributes에 없으면 토큰에서 뽑기
            String provider = (a.get("provider") != null) ? String.valueOf(a.get("provider"))
                    : (authToken != null ? authToken.getAuthorizedClientRegistrationId() : null);

            // id fallback: OIDC(구글)는 sub, OAuth2(네이버/카카오)는 id
            Object idObj = (a.get("id") != null) ? a.get("id") : a.get("sub");

            return Map.of(
                    "authenticated", true,
                    "uid", a.get("uid"),           // 커스텀 서비스가 셋업한 경우만 존재
                    "provider", provider,
                    "id", idObj,
                    "email", a.get("email"),
                    "name", a.get("name"),
                    "picture", a.get("picture")
            );
        }



    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @AuthenticationPrincipal OAuth2User user,
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse response
    ) {
        // 세션에 로그인된 유저가 없으면 401
        if (user == null) {
            // (선택) 쿠키 정리
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie("", true).toString());
            response.addHeader(HttpHeaders.SET_COOKIE, buildSessionKiller().toString());
            return ResponseEntity.status(401).body(Map.of("authenticated", false, "reason", "no_session"));
        }

        // (선택) refresh_token 로테이트만 수행 — 세션 principal은 건드리지 않음!
        if (refreshToken != null && !refreshToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(refreshToken, false).toString());
        }

        Map<String, Object> a = user.getAttributes();
        return ResponseEntity.ok(Map.of(
                "user", Map.of(
                        "id", a.get("id"),
                        "email", a.get("email"),
                        "name", a.get("name"),
                        "picture", a.get("picture"),
                        "provider", a.get("provider")
                )
        ));
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
