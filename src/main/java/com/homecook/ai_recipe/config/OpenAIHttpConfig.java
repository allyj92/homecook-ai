package com.homecook.ai_recipe.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
@Profile("http") // (선택) 프로파일 분리하고 싶다면
public class OpenAIHttpConfig {

    @Bean
    public WebClient openaiWebClient(@Value("${OPENAI_API_KEY}") String apiKey) {
        return WebClient.builder()
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
                .build();
    }

    @Bean
    public String openAIModel(@Value("${OPENAI_MODEL:${openai.model:gpt-4.1-mini}}") String model) {
        return model;
    }
}