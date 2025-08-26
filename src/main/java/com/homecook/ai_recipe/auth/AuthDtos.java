package com.homecook.ai_recipe.auth;

import jakarta.validation.constraints.*;

public class AuthDtos {

    public record SignupReq(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 2, max = 60) String name,
            @NotBlank @Size(min = 8, max = 100) String password
    ) {}

    public record LoginReq(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    public record UserView(
            Long id,
            String email,
            String name,
            String avatar
    ) {}
}
