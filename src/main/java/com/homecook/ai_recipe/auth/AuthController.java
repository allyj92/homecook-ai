// src/main/java/com/homecook/ai_recipe/auth/AuthController.java
package com.homecook.ai_recipe.auth;

import com.homecook.ai_recipe.dto.*;
import com.homecook.ai_recipe.dto.LocalAuthDtos.LoginReq;
import com.homecook.ai_recipe.dto.LocalAuthDtos.RegisterReq;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import com.homecook.ai_recipe.service.LocalAuthService;
import com.homecook.ai_recipe.service.MailService;
import com.homecook.ai_recipe.service.OAuthAccountService;
import com.homecook.ai_recipe.service.PasswordResetService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigInteger;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final LocalAuthService localAuth;
    private final UserAccountRepository userRepo;
    private final MailService mailService;
    private final PasswordResetService passwordResetService;

    // 소셜 로그인 JIT 가입/연결 담당
    private final OAuthAccountService oauthService;

    // ===== LOCAL (자체 로그인) =====
    @PostMapping("/local/register")
    public ResponseEntity<?> registerLocal(@RequestBody @Valid RegisterReq req, HttpSession session) {
        try {
            UserAccount u = localAuth.register(req.getEmail().trim(), req.getPassword().trim(), req.getName().trim());
            SessionUser su = new SessionUser("local", String.valueOf(u.getId()), u.getEmail(), u.getName(), u.getAvatar());
            session.setAttribute("LOGIN_USER", su);
            return ResponseEntity.ok(su);
        } catch (IllegalArgumentException dup) {
            return ResponseEntity.badRequest().body(Map.of("message", dup.getMessage()));
        }
    }

    @PostMapping("/local/login")
    public ResponseEntity<?> loginLocal(@RequestBody @Valid LoginReq req, HttpSession session) {
        return localAuth.login(req.getEmail().trim(), req.getPassword().trim())
                .<ResponseEntity<?>>map(u -> {
                    SessionUser su = new SessionUser("local", String.valueOf(u.getId()), u.getEmail(), u.getName(), u.getAvatar());
                    session.setAttribute("LOGIN_USER", su);
                    return ResponseEntity.ok(su);
                })
                .orElseGet(() -> ResponseEntity.status(401).body(Map.of("message", "잘못된 이메일 또는 비밀번호입니다.")));
    }

    // (선택) 비밀번호 변경 (로그인 필요)
    @PostMapping("/local/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String,String> body, HttpSession session) {
        SessionUser me = (SessionUser) session.getAttribute("LOGIN_USER");
        if (me == null || !"local".equals(me.provider())) {
            return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));
        }
        String current = body.getOrDefault("current","").trim();
        String next = body.getOrDefault("next","").trim();
        if (current.isBlank() || next.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message","현재/새 비밀번호를 모두 입력하세요."));
        }

        var u = userRepo.findById(Long.valueOf(me.providerId())).orElse(null);
        if (u == null || !org.springframework.security.crypto.bcrypt.BCrypt.checkpw(current, u.getPasswordHash())) {
            return ResponseEntity.status(400).body(Map.of("message","현재 비밀번호가 올바르지 않습니다."));
        }
        u.setPasswordHash(org.springframework.security.crypto.bcrypt.BCrypt.hashpw(next, org.springframework.security.crypto.bcrypt.BCrypt.gensalt(12)));
        userRepo.save(u);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ===== 비밀번호 찾기 / 재설정 =====
    @PostMapping("/local/forgot")
    public ResponseEntity<?> forgot(@RequestBody Map<String,String> body) {
        String email = (body.getOrDefault("email","")+"").trim();
        if (email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message","이메일을 입력하세요."));
        }

        var uOpt = passwordResetService.findUserByEmail(email);
        if (uOpt.isEmpty()) {
            // 보안상 200 을 주는 전략도 가능하지만 현재는 404
            return ResponseEntity.status(404).body(Map.of("message", "해당 이메일의 사용자가 없습니다."));
        }

        final String token;
        try {
            token = passwordResetService.issueToken(email);
        } catch (IllegalStateException tooSoon) {
            return ResponseEntity.status(429).body(Map.of("message", tooSoon.getMessage()));
        }

        String link = frontBase + "/#/reset-password?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
        mailService.sendPasswordReset(email, link);

        return ResponseEntity.ok(Map.of("ok", true));
    }

    // 구버전 호환
    @PostMapping("/local/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String,String> body) {
        return forgot(body);
    }

    @PostMapping("/local/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String,String> body) {
        String token = body.getOrDefault("token","").trim();
        String newPw = body.getOrDefault("password","").trim();
        if (token.isBlank() || newPw.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message","토큰/비밀번호가 필요합니다."));
        }

        var uOpt = passwordResetService.consumeTokenAndReset(token, newPw);
        if (uOpt.isEmpty()) {
            return ResponseEntity.status(400).body(Map.of("message","토큰이 유효하지 않거나 만료되었습니다."));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }
    @GetMapping("/oauth/link/consume")
    public ResponseEntity<?> consumeLink(@RequestParam String token, HttpSession session) {
        var opt = oauthService.consumeLinkToken(token);
        if (opt.isEmpty()) {
            return jsRedirect(frontBase + "/#/login-signup?link=invalid");
        }
        var u = opt.get();
        SessionUser su = new SessionUser("local-or-linked", String.valueOf(u.getId()), u.getEmail(), u.getName(), u.getAvatar());
        session.setAttribute("LOGIN_USER", su);
        return jsRedirect(frontBase + "/#/auth/callback");
    }

    // 구버전 호환
    @PostMapping("/local/reset")
    public ResponseEntity<?> reset(@RequestBody Map<String,String> body) {
        return resetPassword(body);
    }

    // ===== NAVER =====
    @Value("${naver.client-id:}") private String naverClientId;
    @Value("${naver.client-secret:}") private String naverClientSecret;
    @Value("${naver.redirect-uri:}") private String naverRedirectUri;

    // ===== GOOGLE =====
    @Value("${google.client-id:}") private String googleClientId;
    @Value("${google.client-secret:}") private String googleClientSecret;
    @Value("${google.redirect-uri:}") private String googleRedirectUri;

    // ===== KAKAO =====
    @Value("${kakao.client-id:}") private String kakaoClientId;
    @Value("${kakao.client-secret:}") private String kakaoClientSecret;
    @Value("${kakao.redirect-uri:}") private String kakaoRedirectUri;

    // ===== FACEBOOK =====
    @Value("${facebook.client-id:}") private String facebookClientId;
    @Value("${facebook.client-secret:}") private String facebookClientSecret;
    @Value("${facebook.redirect-uri:}") private String facebookRedirectUri;

    // FRONT (SPA 해시 라우팅 기준)
    @Value("${app.front-base:http://localhost:5173}")
    private String frontBase;

    private final SecureRandom secureRandom = new SecureRandom();
    private final RestTemplate rest = new RestTemplate();

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    /** 프론트로 JS 리다이렉트 (SPA 해시 라우팅 & 캐시 금지) */
    private ResponseEntity<?> jsRedirect(String to) {
        String html = "<!doctype html>"
                + "<meta http-equiv='Cache-Control' content='no-store'>"
                + "<title>Redirecting…</title>"
                + "<script>location.replace('" + to.replace("'", "\\'") + "');</script>";
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }

    /** 소셜 로그인 공통 처리: DB 연결(또는 생성) + 세션 저장 */
    private ResponseEntity<?> finishSocialLogin(
            HttpSession session,
            String provider, String providerId,
            String email, String name, String avatar,
            boolean emailVerified
    ) {
        // 1) provider+providerId로 이미 연결된 유저 있으면 사용
        Optional<UserAccount> linked = oauthService.findByProvider(provider, providerId);
        UserAccount u = linked.orElseGet(() ->
                // 2) 없으면: createUserAndLink 가 내부에서
                //    동일 이메일 계정이 있으면 그 계정에 연결, 없으면 새로 생성
                oauthService.createUserAndLink(email, name, avatar, provider, providerId, emailVerified)
        );

        // 3) 세션(프론트 호환을 위해 기존 형식 유지: provider/providerId 그대로 넣음)
        String displayName = (name != null && !name.isBlank()) ? name
                : (email != null && !email.isBlank() ? email.split("@")[0] : provider + "User");
        SessionUser su = new SessionUser(provider, providerId, u.getEmail(), displayName, avatar);
        session.setAttribute("LOGIN_USER", su);

        // 4) 프론트로 이동
        return jsRedirect(frontBase + "/#/auth/callback");
    }

    // ===================== NAVER =====================
    @GetMapping("/oauth/naver/start")
    public ResponseEntity<?> naverStart(HttpSession session) {
        if (isBlank(naverClientId) || isBlank(naverRedirectUri)) {
            return jsRedirect(frontBase + "/#/login-signup?err=naver_config");
        }
        String state = new BigInteger(130, secureRandom).toString(32);
        session.setAttribute("NAVER_OAUTH_STATE", state);

        String authUrl = UriComponentsBuilder
                .fromHttpUrl("https://nid.naver.com/oauth2.0/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", naverClientId)
                .queryParam("redirect_uri", naverRedirectUri)
                .queryParam("state", state)
                .encode()
                .toUriString();

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(authUrl)).build();
    }

    @GetMapping("/oauth/naver/callback")
    public ResponseEntity<?> naverCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDesc,
            HttpSession session
    ) {
        if (error != null) return jsRedirect(frontBase + "/#/login-signup?err=naver_" + error);
        if (isBlank(code) || isBlank(state)) return jsRedirect(frontBase + "/#/login-signup?err=missing_param");

        String saved = (String) session.getAttribute("NAVER_OAUTH_STATE");
        if (saved == null || !saved.equals(state)) return jsRedirect(frontBase + "/#/login-signup?err=state");
        session.removeAttribute("NAVER_OAUTH_STATE");

        String tokenUrl = UriComponentsBuilder
                .fromHttpUrl("https://nid.naver.com/oauth2.0/token")
                .queryParam("grant_type", "authorization_code")
                .queryParam("client_id", naverClientId)
                .queryParam("client_secret", naverClientSecret)
                .queryParam("code", code)
                .queryParam("state", state)
                .encode()
                .toUriString();

        NaverTokenResponse token = rest.getForObject(tokenUrl, NaverTokenResponse.class);
        if (token == null || token.access_token() == null) return jsRedirect(frontBase + "/#/login-signup?err=token");

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token.access_token());
        ResponseEntity<NaverProfileResponse> profRes = rest.exchange(
                "https://openapi.naver.com/v1/nid/me",
                HttpMethod.GET,
                new HttpEntity<>(h),
                NaverProfileResponse.class
        );
        NaverProfileResponse.Profile p = (profRes.getBody() != null) ? profRes.getBody().response : null;
        if (p == null) return jsRedirect(frontBase + "/#/login-signup?err=profile");

        // Naver는 이메일 제공 동의가 없으면 email 이 null 일 수 있음
        String email = p.email;
        String name = p.name;
        String avatar = p.profile_image;

        return finishSocialLogin(session, "naver", p.id, email, name, avatar, /*emailVerified*/ email != null);
    }

    // ===================== GOOGLE =====================
    @GetMapping("/oauth/google/start")
    public ResponseEntity<?> googleStart(HttpSession session) {
        if (isBlank(googleClientId) || isBlank(googleRedirectUri)) {
            return jsRedirect(frontBase + "/#/login-signup?err=google_config");
        }
        String state = new BigInteger(130, secureRandom).toString(32);
        session.setAttribute("GOOGLE_OAUTH_STATE", state);

        String authUrl = UriComponentsBuilder
                .fromHttpUrl("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("response_type", "code")
                .queryParam("client_id", googleClientId)
                .queryParam("redirect_uri", googleRedirectUri)
                .queryParam("scope", "openid email profile")
                .queryParam("include_granted_scopes", "true")
                .queryParam("state", state)
                .encode()
                .toUriString();

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(authUrl)).build();
    }

    @GetMapping("/oauth/google/callback")
    public ResponseEntity<?> googleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDesc,
            HttpSession session
    ) {
        if (error != null) return jsRedirect(frontBase + "/#/login-signup?err=google_" + error);
        if (isBlank(code) || isBlank(state)) return jsRedirect(frontBase + "/#/login-signup?err=missing_param");

        String saved = (String) session.getAttribute("GOOGLE_OAUTH_STATE");
        if (saved == null || !saved.equals(state)) return jsRedirect(frontBase + "/#/login-signup?err=state");
        session.removeAttribute("GOOGLE_OAUTH_STATE");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        org.springframework.util.MultiValueMap<String, String> form = new org.springframework.util.LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("client_id", googleClientId);
        form.add("client_secret", googleClientSecret);
        form.add("redirect_uri", googleRedirectUri);

        ResponseEntity<GoogleTokenResponse> tokenRes = rest.exchange(
                "https://oauth2.googleapis.com/token",
                HttpMethod.POST,
                new HttpEntity<>(form, headers),
                GoogleTokenResponse.class
        );
        GoogleTokenResponse token = tokenRes.getBody();
        if (token == null || token.access_token() == null) return jsRedirect(frontBase + "/#/login-signup?err=token");

        HttpHeaders h2 = new HttpHeaders();
        h2.setBearerAuth(token.access_token());
        ResponseEntity<GoogleUserInfo> userRes = rest.exchange(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                HttpMethod.GET,
                new HttpEntity<>(h2),
                GoogleUserInfo.class
        );
        GoogleUserInfo info = userRes.getBody();
        if (info == null || info.sub == null) return jsRedirect(frontBase + "/#/login-signup?err=profile");

        String email = info.email;          // 일반적으로 제공됨
        String name  = info.name;           // null 이면 후처리
        String avatar = info.picture;

        return finishSocialLogin(session, "google", info.sub, email, name, avatar, /*emailVerified*/ true);
    }

    // ===================== KAKAO =====================
    @GetMapping("/oauth/kakao/start")
    public ResponseEntity<?> kakaoStart(HttpSession session) {
        if (isBlank(kakaoClientId) || isBlank(kakaoRedirectUri)) {
            return jsRedirect(frontBase + "/#/login-signup?err=kakao_config");
        }
        String state = new BigInteger(130, secureRandom).toString(32);
        session.setAttribute("KAKAO_OAUTH_STATE", state);

        String authUrl = UriComponentsBuilder
                .fromHttpUrl("https://kauth.kakao.com/oauth/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", kakaoClientId)
                .queryParam("redirect_uri", kakaoRedirectUri)
                .queryParam("state", state)
                .queryParam("scope", "account_email profile_nickname profile_image")
                .encode()
                .toUriString();

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(authUrl)).build();
    }

    @GetMapping("/oauth/kakao/callback")
    public ResponseEntity<?> kakaoCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription,
            HttpSession session
    ) {
        if (error != null) return jsRedirect(frontBase + "/#/login-signup?err=kakao_" + error);
        if (isBlank(code)) return jsRedirect(frontBase + "/#/login-signup?err=missing_code");

        String saved = (String) session.getAttribute("KAKAO_OAUTH_STATE");
        if (saved == null || (state != null && !saved.equals(state))) return jsRedirect(frontBase + "/#/login-signup?err=state");
        session.removeAttribute("KAKAO_OAUTH_STATE");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        org.springframework.util.MultiValueMap<String, String> form = new org.springframework.util.LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", kakaoClientId);
        if (!isBlank(kakaoClientSecret)) form.add("client_secret", kakaoClientSecret);
        form.add("redirect_uri", kakaoRedirectUri);
        form.add("code", code);

        ResponseEntity<KakaoTokenResponse> tokenRes = rest.exchange(
                "https://kauth.kakao.com/oauth/token",
                HttpMethod.POST,
                new HttpEntity<>(form, headers),
                KakaoTokenResponse.class
        );
        KakaoTokenResponse token = tokenRes.getBody();
        if (token == null || token.access_token == null) return jsRedirect(frontBase + "/#/login-signup?err=token");

        HttpHeaders h2 = new HttpHeaders();
        h2.setBearerAuth(token.access_token);
        ResponseEntity<KakaoUserResponse> ures = rest.exchange(
                "https://kapi.kakao.com/v2/user/me",
                HttpMethod.GET,
                new HttpEntity<>(h2),
                KakaoUserResponse.class
        );
        KakaoUserResponse ku = ures.getBody();
        if (ku == null || ku.id == null) return jsRedirect(frontBase + "/#/login-signup?err=profile");

        String email = null, name = null, avatar = null;
        if (ku.kakao_account != null) {
            email = ku.kakao_account.email;
            if (ku.kakao_account.profile != null) {
                name = ku.kakao_account.profile.nickname;
                avatar = ku.kakao_account.profile.profile_image_url;
            }
        }

        return finishSocialLogin(session, "kakao", String.valueOf(ku.id), email, name, avatar, /*emailVerified*/ email != null);
    }

    // ===================== FACEBOOK =====================
    @GetMapping("/oauth/facebook/start")
    public ResponseEntity<?> facebookStart(HttpSession session) {
        if (isBlank(facebookClientId) || isBlank(facebookRedirectUri)) {
            return jsRedirect(frontBase + "/#/login-signup?err=facebook_config");
        }

        String state = new BigInteger(130, secureRandom).toString(32);
        session.setAttribute("FACEBOOK_OAUTH_STATE", state);

        String authUrl = UriComponentsBuilder
                .fromHttpUrl("https://www.facebook.com/v19.0/dialog/oauth")
                .queryParam("client_id", facebookClientId)
                .queryParam("redirect_uri", facebookRedirectUri)
                .queryParam("state", state)
                .queryParam("response_type", "code")
                .queryParam("scope", "email,public_profile")
                .encode().toUriString();

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(authUrl)).build();
    }

    @GetMapping("/oauth/facebook/callback")
    public ResponseEntity<?> facebookCallback(
            @RequestParam(required=false) String code,
            @RequestParam(required=false) String state,
            @RequestParam(required=false, name="error") String error,
            @RequestParam(required=false, name="error_description") String errorDesc,
            HttpSession session
    ) {
        if (error != null) {
            return jsRedirect(frontBase + "/#/login-signup?err=facebook_" + error);
        }
        if (isBlank(code)) {
            return jsRedirect(frontBase + "/#/login-signup?err=missing_code");
        }
        String saved = (String) session.getAttribute("FACEBOOK_OAUTH_STATE");
        if (saved == null || (state != null && !saved.equals(state))) {
            return jsRedirect(frontBase + "/#/login-signup?err=state");
        }
        session.removeAttribute("FACEBOOK_OAUTH_STATE");

        String tokenUrl = UriComponentsBuilder
                .fromHttpUrl("https://graph.facebook.com/v19.0/oauth/access_token")
                .queryParam("client_id", facebookClientId)
                .queryParam("redirect_uri", facebookRedirectUri)
                .queryParam("client_secret", facebookClientSecret)
                .queryParam("code", code)
                .encode().toUriString();

        ResponseEntity<FacebookTokenResponse> tokenRes =
                rest.getForEntity(tokenUrl, FacebookTokenResponse.class);
        FacebookTokenResponse token = tokenRes.getBody();
        if (token == null || token.access_token == null) {
            return jsRedirect(frontBase + "/#/login-signup?err=token");
        }

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token.access_token);
        ResponseEntity<FacebookMe> meRes = rest.exchange(
                "https://graph.facebook.com/v19.0/me?fields=id,name,email,picture",
                HttpMethod.GET,
                new HttpEntity<>(h),
                FacebookMe.class
        );
        FacebookMe me = meRes.getBody();
        if (me == null || isBlank(me.id)) {
            return jsRedirect(frontBase + "/#/login-signup?err=profile");
        }

        String email = me.email; // null 일 수 있음
        String name  = (me.name != null ? me.name : null);
        String avatar = (me.picture != null && me.picture.data != null) ? me.picture.data.url : null;

        return finishSocialLogin(session, "facebook", me.id, email, name, avatar, /*emailVerified*/ email != null);
    }

    // ===================== COMMON =====================
    @GetMapping("/debug/props")
    public Map<String, String> debugProps() {
        return Map.of(
                "naver.client-id", naverClientId == null ? "" : naverClientId,
                "naver.redirect-uri", naverRedirectUri == null ? "" : naverRedirectUri,
                "google.client-id", googleClientId == null ? "" : googleClientId,
                "google.redirect-uri", googleRedirectUri == null ? "" : googleRedirectUri,
                "kakao.client-id", kakaoClientId == null ? "" : kakaoClientId,
                "kakao.redirect-uri", kakaoRedirectUri == null ? "" : kakaoRedirectUri,
                "facebook.client-id", facebookClientId == null ? "" : facebookClientId,
                "facebook.redirect-uri", facebookRedirectUri == null ? "" : facebookRedirectUri,
                "app.front-base", frontBase == null ? "" : frontBase
        );
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpSession session) {
        SessionUser u = (SessionUser) session.getAttribute("LOGIN_USER");
        if (u == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .cacheControl(CacheControl.noStore())
                .body(Map.of("message", "unauthenticated"));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(u);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpSession session) {
        SessionUser u = (SessionUser) session.getAttribute("LOGIN_USER");
        if (u == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .cacheControl(CacheControl.noStore())
                .body(Map.of("message", "unauthenticated"));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(Map.of("user", u));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        try { session.invalidate(); } catch (Exception ignored) {}

        ResponseCookie expired = ResponseCookie.from("JSESSIONID", "")
                .path("/")
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .maxAge(0)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expired.toString())
                .body(Map.of("ok", true));
    }
}
