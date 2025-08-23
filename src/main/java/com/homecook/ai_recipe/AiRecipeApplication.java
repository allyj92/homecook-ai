package com.homecook.ai_recipe;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

@SpringBootApplication
public class AiRecipeApplication {
    public static void main(String[] args) {
        SpringApplication.run(AiRecipeApplication.class, args);
    }
}