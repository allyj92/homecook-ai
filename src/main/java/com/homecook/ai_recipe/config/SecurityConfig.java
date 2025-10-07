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
     * API no-cache 필터 (실제로 등록되도록 @Bean 추가)
     * -------------------------------- */
    @Bean
    public FilterRegistrationBean<OncePerRequestFilter> apiNoCacheFilter() {
        var frb = new FilterRegistrationBean<OncePerRequestFilter>();
        frb.setOrder(Integer.MIN_VALUE + 10); // 매우 이르게
        frb.addUrlPatterns("/api/*");         // API만 대상
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
     * 체인 #1: 정적/에러/SPA 라우트 (permitAll, request cache 비활성화)
     *  - 여기서는 보안 필터 최소화 + /error 재포워드도 빠르게 통과
     * -------------------------------- */
    @Bean
    public SecurityFilterChain publicChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher(
                        "/", "/index.html", "/favicon.ico", "/manifest.webmanifest",
                        "/robots.txt", "/error",
                        "/assets/**", "/static/**", "/images/**", "/css/**", "/js/**"
                )
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                // ★ 경고 발생시키던 RequestCache 제거
                .requestCache(c -> c.disable())
                // 세션은 필요 없음
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }

    /* --------------------------------
     * 체인 #2: API 전용
     *  - 필요에 맞춰 permitAll/인증 요구 선택
     *  - /api/** 에서는 리다이렉트 대신 401 반환
     * -------------------------------- */
    @Bean
    public SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/**")
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth
                        // 여기선 정책에 맞게 조정하세요.
                        // 읽기만 공개라면 GET permitAll, 쓰기는 인증 등으로 나눌 수 있습니다.
                        .requestMatchers("/api/auth/logout").permitAll()
                        .anyRequest().permitAll()  // ← 필요 시 authenticated() 로 전환
                )
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                new AntPathRequestMatcher("/api/**")
                        )
                )
                .logout(lo -> lo
                        .logoutUrl("/api/auth/logout")
                        // 기본은 POST. 프론트가 POST로 호출해야 합니다.
                        .logoutSuccessHandler((req, res, auth) -> res.setStatus(204))
                )
                .requestCache(c -> c.disable()) // ★ API에도 cache 불필요
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));
        return http.build();
    }

    /* --------------------------------
     * 체인 #3: (선택) OAuth2 Login 등 웹 로그인 경로
     *  - 필요 시 /login/** 같은 경로를 별도로 분리
     * -------------------------------- */
    @Bean
    public SecurityFilterChain loginChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/login/**", "/oauth2/**") // 실제 사용하는 로그인 엔드포인트 범위
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
                            res.sendRedirect(frontBase + "/"); // 프론트가 /api/auth/me 호출
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
     * CORS: 패턴 또는 고정 오리진 중 하나만 사용 권장
     * (자격증명 허용 시 Access-Control-Allow-Origin 은 단일 값이어야 함)
     * -------------------------------- */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var cfg = new CorsConfiguration();
        // 패턴 방식만 사용 (서브도메인 허용)
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