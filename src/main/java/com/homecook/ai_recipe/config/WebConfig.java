package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry reg) {
                reg.addMapping("/api/**")
                        .allowedOriginPatterns("http://localhost:5174","http://127.0.0.1:5174","http://localhost:5173","http://127.0.0.1:5173","*")
                        .allowedMethods("GET","POST","PUT","PATCH","DELETE","OPTIONS")
                        .allowedHeaders("*")
                        .exposedHeaders("*")
                        .allowCredentials(false)
                        .maxAge(3600);
            }
        };
    }
}