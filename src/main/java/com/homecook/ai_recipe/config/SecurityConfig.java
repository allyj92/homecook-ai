// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.sequrity.RefreshCookieAuthFilter;
import com.homecook.ai_recipe.service.CustomOAuth2UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
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

    /** 세션 기반 보안컨텍스트 저장소를 명시적으로 등록 */
    @Bean
    public SecurityContextRepository securityContextRepository() {
        // JSESSIONID 세션에 SecurityContext를 저장/복원해 주는 기본 구현
        var repo = new HttpSessionSecurityContextRepository();
        // 필요 시: repo.setSpringSecurityContextKey("SPRING_SECURITY_CONTEXT");
        return repo;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers("/api/auth/**", "/oauth2/**", "/login/oauth2/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth -> {})   // 필요 시
                .logout(lo -> lo.logoutUrl("/api/auth/logout").permitAll());

        // ★ 매 요청마다 refresh_token 쿠키로 인증 세팅
        http.addFilterBefore(new RefreshCookieAuthFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** CORS: credentials 사용 시 오리진은 패턴/명시값으로만 */
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

    /** OAuth2 로그인 성공: 세션 보장 + (원하면 refresh 쿠키 발급) + 프론트로 리다이렉트 */
    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            // 세션 없으면 생성해서 JSESSIONID 발급
            request.getSession(true);

            // (선택) refresh_token 운영 시 발급
            // ResponseCookie refresh = ResponseCookie.from("refresh_token", "NEW_REFRESH_TOKEN")
            //     .httpOnly(true).secure(true)
            //     .domain(".recipfree.com") // 도메인 공유가 필요하면 사용, 아니면 제거
            //     .path("/").sameSite("Lax")
            //     .maxAge(Duration.ofDays(30)).build();
            // response.addHeader(HttpHeaders.SET_COOKIE, refresh.toString());

            response.sendRedirect(frontBase + "/auth/callback?ok=1");
        };
    }

    /** OAuth2 로그인 실패: 에러를 프론트 콜백으로 */
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

    /** 리버스 프록시(X-Forwarded-*) 환경 보정 */
    @Bean
    @Profile("prod")
    public org.springframework.web.filter.ForwardedHeaderFilter forwardedHeaderFilter() {
        return new org.springframework.web.filter.ForwardedHeaderFilter();
    }


}
