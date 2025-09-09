// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

// 🔧 오타 수정: sequrity ❌ → security ✅
import com.homecook.ai_recipe.security.RefreshCookieAuthFilter;

import com.homecook.ai_recipe.service.CustomOAuth2UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.cors.*;

import java.time.Duration;
import java.util.List;
import java.util.UUID; // 🔧 추가

@Configuration
@EnableMethodSecurity
@Profile("!test")
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;

    @Value("${app.front-base}")
    private String frontBase; // ex) https://recipfree.com

    public SecurityConfig(CustomOAuth2UserService customOAuth2UserService) {
        this.customOAuth2UserService = customOAuth2UserService;
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers(
                                "/api/auth/**",
                                "/oauth2/**",
                                "/login/oauth2/**",
                                "/api/auth/debug/**"   // ★ 추가: 디버그 엔드포인트 허용
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                // ✅ 세션/컨텍스트 저장소 명시
                .securityContext(sc -> sc.securityContextRepository(securityContextRepository()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(u -> u.userService(customOAuth2UserService))
                        .successHandler(successHandler())     // ✅ 반드시 연결
                        .failureHandler(failureHandler())
                )
                .logout(lo -> lo.logoutUrl("/api/auth/logout").permitAll());

        // ✅ repo 주입해서 컨텍스트 save 되도록
        http.addFilterBefore(
                new RefreshCookieAuthFilter(securityContextRepository()),
                UsernamePasswordAuthenticationFilter.class
        );

        return http.build();
    }

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

    /** ✅ 로그인 성공 시: 세션 보장 + refresh_token 즉시 발급(도메인 지정 금지, SameSite=None) */
    // SecurityConfig.java
    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            request.getSession(true); // RFSESSIONID 보장

            String issued = java.util.UUID.randomUUID().toString();
            var cookie = ResponseCookie.from("refresh_token", issued)
                    .httpOnly(true).secure(true).path("/")
                    .sameSite("Lax")                     // domain 지정 금지
                    .maxAge(java.time.Duration.ofDays(30))
                    .build();

            response.addHeader(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString());

            // 🔎 디버그 로그
            System.out.println("[AUTH] successHandler: Set-Cookie refresh_token issued=" + issued.substring(0,8));

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
    @Profile("prod")
    public org.springframework.web.filter.ForwardedHeaderFilter forwardedHeaderFilter() {
        return new org.springframework.web.filter.ForwardedHeaderFilter();
    }
}
