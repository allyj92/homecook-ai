// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.cors.*;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {


    @Bean
    public SecurityContextRepository securityContextRepository() {
        HttpSessionSecurityContextRepository repo = new HttpSessionSecurityContextRepository();
        // 필요시: repo.setDisableUrlRewriting(true);
        return repo;
    }

    /**
     * 보안 필터 체인
     *
     * - /api/** 에 대해 CSRF 미적용 (MVP의 REST API 용도)
     * - CORS 기본 허용 (아래 corsConfigurationSource Bean과 함께 동작)
     * - 인증/업로드/정적 리소스/프리플라이트 등 퍼블릭 접근 허용
     * - 나머지는 필요에 맞게 조정 (현재는 permitAll)
     */
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/index.html", "/favicon.ico", "/robots.txt",
                                "/assets/**", "/static/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()   // ★ OAuth2 엔드포인트 허용
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/uploads").permitAll()
                        .anyRequest().permitAll()
                )
                .oauth2Login(oauth -> oauth                              // ★ 반드시 있어야 함
                                // .loginPage("/")                                     // SPA면 생략 가능
                                .defaultSuccessUrl("/", true)
                                .failureUrl("/login?error")
                        // 커스텀 유저서비스 쓰면 아래 주석 해제
                        // .userInfoEndpoint(u -> u.userService(customOAuth2UserService))
                )
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessUrl("/")
                        .deleteCookies("JSESSIONID")
                        .clearAuthentication(true)
                        .invalidateHttpSession(true)
                );

        return http.build();
    }

    // 프록시/HTTPS 헤더 처리(운영 권장)
    @Bean
    public ForwardedHeaderFilter forwardedHeaderFilter() {
        return new ForwardedHeaderFilter();
    }
}