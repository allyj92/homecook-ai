package com.homecook.ai_recipe.dto;


import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RecipeCreateReq {
    @NotBlank
    String title;
    String summary;
    Integer kcal, carbsG, proteinG, fatG, sodiumMg, cookTimeMin;
    String tips;
    String repImageUrl; // 엔티티에 필드 있으면 매핑
}