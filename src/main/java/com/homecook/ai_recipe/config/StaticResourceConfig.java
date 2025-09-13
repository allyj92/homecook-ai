package com.homecook.ai_recipe.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadDir = Paths.get("uploads").toAbsolutePath().normalize();
        registry.addResourceHandler("/static/uploads/**")
                .addResourceLocations(uploadDir.toUri().toString())  // file:/.../uploads/
                .setCachePeriod(31536000); // 1년 캐시
    }
}