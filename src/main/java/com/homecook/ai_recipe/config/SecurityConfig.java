// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService; // 실제 패키지에 맞추세요 (예: com.homecook.ai_recipe.auth.*)
import com.homecook.ai_recipe.service.CustomOidcUserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.endpoint.DefaultAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService; // 네이버/카카오
    private final CustomOidcUserService customOidcUserService;     // 구글(OIDC)

    public FilterRegistrationBean<OncePerRequestFilter> apiNoCacheFilter() {
        var frb = new FilterRegistrationBean<OncePerRequestFilter>();
        frb.setOrder(Integer.MIN_VALUE + 10); // 매우 이르게
        frb.addUrlPatterns("/api/*");         // API만 대상
        frb.setFilter(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, java.io.IOException {
                chain.doFilter(req, res);
                // API 응답은 항상 최신만
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
                res.setHeader("Pragma", "no-cache");
                res.setDateHeader("Expires", 0L);
            }
        });
        return frb;
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        var repo = new HttpSessionSecurityContextRepository();
        repo.setDisableUrlRewriting(true);
        return repo;
    }

    @Value("${app.front-base:https://recipfree.com}")
    private String frontBase;

    /** 429(레이트리밋)일 때만 짧게 재시도하는 토큰 클라이언트 */
    @Bean
    public OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> retryingTokenClient() {
        DefaultAuthorizationCodeTokenResponseClient delegate = new DefaultAuthorizationCodeTokenResponseClient();
        return request -> {
            int attempts = 0;
            while (true) {
                try {
                    return delegate.getTokenResponse(request);
                } catch (OAuth2AuthorizationException ex) {
                    boolean is429 =
                            ex.getCause() instanceof HttpClientErrorException.TooManyRequests ||
                                    (ex.getError() != null &&
                                            String.valueOf(ex.getError().getDescription()).toLowerCase().contains("rate limit"));
                    if (is429 && ++attempts < 3) {
                        try { Thread.sleep(250L * attempts); } catch (InterruptedException ignored) {}
                        continue; // 재시도
                    }
                    throw ex;
                }
            }
        };
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/", "/favicon.ico", "/assets/**", "/static/**", "/css/**", "/js/**", "/images/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/code/**").permitAll()

                        // 로컬 가입/로그인 엔드포인트는 명시적으로 열기
                        .requestMatchers("/api/auth/local/**").permitAll()

                        // 기타 auth 유틸성 엔드포인트
                        .requestMatchers("/api/auth/**").permitAll()

                        .requestMatchers("/api/me/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/community/posts", "/api/community/posts/*").permitAll()
                        .requestMatchers("/api/community/**").authenticated()
                        .requestMatchers("/files/**").permitAll()
                        .requestMatchers("/api/upload").authenticated()
                        .anyRequest().permitAll()
                )

                // /api/** 에서는 로그인 리다이렉트 대신 401만 반환
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                new AntPathRequestMatcher("/api/**")
                        )
                )

                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(ui -> ui
                                .userService(customOAuth2UserService)
                                .oidcUserService(customOidcUserService)
                        )
                        // ★ 토큰 교환 단계에 재시도 클라이언트 적용
                        .tokenEndpoint(t -> t.accessTokenResponseClient(retryingTokenClient()))
                        .successHandler((req, res, auth) -> {
                            System.out.println("[OAUTH] success: " + auth.getName());
                            res.sendRedirect(frontBase + "/"); // 프론트가 /api/auth/me 호출
                        })
                        .failureHandler((req, res, ex) -> {
                            ex.printStackTrace();
                            res.sendRedirect(frontBase + "/login-signup?error=" + ex.getClass().getSimpleName());
                        })
                )

                .logout(lo -> lo
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler((req, res, auth) -> res.setStatus(204))
                )

                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of("https://*.recipfree.com"));
        cfg.setAllowedOrigins(List.of(
                "http://localhost:5173", "http://127.0.0.1:5173",
                "https://recipfree.com", "https://login.recipfree.com"
        ));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
