package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.context.*;
import org.springframework.web.cors.*;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;

    @Value("${app.front-base}")
    private String frontBase; // ex) https://recipfree.com or http://localhost:5173

    /** AuthController에서 주입받을 SecurityContextRepository 빈 */
    @Bean
    public SecurityContextRepository securityContextRepository() {
        HttpSessionSecurityContextRepository sessionRepo = new HttpSessionSecurityContextRepository();
        sessionRepo.setDisableUrlRewriting(true); // ;JSESSIONID 방지
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(),
                sessionRepo
        );
    }

    /** CORS 설정 */
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

    /** 로그인 성공: 세션 보장 + refresh_token 발급 + 프론트로 리다이렉트 */
    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            // 세션 보장 (JSESSIONID 발급)
            request.getSession(true);

            // 도메인 결정: 배포 도메인일 때만 domain=.recipfree.com 지정
            String cookieDomain = null;
            try {
                String host = new URI(frontBase).getHost();
                if (host != null && host.endsWith("recipfree.com")) {
                    cookieDomain = ".recipfree.com";
                }
            } catch (Exception ignored) { /* 로컬 등 파싱 실패 시 host-only */ }

            String issued = UUID.randomUUID().toString();
            ResponseCookie cookie = ResponseCookie.from("refresh_token", issued)  // ⬅️ 여기서부터 builder 반환
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("Lax")
                    .maxAge(Duration.ofDays(30))
                    .build();


            // 프론트 콜백으로 리다이렉트
            response.sendRedirect(frontBase + "/auth/callback?ok=1");
        };
    }

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

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            SecurityContextRepository repo,
            AuthenticationSuccessHandler successHandler,
            AuthenticationFailureHandler failureHandler
    ) throws Exception {

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .securityContext(sc -> sc.securityContextRepository(repo))

                // ✅ 익명 접근 시 /login 리다이렉트 금지, 401 JSON으로 응답
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

                // ✅ SavedRequest 비활성화 (302 리다이렉트 유발 방지)
                .requestCache(rc -> rc.disable())

                .authorizeHttpRequests(auth -> auth
                        // 인증 필요 구간
                        .requestMatchers("/api/me/**").authenticated()
                        // 인증 없이 허용
                        .requestMatchers(
                                "/api/auth/**",
                                "/oauth2/authorization/**",
                                "/login/oauth2/code/**"
                        ).permitAll()
                        .anyRequest().permitAll()
                )

                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(u -> u.userService(customOAuth2UserService))
                        .successHandler(successHandler)
                        .failureHandler(failureHandler)
                )

                // ✅ /api/auth/logout 등에서 204/200만 돌려주도록 (리다이렉트 없음)
                .logout(lo -> lo
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler((req, res, auth) -> res.setStatus(200))
                );

        return http.build();
    }
}
