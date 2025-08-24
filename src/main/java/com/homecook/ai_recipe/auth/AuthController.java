package com.homecook.ai_recipe.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpSession;
import java.math.BigInteger;
import java.net.URI;
import java.security.SecureRandom;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // ===== NAVER =====
    @Value("${naver.client-id:}")
    private String naverClientId;

    @Value("${naver.client-secret:}")
    private String naverClientSecret;

    @Value("${naver.redirect-uri:}")
    private String naverRedirectUri;

    // ===== GOOGLE =====
    @Value("${google.client-id:}")
    private String googleClientId;

    @Value("${google.client-secret:}")
    private String googleClientSecret;

    @Value("${google.redirect-uri:}")
    private String googleRedirectUri;

    // ===== KAKAO =====
    @Value("${kakao.client-id:}")
    private String kakaoClientId;   // REST API 키

    @Value("${kakao.client-secret:}")
    private String kakaoClientSecret; // 콘솔에서 비활성인 경우 비워둬도 됨

    @Value("${kakao.redirect-uri:}")
    private String kakaoRedirectUri;

    // FRONT
    @Value("${app.front-base:http://localhost:5173}")
    private String frontBase;

    private final SecureRandom secureRandom = new SecureRandom();
    private final RestTemplate rest = new RestTemplate();

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    // ===================== NAVER =====================
    @GetMapping("/oauth/naver/start")
    public ResponseEntity<Void> naverStart(HttpSession session) {
        if (isBlank(naverClientId) || isBlank(naverRedirectUri)) {
            // 환경변수 미주입/오타 시 여기서 차단 (client_id= 비어있는 리다이렉트 방지)
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=naver_config"))
                    .build();
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

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(authUrl))
                .build();
    }

    @GetMapping("/oauth/naver/callback")
    public ResponseEntity<Void> naverCallback(
            @RequestParam String code,
            @RequestParam String state,
            HttpSession session
    ) {
        String saved = (String) session.getAttribute("NAVER_OAUTH_STATE");
        if (saved == null || !saved.equals(state)) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=state"))
                    .build();
        }
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
        if (token == null || token.access_token() == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=token"))
                    .build();
        }

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token.access_token());
        ResponseEntity<NaverProfileResponse> profRes = rest.exchange(
                "https://openapi.naver.com/v1/nid/me",
                HttpMethod.GET,
                new HttpEntity<>(h),
                NaverProfileResponse.class
        );
        NaverProfileResponse.Profile p =
                (profRes.getBody() != null) ? profRes.getBody().response : null;

        if (p == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=profile"))
                    .build();
        }

        SessionUser user = new SessionUser(
                "naver",
                p.id,
                p.email,
                p.name,
                p.profile_image
        );
        session.setAttribute("LOGIN_USER", user);

        String to = frontBase + "/#/auth/callback";
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(to))
                .build();
    }

    // ===================== GOOGLE =====================
    @GetMapping("/oauth/google/start")
    public ResponseEntity<Void> googleStart(HttpSession session) {
        if (isBlank(googleClientId) || isBlank(googleRedirectUri)) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=google_config"))
                    .build();
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
                // .queryParam("access_type", "offline") // 리프레시 토큰 필요 시 주석 해제
                // .queryParam("prompt", "consent")      // 강제 동의 갱신 필요 시
                .queryParam("state", state)
                .encode()
                .toUriString();

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(authUrl))
                .build();
    }

    @GetMapping("/oauth/google/callback")
    public ResponseEntity<Void> googleCallback(
            @RequestParam String code,
            @RequestParam String state,
            HttpSession session
    ) {
        String saved = (String) session.getAttribute("GOOGLE_OAUTH_STATE");
        if (saved == null || !saved.equals(state)) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=state"))
                    .build();
        }
        session.removeAttribute("GOOGLE_OAUTH_STATE");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        org.springframework.util.MultiValueMap<String, String> form =
                new org.springframework.util.LinkedMultiValueMap<>();
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
        if (token == null || token.access_token() == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=token"))
                    .build();
        }

        HttpHeaders h2 = new HttpHeaders();
        h2.setBearerAuth(token.access_token());
        ResponseEntity<GoogleUserInfo> userRes = rest.exchange(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                HttpMethod.GET,
                new HttpEntity<>(h2),
                GoogleUserInfo.class
        );
        GoogleUserInfo info = userRes.getBody();
        if (info == null || info.sub == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=profile"))
                    .build();
        }

        SessionUser user = new SessionUser(
                "google",
                info.sub,
                info.email,
                (info.name != null ? info.name : (info.email != null ? info.email.split("@")[0] : "GoogleUser")),
                info.picture
        );
        session.setAttribute("LOGIN_USER", user);

        String to = frontBase + "/#/auth/callback";
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(to))
                .build();
    }

    // ===================== KAKAO =====================
    @GetMapping("/oauth/kakao/start")
    public ResponseEntity<Void> kakaoStart(HttpSession session) {
        if (isBlank(kakaoClientId) || isBlank(kakaoRedirectUri)) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=kakao_config"))
                    .build();
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

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(authUrl))
                .build();
    }

    @GetMapping("/oauth/kakao/callback")
    public ResponseEntity<Void> kakaoCallback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            HttpSession session
    ) {
        String saved = (String) session.getAttribute("KAKAO_OAUTH_STATE");
        if (saved == null || (state != null && !saved.equals(state))) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=state"))
                    .build();
        }
        session.removeAttribute("KAKAO_OAUTH_STATE");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        org.springframework.util.MultiValueMap<String, String> form =
                new org.springframework.util.LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", kakaoClientId);
        if (!isBlank(kakaoClientSecret)) {
            form.add("client_secret", kakaoClientSecret);
        }
        form.add("redirect_uri", kakaoRedirectUri);
        form.add("code", code);

        ResponseEntity<KakaoTokenResponse> tokenRes = rest.exchange(
                "https://kauth.kakao.com/oauth/token",
                HttpMethod.POST,
                new HttpEntity<>(form, headers),
                KakaoTokenResponse.class
        );
        KakaoTokenResponse token = tokenRes.getBody();
        if (token == null || token.access_token() == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=token"))
                    .build();
        }

        HttpHeaders h2 = new HttpHeaders();
        h2.setBearerAuth(token.access_token());
        ResponseEntity<KakaoUserResponse> ures = rest.exchange(
                "https://kapi.kakao.com/v2/user/me",
                HttpMethod.GET,
                new HttpEntity<>(h2),
                KakaoUserResponse.class
        );
        KakaoUserResponse ku = ures.getBody();
        if (ku == null || ku.id == null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontBase + "/#/login-signup?err=profile"))
                    .build();
        }

        String email = null, name = null, avatar = null;
        if (ku.kakao_account != null) {
            email = ku.kakao_account.email;
            if (ku.kakao_account.profile != null) {
                name = ku.kakao_account.profile.nickname;
                avatar = ku.kakao_account.profile.profile_image_url;
            }
        }
        if (name == null) name = "KakaoUser";

        SessionUser user = new SessionUser(
                "kakao",
                String.valueOf(ku.id),
                email,
                name,
                avatar
        );
        session.setAttribute("LOGIN_USER", user);

        String to = frontBase + "/#/auth/callback";
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(to))
                .build();
    }

    // ===================== COMMON =====================
    @GetMapping("/debug/props")
    public Map<String, String> debugProps() {
        // secret은 표시하지 않음
        return Map.of(
                "naver.client-id", naverClientId == null ? "" : naverClientId,
                "naver.redirect-uri", naverRedirectUri == null ? "" : naverRedirectUri,
                "google.client-id", googleClientId == null ? "" : googleClientId,
                "google.redirect-uri", googleRedirectUri == null ? "" : googleRedirectUri,
                "kakao.client-id", kakaoClientId == null ? "" : kakaoClientId,
                "kakao.redirect-uri", kakaoRedirectUri == null ? "" : kakaoRedirectUri,
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

        // 운영 배포 기준: secure=true, SameSite=None 유지 (크로스도메인 세션)
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

    // ===== DTOs =====
    public record NaverTokenResponse(
            String access_token,
            String refresh_token,
            String token_type,
            String expires_in,
            String error,
            String error_description
    ) {}

    public static class NaverProfileResponse {
        public String resultcode;
        public String message;
        public Profile response;

        public static class Profile {
            public String id;
            public String email;
            public String name;
            public String profile_image;
        }
    }

    public record GoogleTokenResponse(
            String access_token,
            String expires_in,
            String refresh_token,
            String scope,
            String token_type,
            String id_token
    ) {}

    public static class GoogleUserInfo {
        public String sub;
        public String email;
        public Boolean email_verified;
        public String name;
        public String given_name;
        public String family_name;
        public String picture;
        public String locale;
    }

    public static class KakaoTokenResponse {
        public String access_token;
        public String token_type;
        public Integer expires_in;
        public String refresh_token;
        public Integer refresh_token_expires_in;
        public String scope;
    }

    public static class KakaoUserResponse {
        public Long id;
        public KakaoAccount kakao_account;

        public static class KakaoAccount {
            public String email;
            public Boolean is_email_valid;
            public Boolean is_email_verified;
            public KakaoProfile profile;
        }
        public static class KakaoProfile {
            public String nickname;
            public String thumbnail_image_url;
            public String profile_image_url;
        }
    }

    public record SessionUser(
            String provider,
            String providerId,
            String email,
            String name,
            String avatar
    ) {}
}
