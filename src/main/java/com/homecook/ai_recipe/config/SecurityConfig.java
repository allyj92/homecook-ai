// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.service.CustomOAuth2UserService; // ← 실제 클래스 패키지에 맞게! (service가 아니라 auth)
import com.homecook.ai_recipe.service.CustomOidcUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.*;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService; // 네이버/카카오
    private final CustomOidcUserService customOidcUserService;   // ✅ 구글(OIDC)
    // ✅ 구글(OIDC)



    @Bean
    public SecurityContextRepository securityContextRepository() {
        var repo = new HttpSessionSecurityContextRepository();
        repo.setDisableUrlRewriting(true);
        return repo;
    }

    @Value("${app.front-base:https://recipfree.com}")
    private String frontBase;

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        .requestMatchers("/", "/favicon.ico",
                                "/assets/**", "/static/**", "/css/**", "/js/**", "/images/**").permitAll()

                        .requestMatchers("/oauth2/**", "/login/oauth2/code/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()

                        .requestMatchers(HttpMethod.GET,
                                "/api/community/posts", "/api/community/posts/*").permitAll()

                        .requestMatchers("/api/community/**").authenticated()

                        .requestMatchers("/files/**").permitAll()     // 저장된 이미지 접근 허용
                        .requestMatchers("/api/upload").authenticated()// 업로드는 로그인만

                        .anyRequest().permitAll()
                )

                // ★ /api/** 에서는 로그인 페이지 리다이렉트 금지하고 401만 내려주기
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                new AntPathRequestMatcher("/api/**")
                        )
                )

                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(ui -> ui
                                .userService(customOAuth2UserService)
                                .oidcUserService(customOidcUserService) // ✅ OIDC
                        )

                        .successHandler((req, res, auth) -> {
                            System.out.println("[OAUTH] success: " + auth.getName());
                            res.sendRedirect(frontBase + "/"); // 프론트가 세션 쿠키로 auth/me 호출
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
        // 와일드카드 & 명시 오리진 병행
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
