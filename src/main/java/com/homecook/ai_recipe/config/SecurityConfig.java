package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
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
@Profile("!test") // 테스트 프로필에선 이 구성 제외
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
                .authorizeHttpRequests(auth -> auth
                        // OAuth 시작/콜백 공개
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        // 커뮤니티
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

    /** 운영: 오리진을 명시. credentials=true와 '*'는 절대 함께 쓰지 말 것 */
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

    /** 로그인 성공 시: refresh 쿠키 발급 + 프론트로 리다이렉트 */
    @Bean
    public AuthenticationSuccessHandler successHandler() {
        return (request, response, authentication) -> {
            // TODO: 실제 리프레시 토큰 생성 로직으로 교체하세요.
            String refreshToken = "NEW_REFRESH_TOKEN";

            ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", refreshToken)
                    .httpOnly(true)
                    .secure(true)
                    .domain(".recipfree.com")
                    .path("/")
                    .sameSite("Lax") // cross-site 필요하면 "None"
                    .maxAge(Duration.ofDays(30))
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());

            // 프론트 콜백 라우트로 이동 (필요 파라미터 추가 가능)
            response.sendRedirect(frontBase + "/auth/callback?ok=1");
        };
    }

    /** 로그인 실패 시: 프론트로 에러 전달 */
    @Bean
    public AuthenticationFailureHandler failureHandler() {
        return (request, response, exception) -> {
            String msg = java.net.URLEncoder.encode(
                    exception.getMessage() == null ? "login_failed" : exception.getMessage(),
                    java.nio.charset.StandardCharsets.UTF_8
            );
            response.sendRedirect(frontBase + "/auth/callback?error=" + msg);
        };
    }
}
