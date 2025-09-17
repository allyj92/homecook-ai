// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.service.OAuthAccountService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private static final String REFRESH_COOKIE = "refresh_token";
    private static final String SESSION_COOKIE  = "RFSESSIONID"; // application.yml 과 동일

    private final SecurityContextRepository securityContextRepository;
    private final OAuthAccountService oauthService;

    /* ---------- 공통 쿠키 유틸 ---------- */

    private static Optional<String> readCookie(HttpServletRequest req, String name) {
        Cookie[] cs = req.getCookies();
        if (cs == null) return Optional.empty();
        for (Cookie c : cs) {
            if (name.equals(c.getName())) return Optional.ofNullable(c.getValue());
        }
        return Optional.empty();
    }

    private static ResponseCookie buildRefreshCookie(String value, boolean expireNow) {
        var b = ResponseCookie.from(REFRESH_COOKIE, value == null ? "" : value)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .sameSite("Lax")
                .domain("recipfree.com");
        if (expireNow) b.maxAge(0);
        else b.maxAge(Duration.ofDays(30));
        return b.build();
    }

    private static ResponseCookie buildSessionKiller() {
        return ResponseCookie.from(SESSION_COOKIE, "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .sameSite("Lax")
                .domain("recipfree.com")
                .maxAge(0)
                .build();
    }

    private static void setCookie(HttpServletResponse res, ResponseCookie c) {
        res.addHeader(HttpHeaders.SET_COOKIE, c.toString());
    }

    /* ---------- /api/auth/me ---------- */

    @GetMapping(value = "/me", produces = "application/json")
    public Map<String, Object> me(Authentication authentication) {
        Map<String, Object> out = new HashMap<>();
        boolean authenticated = authentication instanceof OAuth2AuthenticationToken
                && authentication.isAuthenticated();

        out.put("authenticated", authenticated);

        if (!authenticated) {
            out.put("provider", null);
            out.put("uid", null);
            out.put("email", null);
            out.put("name", null);
            out.put("picture", null);
            return out; // 항상 200 OK
        }

        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        String provider = token.getAuthorizedClientRegistrationId(); // "naver", "google", ...
        OAuth2User principal = token.getPrincipal();
        Map<String, Object> attrs = principal != null ? principal.getAttributes() : Map.of();

        // 원본 공급자 ID (pid)
        String pid = str(firstNonNull(
                attrs.get("sub"),
                attrs.get("id"),
                nested(attrs, "response", "id")
        ));
        out.put("pid", pid);

        // uid 우선: attributes → 없으면 DB 조회로 보강
        Long uid = null;
        Object uidObj = attrs.get("uid");
        if (uidObj instanceof Number n) uid = n.longValue();
        else if (uidObj instanceof String s && !s.isBlank()) {
            try { uid = Long.parseLong(s); } catch (NumberFormatException ignored) {}
        }
        if (uid == null && provider != null && pid != null) {
            uid = oauthService.findByProvider(provider, pid).map(UserAccount::getId).orElse(null);
        }

        String email = str(firstNonNull(
                attrs.get("email"),
                nested(attrs, "response", "email")
        ));
        String name = str(firstNonNull(
                attrs.get("name"),
                attrs.get("nickname"),
                nested(attrs, "response", "name"),
                nested(attrs, "response", "nickname")
        ));
        String picture = str(firstNonNull(
                attrs.get("picture"),
                nested(attrs, "response", "profile_image")
        ));

        out.put("provider", provider);
        out.put("uid", uid); // Number 로 반환
        out.put("email", email);
        out.put("name", name);
        out.put("picture", picture);

        return out; // 항상 200 OK
    }

    /* ---------- /api/auth/refresh ---------- */

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @org.springframework.security.core.annotation.AuthenticationPrincipal OAuth2User user,
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse response
    ) {
        if (user == null) {
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie("", true).toString());
            response.addHeader(HttpHeaders.SET_COOKIE, buildSessionKiller().toString());
            return ResponseEntity.status(401).body(Map.of("authenticated", false, "reason", "no_session"));
        }

        if (refreshToken != null && !refreshToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(refreshToken, false).toString());
        }

        Map<String, Object> a = user.getAttributes();
        return ResponseEntity.ok(Map.of(
                "user", Map.of(
                        "id", a.get("id"),
                        "email", firstNonNull(a.get("email"), nested(a, "response", "email")),
                        "name", firstNonNull(a.get("name"), a.get("nickname"), nested(a, "response", "name"), nested(a, "response", "nickname")),
                        "picture", firstNonNull(a.get("picture"), nested(a, "response", "profile_image")),
                        "provider", a.get("provider")
                )
        ));
    }

    /* ---------- /api/auth/logout ---------- */

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        try {
            var context = org.springframework.security.core.context.SecurityContextHolder.getContext();
            context.setAuthentication(null);
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
            var session = request.getSession(false);
            if (session != null) session.invalidate();
        } finally {
            setCookie(response, buildRefreshCookie("", true));
            setCookie(response, buildSessionKiller());
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /* ---------- /api/auth/bootstrap-cookie (디버그용) ---------- */

    @RequestMapping(value = "/bootstrap-cookie", method = { RequestMethod.POST, RequestMethod.GET })
    public ResponseEntity<?> bootstrapCookie(HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true); // RFSESSIONID 보장
        String issued = UUID.randomUUID().toString();
        setCookie(response, buildRefreshCookie(issued, false));
        log.debug("[AUTH] bootstrap-cookie: issued={}", issued.substring(0, 8));
        return ResponseEntity.ok(Map.of("ok", true, "refreshShort", issued.substring(0, 8)));
    }

    /* ---------- 작은 헬퍼들 ---------- */

    private static Object firstNonNull(Object... xs) {
        for (Object x : xs) if (x != null) return x;
        return null;
    }

    @SuppressWarnings("unchecked")
    private static Object nested(Map<String, Object> map, String key1, String key2) {
        if (map == null) return null;
        Object a = map.get(key1);
        if (!(a instanceof Map)) return null;
        return ((Map<String, Object>) a).get(key2);
    }

    private static String str(Object o) { return o == null ? null : String.valueOf(o); }
}