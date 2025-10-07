// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService;
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
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
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

import java.io.IOException;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final CustomOidcUserService customOidcUserService;

    @Value("${app.front-base:https://recipfree.com}")
    private String frontBase;

    /* --------------------------------
     * (A) 정적 리소스는 보안체인 자체에서 제외 (가장 중요)
     * -------------------------------- */
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring().requestMatchers(
                "/favicon.ico",
                "/robots.txt",
                "/manifest.webmanifest",
                "/assets/**",
                "/static/**",
                "/images/**",
                "/css/**",
                "/js/**",
                "/uploads/**",
                "/files/**"
        );
    }

    /* --------------------------------
     * 공통: SecurityContext 저장소
     * -------------------------------- */
    @Bean
    public SecurityContextRepository securityContextRepository() {
        var repo = new HttpSessionSecurityContextRepository();
        repo.setDisableUrlRewriting(true);
        return repo;
    }

    /* --------------------------------
     * OAuth2 토큰 재시도(429 한정)
     * -------------------------------- */
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
                        continue;
                    }
                    throw ex;
                }
            }
        };
    }

    /* --------------------------------
     * API no-cache 필터 등록
     * -------------------------------- */
    @Bean
    public FilterRegistrationBean<OncePerRequestFilter> apiNoCacheFilter() {
        var frb = new FilterRegistrationBean<OncePerRequestFilter>();
        frb.setOrder(Integer.MIN_VALUE + 10);
        frb.addUrlPatterns("/api/*");
        frb.setFilter(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                chain.doFilter(req, res);
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
                res.setHeader("Pragma", "no-cache");
                res.setDateHeader("Expires", 0L);
            }
        });
        return frb;
    }

    /* --------------------------------
     * 체인 #1: 로그인/OAuth2 (가장 먼저)
     * -------------------------------- */
    @Bean
    @Order(0)
    public SecurityFilterChain loginChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/login/**", "/oauth2/**")
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(ui -> ui
                                .userService(customOAuth2UserService)
                                .oidcUserService(customOidcUserService)
                        )
                        .tokenEndpoint(t -> t.accessTokenResponseClient(retryingTokenClient()))
                        .successHandler((req, res, auth) -> {
                            System.out.println("[OAUTH] success: " + auth.getName());
                            res.sendRedirect(frontBase + "/");
                        })
                        .failureHandler((req, res, ex) -> {
                            ex.printStackTrace();
                            res.sendRedirect(frontBase + "/login-signup?error=" + ex.getClass().getSimpleName());
                        })
                )
                .requestCache(c -> c.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));
        return http.build();
    }

    /* --------------------------------
     * 체인 #2: /api/**
     * -------------------------------- */
    @Bean
    @Order(1)
    public SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/**")
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth
                        // 정책에 맞게 조정 (필요 시 authenticated()로 변경)
                        .requestMatchers("/api/auth/logout").permitAll()
                        .anyRequest().permitAll()
                )
                // API는 로그인 리다이렉트 대신 401
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                new AntPathRequestMatcher("/api/**")
                        )
                )
                .logout(lo -> lo
                        .logoutUrl("/api/auth/logout") // 프론트는 POST로 호출
                        .logoutSuccessHandler((req, res, auth) -> res.setStatus(204))
                )
                .requestCache(c -> c.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));
        return http.build();
    }

    /* --------------------------------
     * 체인 #3: 공개 라우트(/, /error 등) — 정적은 이미 ignoring이라 여기 안 탐
     * -------------------------------- */
    @Bean
    @Order(2)
    public SecurityFilterChain publicChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/", "/index.html", "/error")
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .requestCache(c -> c.disable())
                .logout(lo -> lo.disable()) // 디폴트 /logout 매핑 로그 노이즈 제거
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }

    /* --------------------------------
     * CORS: 패턴 방식 (자격증명 허용 시 단일 오리진/패턴만)
     * -------------------------------- */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of(
                "https://*.recipfree.com",
                "http://localhost:*",
                "http://127.0.0.1:*"
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
