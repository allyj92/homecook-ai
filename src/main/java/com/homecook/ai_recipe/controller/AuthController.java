// src/main/java/com/homecook/ai_recipe/controller/AuthController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.service.LocalAuthService;
import com.homecook.ai_recipe.service.OAuthAccountService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import lombok.Data;
import lombok.RequiredArgsConstructor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.context.SecurityContextRepository;
import com.homecook.ai_recipe.service.CommunityService;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    private final LocalAuthService localAuthService;
    private final CommunityService communityService;

    /* ====================== 로컬 회원가입 / 로그인 ====================== */

    @PostMapping("/local/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterReq req) {
        try {
            UserAccount u = localAuthService.register(req.getEmail(), req.getPassword(), req.getName());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new RegisterRes(u.getId(), u.getEmail(), u.getName(), u.isEmailVerified()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            log.error("[LOCAL REGISTER] failed", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "register_failed");
        }
    }

    @PostMapping("/local/login")
    public ResponseEntity<?> localLogin(@Valid @RequestBody LoginReq req,
                                        HttpServletRequest httpReq,
                                        HttpServletResponse httpRes) {
        var userOpt = localAuthService.login(req.getEmail(), req.getPassword());
        if (userOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
        }
        UserAccount u = userOpt.get();

        // principal payload (Map으로 넣음)
        Map<String, Object> principal = new HashMap<>();
        principal.put("provider", "local");
        principal.put("uid", u.getId());
        principal.put("email", u.getEmail());
        principal.put("name", u.getName());
        principal.put("picture", u.getAvatar());

        // Authentication
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
                );

        // SecurityContext 저장 (세션에 보존)
        SecurityContext context = SecurityContextHolder.getContext();
        context.setAuthentication(auth);
        securityContextRepository.saveContext(context, httpReq, httpRes);

        // 표준 응답
        Map<String, Object> body = new HashMap<>();
        body.put("authenticated", true);
        body.put("provider", "local");
        body.put("uid", u.getId());
        body.put("email", u.getEmail());
        body.put("name", u.getName());
        body.put("picture", u.getAvatar()); // null이어도 OK
        return ResponseEntity.ok(body);
    }

    /* ====================== 현재 로그인 정보(me) ====================== */

    @GetMapping(value = "/me", produces = "application/json")
    public Map<String, Object> me(Authentication authentication) {
        Map<String, Object> out = new HashMap<>();
        boolean authenticated = authentication != null && authentication.isAuthenticated();
        out.put("authenticated", authenticated);

        if (!authenticated) {
            out.put("provider", null);
            out.put("uid", null);
            out.put("email", null);
            out.put("name", null);
            out.put("picture", null);
            out.put("commentCount", 0L);
            return out;
        }

        // === OAuth2 (google/naver/kakao) ===
        if (authentication instanceof OAuth2AuthenticationToken token) {
            String provider = token.getAuthorizedClientRegistrationId();
            OAuth2User principal = token.getPrincipal();
            Map<String, Object> attrs = principal != null ? principal.getAttributes() : Collections.emptyMap();

            String pid = str(firstNonNull(attrs.get("sub"), attrs.get("id"), nested(attrs, "response", "id")));
            out.put("pid", pid);

            Long uid = null;
            Object uidObj = attrs.get("uid");
            if (uidObj instanceof Number n) uid = n.longValue();
            else if (uidObj instanceof String s && !s.isBlank()) {
                try { uid = Long.parseLong(s); } catch (NumberFormatException ignored) {}
            }
            if (uid == null && provider != null && pid != null) {
                uid = oauthService.findByProvider(provider, pid).map(UserAccount::getId).orElse(null);
            }

            String email   = str(firstNonNull(attrs.get("email"), nested(attrs, "response", "email")));
            String name    = str(firstNonNull(attrs.get("name"), attrs.get("nickname"),
                    nested(attrs, "response", "name"), nested(attrs, "response", "nickname")));
            String picture = str(firstNonNull(attrs.get("picture"), nested(attrs, "response", "profile_image")));

            out.put("provider", provider);
            out.put("uid", uid);
            out.put("email", email);
            out.put("name", name);
            out.put("picture", picture);
            out.put("commentCount", (uid != null) ? communityService.countCommentsByUser(uid) : 0L);
            return out;
        }

        // === 로컬 로그인(UsernamePasswordAuthenticationToken 등) ===
        Object p = authentication.getPrincipal();
        if (p instanceof Map<?,?> m) {
            Object provider = m.get("provider");
            if (provider == null) provider = "local";

            Long uid = null;
            Object uidObj = m.get("uid");
            if (uidObj instanceof Number n) uid = n.longValue();
            else if (uidObj instanceof String s && !s.isBlank()) {
                try { uid = Long.parseLong(s); } catch (NumberFormatException ignored) {}
            }

            out.put("provider", String.valueOf(provider));
            out.put("uid", uid);
            out.put("email", str(m.get("email")));
            out.put("name",  str(m.get("name")));
            out.put("picture", str(m.get("picture")));
            out.put("commentCount", (uid != null) ? communityService.countCommentsByUser(uid) : 0L);
            return out;
        }

        // 기타 타입(UserDetails 등) 대비
        out.put("provider", "local");
        out.put("uid", null);
        out.put("email", null);
        out.put("name", String.valueOf(authentication.getName()));
        out.put("picture", null);
        out.put("commentCount", 0L);
        return out;
    }

    /* ====================== refresh (세션/쿠키 유지, 모든 타입 지원) ====================== */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(Authentication authentication,
                                     @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
                                     HttpServletResponse response) {
        boolean authenticated = authentication != null && authentication.isAuthenticated();
        if (!authenticated) {
            // 인증 안 된 상태면 쿠키 제거 + 401
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie("", true).toString());
            response.addHeader(HttpHeaders.SET_COOKIE, buildSessionKiller().toString());
            return ResponseEntity.status(401).body(Map.of("authenticated", false, "reason", "no_session"));
        }

        // 리프레시 쿠키가 있으면 재발급(프론트 유지용)
        if (refreshToken != null && !refreshToken.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(refreshToken, false).toString());
        }

        // me()와 동일한 정보로 응답
        Map<String, Object> me = me(authentication);
        return ResponseEntity.ok(me);
    }

    /* ====================== 로그아웃 ====================== */

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        try {
            SecurityContextHolder.clearContext();
            var session = request.getSession(false);
            if (session != null) session.invalidate();
        } finally {
            setCookie(response, buildRefreshCookie("", true));
            setCookie(response, buildSessionKiller());
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /* ====================== 디버그용 쿠키 부트스트랩 ====================== */

    @RequestMapping(value = "/bootstrap-cookie", method = { RequestMethod.POST, RequestMethod.GET })
    public ResponseEntity<?> bootstrapCookie(HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true); // RFSESSIONID 보장
        String issued = UUID.randomUUID().toString();
        setCookie(response, buildRefreshCookie(issued, false));
        log.debug("[AUTH] bootstrap-cookie: issued={}", issued.substring(0, 8));
        return ResponseEntity.ok(Map.of("ok", true, "refreshShort", issued.substring(0, 8)));
    }

    /* ====================== DTO ====================== */

    @Data
    public static class RegisterReq {
        @NotBlank @Email private String email;
        @NotBlank private String password;
        @NotBlank private String name;
    }
    public record RegisterRes(Long id, String email, String name, boolean emailVerified) {}

    @Data
    public static class LoginReq {
        @NotBlank @Email private String email;
        @NotBlank private String password;
    }

    /* ====================== 쿠키/헬퍼 ====================== */

    private static Optional<String> readCookie(HttpServletRequest req, String name) {
        Cookie[] cs = req.getCookies();
        if (cs == null) return Optional.empty();
        for (Cookie c : cs) {
            if (name.equals(c.getName())) return Optional.ofNullable(c.getValue());
        }
        return Optional.empty();
    }

    private static ResponseCookie buildRefreshCookie(String value, boolean expireNow) {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(REFRESH_COOKIE, value == null ? "" : value)
                .httpOnly(true).secure(true).path("/").sameSite("Lax").domain("recipfree.com");
        if (expireNow) b.maxAge(0);
        else b.maxAge(Duration.ofDays(30));
        return b.build();
    }

    private static ResponseCookie buildSessionKiller() {
        return ResponseCookie.from(SESSION_COOKIE, "")
                .httpOnly(true).secure(true).path("/").sameSite("Lax")
                .domain("recipfree.com").maxAge(0).build();
    }

    private static void setCookie(HttpServletResponse res, ResponseCookie c) {
        res.addHeader(HttpHeaders.SET_COOKIE, c.toString());
    }

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
