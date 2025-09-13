// src/main/java/com/homecook/ai_recipe/config/SecurityConfig.java
package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
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
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // CSRF: API는 비상태성 호출이 많아 우선 제외. (폼 로그인 페이지가 있다면 /web/** 쪽만 CSRF 적용 고려)
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))

                // CORS: 아래 corsConfigurationSource() 설정 사용
                .cors(Customizer.withDefaults())

                // 세부 권한
                .authorizeHttpRequests(auth -> auth
                        // 프리플라이트
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 인증/세션 관련 엔드포인트 (상황에 맞게 조정)
                        .requestMatchers("/api/auth/**").permitAll()

                        // 업로드(임시 오픈) — 테스트가 끝나면 authenticated()로 바꿔서 로그인 사용자만 허용 추천
                        .requestMatchers(HttpMethod.POST, "/api/uploads").permitAll()

                        // 정적 리소스(업로드 파일 서빙)
                        .requestMatchers(HttpMethod.GET, "/static/**").permitAll()

                        // 그 외 공개 리소스가 있다면 이어서 나열
                        //.requestMatchers("/", "/favicon.ico", "/assets/**").permitAll()

                        // 나머지 (필요 시 authenticated()로 전환)
                        .anyRequest().permitAll()
                );

        // 세션/로그인 방식(formLogin/httpBasic 등)이 필요하면 아래에서 추가 설정하세요.
        // 예) http.httpBasic(Customizer.withDefaults());

        return http.build();
    }

    /**
     * CORS 설정
     * - 개발 프록시(예: http://localhost:5173) 또는 LAN에서 접근하는 경우 허용
     * - 실제 배포에서는 origin을 정확히 제한하세요.
     */
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
