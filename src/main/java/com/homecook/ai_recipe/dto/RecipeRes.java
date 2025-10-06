package com.homecook.ai_recipe.dto;

import com.homecook.ai_recipe.domain.Recipe;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RecipeRes {
    private Long id;
    private String title;
    private String summary;
    private Integer kcal, carbsG, proteinG, fatG, sodiumMg, cookTimeMin;
    private Instant createdAt;

    public static RecipeRes from(Recipe r) {
        return RecipeRes.builder()
                .id(r.getId())
                .title(r.getTitle())
                .summary(r.getSummary())
                .kcal(r.getKcal())
                .carbsG(r.getCarbsG())
                .proteinG(r.getProteinG())
                .fatG(r.getFatG())
                .sodiumMg(r.getSodiumMg())
                .cookTimeMin(r.getCookTimeMin())
                .createdAt(r.getCreatedAt())
                .build();
    }
}