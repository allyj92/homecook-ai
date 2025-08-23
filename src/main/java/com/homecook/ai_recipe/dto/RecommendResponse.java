package com.homecook.ai_recipe.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter
@Builder(toBuilder = true)
public class RecommendResponse {
    private Long id;
    private String title;
    private String summary;
    private Integer kcal, carbs_g, protein_g, fat_g, sodium_mg, cook_time_min;
    private List<String> ingredients_list;
    private List<String> steps;
    private String tips;

    // ✅ 프론트에서 목표 뱃지 표시에 유용
    private List<String> goals;
}