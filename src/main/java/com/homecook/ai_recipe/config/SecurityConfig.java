// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.auth.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.authority.mapping.GrantedAuthoritiesMapper;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.net.URI;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2UserService<OidcUserRequest, OidcUser> customOidcUserService;

    @Value("${app.front-base}")
    private String frontBase; // e.g. https://recipfree.com or http://localhost:5173

    /** ROLE_USER를 항상 보강 */
    @Bean
    public GrantedAuthoritiesMapper userAuthoritiesMapper() {
        return authorities -> {
            Set<GrantedAuthority> set = new HashSet<>(authorities);
            set.add(new SimpleGrantedAuthority("ROLE_USER"));
            return set;
        };
    }

    /** AuthController 등에서 사용할 SecurityContext 저장소 */
    @Bean
    public SecurityContextRepository securityContextRepository() {
        HttpSessionSecurityContextRepository sessionRepo = new HttpSessionSecurityContextRepository();
        sessionRepo.setDisableUrlRewriting(true); // ;JSESSIONID 방지
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(),
                sessionRepo
        );
    }

    /** CORS */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of(
                "https://recipfree.com",
                "https://www.recipfree.com",
                "http://localhost:*",
                "http://127.0.0.1:*"
        ));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    /** 프록시 헤더 신뢰 (prod에서 권장) */
    @Bean
    @Profile("prod")
    public org.springframework.web.filter.ForwardedHeaderFilter forwardedHeaderFilter() {
        return new org.springframework.web.filter.ForwardedHeaderFilter();
    }

    /** OAuth2 로그인 성공 핸들러: 세션 보장 + refresh_token 쿠키 발급 + 프론트로 리다이렉트 */
    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            // 세션 보장 (JSESSIONID 발급)
            request.getSession(true);

            // 배포 도메인일 때만 쿠키 도메인 지정
            String cookieDomain = null;
            try {
                String host = new URI(frontBase).getHost();
                if (host != null && host.endsWith("recipfree.com")) {
                    cookieDomain = ".recipfree.com";
                }
            } catch (Exception ignored) { }

            // refresh_token(예시) 쿠키 생성 — 실제 토큰 로직은 필요에 맞게 교체
            String issued = UUID.randomUUID().toString();
            ResponseCookie cookie = ResponseCookie
                    .from("refresh_token", issued)   // ✅ builder()가 아니라 from()
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("None")                // Lax / Strict / None
                    .maxAge(Duration.ofDays(30))
                    .domain(cookieDomain)            // 필요할 때만
                    .build();

            // ⬅️ 실제로 Set-Cookie 헤더에 실어 내려보내기
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

            // 프론트 콜백으로 리다이렉트
            response.sendRedirect(frontBase + "/auth/callback?ok=1");
        };
    }

    /** OAuth2 로그인 실패 핸들러 */
    @Bean
    public AuthenticationFailureHandler failureHandler() {
        return (request, response, ex) -> {
            String msg = java.net.URLEncoder.encode(
                    ex.getMessage() == null ? "login_failed" : ex.getMessage(),
                    java.nio.charset.StandardCharsets.UTF_8
            );
            response.sendRedirect(frontBase + "/auth/callback?error=" + msg);
        };
    }

    /** Spring Security 6 스타일의 유일한 보안 설정 (구버전 configure 메서드 제거) */
    @Bean
    public SecurityFilterChain filterChain(
            org.springframework.security.config.annotation.web.builders.HttpSecurity http,
            SecurityContextRepository repo,
            AuthenticationSuccessHandler successHandler,
            AuthenticationFailureHandler failureHandler
    ) throws Exception {

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .securityContext(sc -> sc.securityContextRepository(repo))

                // 익명 접근 시 401 JSON 응답
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> {
                            res.setStatus(401);
                            res.setContentType("application/json;charset=UTF-8");
                            res.getWriter().write("{\"authenticated\":false}");
                        })
                        .accessDeniedHandler((req, res, e) -> {
                            res.setStatus(403);
                            res.setContentType("application/json;charset=UTF-8");
                            res.getWriter().write("{\"error\":\"forbidden\"}");
                        })
                )

                // SavedRequest 비활성화 (302 방지)
                .requestCache(rc -> rc.disable())

                .authorizeHttpRequests(auth -> auth
                        // 정적/루트 허용
                        .requestMatchers("/", "/index.html", "/assets/**", "/favicon.ico").permitAll()
                        // 인증 API
                        .requestMatchers("/api/auth/**", "/oauth2/authorization/**", "/login/oauth2/code/**").permitAll()
                        // 마이페이지/즐겨찾기 등 보호
                        .requestMatchers("/api/me/**").authenticated()
                        .anyRequest().permitAll()
                )

                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(u -> u
                                .userService(customOAuth2UserService)   // OAuth2 (네이버/카카오)
                                .oidcUserService(customOidcUserService) // OIDC (구글)
                                .userAuthoritiesMapper(userAuthoritiesMapper())
                        )
                        .successHandler(successHandler)
                        .failureHandler(failureHandler)
                );

        return http.build();
    }
}
