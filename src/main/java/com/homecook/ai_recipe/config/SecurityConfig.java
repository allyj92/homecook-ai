package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
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
    private String frontBase; // e.g. https://recipfree.com

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
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    /** 로그인 성공 시: 세션 보장 + refresh_token 즉시 발급 */
    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            request.getSession(true); // RFSESSIONID 보장

            String issued = UUID.randomUUID().toString();
            ResponseCookie cookie = ResponseCookie.from("refresh_token", issued)
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("Lax")
                    // 리버스 프록시로 응답이 recipfree.com 도메인에서 내려온다면 아래 도메인 설정 유지,
                    // 그렇지 않다면 .domain()은 제거하세요.
                    .domain(".recipfree.com")
                    .maxAge(Duration.ofDays(30))
                    .build();

            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
            System.out.println("[AUTH] successHandler: Set-Cookie refresh_token issued=" + issued.substring(0, 8));

            response.setStatus(302);
            response.setHeader("Location", frontBase + "/auth/callback?ok=1");
        };
    }

    @Bean
    public AuthenticationFailureHandler failureHandler() {
        return (request, response, ex) -> {
            String msg = java.net.URLEncoder.encode(
                    ex.getMessage() == null ? "login_failed" : ex.getMessage(),
                    java.nio.charset.StandardCharsets.UTF_8
            );
            response.setStatus(302);
            response.setHeader("Location", frontBase + "/auth/callback?error=" + msg);
        };
    }

    /** 프록시 헤더 신뢰 (prod에서 권장) */
    @Bean
    @Profile("prod")
    public org.springframework.web.filter.ForwardedHeaderFilter forwardedHeaderFilter() {
        return new org.springframework.web.filter.ForwardedHeaderFilter();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           SecurityContextRepository repo,
                                           AuthenticationSuccessHandler successHandler,
                                           AuthenticationFailureHandler failureHandler) throws Exception {

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .securityContext(sc -> sc.securityContextRepository(repo))
                .authorizeHttpRequests(auth -> auth
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
                .logout(Customizer.withDefaults());

        return http.build();
    }
}