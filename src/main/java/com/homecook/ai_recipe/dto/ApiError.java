package com.homecook.ai_recipe.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ApiError {
    private final String message;
}