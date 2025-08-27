package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity   // @PreAuthorize 사용 가능하게
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // REST API 서버니까 CSRF는 비활성화
                .csrf(csrf -> csrf.disable())

                // 요청 인증 규칙
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/recommend").authenticated() // 레시피 추천은 로그인 필요
                        .anyRequest().permitAll()                          // 나머지는 공개
                )

                // 세션 기반 로그인 유지
                .formLogin(form -> form.disable()) // 프론트에서 로그인 처리하므로 기본 로그인 폼 제거
                .httpBasic(basic -> basic.disable()); // REST API에선 Basic Auth도 제거

        return http.build();
    }
}