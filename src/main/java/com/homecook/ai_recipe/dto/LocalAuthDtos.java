// src/main/java/com/homecook/ai_recipe/dto/LocalAuthDtos.java
package com.homecook.ai_recipe.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

public class LocalAuthDtos {
    @Data
    public static class RegisterReq {
        @NotBlank @Email private String email;
        @NotBlank private String password; // 8~64 권장, 프론트에서 1차 체크
        private String name;
    }
    @Data
    public static class LoginReq {
        @NotBlank @Email private String email;
        @NotBlank private String password;
    }
}
