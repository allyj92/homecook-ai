// src/main/java/com/homecook/ai_recipe/config/OpenAIConfig.java
package com.homecook.ai_recipe.config;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

@Configuration
public class OpenAIConfig {

    // 환경변수 OPENAI_API_KEY 등을 자동으로 읽어오는 편리한 팩토리
    @Bean
    public OpenAIClient openAIClient() {
        return OpenAIOkHttpClient.fromEnv();
    }

    // 모델명 환경변수로 주입 (기본값은 gpt-4.1-mini)
    @Bean
    @Primary
    public String openAIModel(@Value("${openai.model:${OPENAI_MODEL:gpt-4.1-mini}}") String model) {
        return model;
    }
}