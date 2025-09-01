// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;

@Configuration
@EnableMethodSecurity
@Profile("!test") // 테스트 프로필에선 보안설정 제외
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;

    @Value("${app.front-base}")
    private String frontBase; // ex) https://recipfree.com

    public SecurityConfig(CustomOAuth2UserService customOAuth2UserService) {
        this.customOAuth2UserService = customOAuth2UserService;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)) // ★ 필요 시 세션 생성
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/community/posts/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/community/posts").authenticated()
                        .anyRequest().permitAll()
                )
                .oauth2Login(o -> o
                        .userInfoEndpoint(u -> u.userService(customOAuth2UserService))
                        .successHandler(successHandler())
                        .failureHandler(failureHandler())
                )
                .formLogin(f -> f.disable())
                .httpBasic(b -> b.disable());
        return http.build();
    }



    /** 운영: 정확한 오리진만 허용 (credentials=true와 '*' 조합 금지) */
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



    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            request.getSession(true); // ★ 세션 확실히 생성

            // refresh_token 쿠키 세팅 (생략)
            response.sendRedirect(frontBase + "/auth/callback?ok=1");
        };
    }

    /** 로그인 실패 시: 프론트 콜백으로 에러 전달 */
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

    /** 프록시 환경에서 X-Forwarded-* 헤더 처리 보강 (prod에서만) */
    @Bean
    @Profile("prod")
    public org.springframework.web.filter.ForwardedHeaderFilter forwardedHeaderFilter() {
        return new org.springframework.web.filter.ForwardedHeaderFilter();
    }
}
