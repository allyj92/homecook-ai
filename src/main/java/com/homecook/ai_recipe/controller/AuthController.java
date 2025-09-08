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
            boolean bootstrap = (refreshToken == null || refreshToken.isBlank());

            // 선택: 도메인 쿠키 쓸지 여부 (둘 중 하나만 사용 권장)
            final boolean USE_DOMAIN_COOKIE = true; // 필요 시 false 로 바꿔 host-only 통일
            String cookieDomain = USE_DOMAIN_COOKIE ? ".recipfree.com" : null;

            // 0) 혹시 남아있을 수 있는 JSESSIONID 정리(호스트/도메인 모두)
            response.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID","")
                            .httpOnly(true).secure(true)
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(0)
                            .build().toString());
            response.addHeader(HttpHeaders.SET_COOKIE,
                    ResponseCookie.from("JSESSIONID","")
                            .httpOnly(true).secure(true)
                            .path("/")
                            .sameSite("Lax")
                            .maxAge(0)
                            .domain(".recipfree.com")
                            .build().toString());

            // 1) 사용자 속성 구성 (email, picture 포함)
            Map<String, Object> attrs = new LinkedHashMap<>();
            if (bootstrap) {
                String devId = "dev:" + UUID.randomUUID().toString().substring(0, 8);
                attrs.put("id", devId);
                attrs.put("name", "DevUser");
                attrs.put("provider", "bootstrap");
                attrs.put("email", "devuser@" + "recipfree.com");
                attrs.put("picture", "https://picsum.photos/seed/" + devId.replace(":","_") + "/200/200");
            } else {
                String shortRf = "rf:" + refreshToken.substring(0, Math.min(8, refreshToken.length()));
                attrs.put("id", shortRf);
                attrs.put("name", "SessionUser");
                attrs.put("provider", "refresh");
                // refresh 기반일 때도 기본값 채워서 프론트 표시 정상화
                attrs.put("email", shortRf.replace(":", "_") + "@recipfree.com");
                attrs.put("picture", "https://picsum.photos/seed/" + shortRf.replace(":","_") + "/200/200");
            }

            var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var principal   = new DefaultOAuth2User(new HashSet<>(authorities), attrs, "id");
            var auth        = new UsernamePasswordAuthenticationToken(principal, null, authorities);

            // 2) 세션 생성 (JSESSIONID는 컨테이너가 발급)
            request.getSession(true);

            // 3) SecurityContext 저장
            var ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);
            securityContextRepository.saveContext(ctx, request, response);

            // 4) refresh_token 갱신(옵션)
            String newRefresh = bootstrap ? ("DEV_REFRESH_" + UUID.randomUUID()) : "NEW_REFRESH_TOKEN";

// cookieDomain 값이 비어있을 수도 있으니 안전 체크
            boolean hasDomain = (cookieDomain != null && !cookieDomain.isBlank());

// 빌더는 이 타입으로!
            ResponseCookie.ResponseCookieBuilder rfBuilder = ResponseCookie.from("refresh_token", newRefresh)
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("Lax")              // Spring 6.x/Boot 3.x에서도 String 받습니다.
                    .maxAge(Duration.ofDays(30));

            if (hasDomain) {
                rfBuilder.domain(cookieDomain);  // 반드시 build() 전에 호출
            }

// 마지막에만 build()
            response.addHeader(HttpHeaders.SET_COOKIE, rfBuilder.build().toString());

            return ResponseEntity.ok(Map.of(
                    "user", Map.copyOf(attrs),
                    "bootstrap", bootstrap
            ));
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
