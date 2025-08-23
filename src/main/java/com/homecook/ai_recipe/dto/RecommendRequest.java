package com.homecook.ai_recipe.dto;

import lombok.Getter;
import lombok.Setter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.Collections;
import java.util.List;

@Getter
@Setter
public class RecommendRequest {

    @NotNull @Positive
    private Double heightCm;  // 키 (cm)

    @NotNull @Positive
    private Double weightKg;  // 몸무게 (kg)

    @NotBlank
    private String ingredients; // 예: "닭가슴살, 파프리카, 두부"

    private String goal;         // 단일 목표
    private List<String> goals;  // 다중 목표

    private List<Long> excludeIds;

    // 단일/다중 모두 통합해서 반환
    public List<String> goalsNormalized() {
        if (goals != null && !goals.isEmpty()) return goals;
        if (goal != null && !goal.isBlank()) return List.of(goal);
        return Collections.emptyList();
    }
}