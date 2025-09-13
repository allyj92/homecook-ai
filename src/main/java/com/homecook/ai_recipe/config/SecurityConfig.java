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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.cors.*;

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
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/uploads").permitAll()
                        // ✅ 파비콘/정적 리소스 허용
                        .requestMatchers(HttpMethod.GET, "/favicon.ico", "/robots.txt", "/assets/**", "/static/**").permitAll()
                        .anyRequest().permitAll()
                );
        return http.build();
    }

    /**
     * CORS 설정
     * - 개발 프록시(예: http://localhost:5173) 또는 LAN에서 접근하는 경우 허용
     * - 실제 배포에서는 origin을 정확히 제한하세요.
     */

    @GetMapping(value = "/{path:^(?!api|login|logout|oauth2|favicon\\.ico).*$}")
    public String spa() { return "forward:/index.html"; }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // 개발 편의: 와일드카드 ORIGIN은 credentials=true와 함께 사용할 수 없음.
        // 프록시를 쓰면 같은 오리진처럼 동작하므로 아래 Origins는 사실 크게 의미 없지만,
        // 만약 직접 다른 오리진에서 접근한다면 여기서 허용 도메인을 명시하세요.
        config.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173"
                // 필요 시 추가: "http://192.168.0.xxx:5173"
        ));
        config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        // 캐시(초)
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // 모든 경로에 동일 CORS 적용
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
