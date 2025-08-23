package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry r) {
        r.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173", "https://recipfree.com")
                .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
                .allowCredentials(true);
    }
}
