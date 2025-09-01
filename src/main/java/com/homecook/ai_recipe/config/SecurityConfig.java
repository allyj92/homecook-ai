// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity // @PreAuthorize 등 사용하려면 유지
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // CORS (필요 시 도메인 화이트리스트로 제한)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // REST API면 CSRF 비활성화가 일반적
                .csrf(csrf -> csrf.disable())
                // 경로별 권한
                .authorizeHttpRequests(auth -> auth
                        // 커뮤니티 상세 조회는 공개
                        .requestMatchers(HttpMethod.GET, "/api/community/posts/**").permitAll()
                        // 커뮤니티 글 생성은 인증 필요
                        .requestMatchers(HttpMethod.POST, "/api/community/posts").authenticated()
                        // 예시: 레시피 추천은 로그인 필요(기존 요구사항 유지)
                        .requestMatchers("/api/recommend").authenticated()
                        // 그 외는 모두 허용(원하면 더 좁히세요)
                        .anyRequest().permitAll()
                )
                // 로그인/세션 관련 (프론트에서 처리하므로 폼/Basic 비활성화)
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());

        return http.build();
    }

    /** CORS 기본 설정: 개발 편의용(모든 Origin/헤더/메서드 허용) */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        // ★ 여기에 실제 프론트 오리진만 명시
        cfg.setAllowedOrigins(List.of(
                "https://recipfree.com",
                "https://www.recipfree.com"
        ));
        // 개발용(원할 때만 추가)
        // cfg.addAllowedOrigin("http://localhost:5173");
        // cfg.addAllowedOrigin("http://127.0.0.1:5173");

        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("Content-Type","Authorization","Cookie","X-Requested-With"));
        cfg.setAllowCredentials(true); // 쿠키/인증 허용
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
