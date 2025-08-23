package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class RecipeIngredient {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)         // mappedBy 대상 필드명: "recipe"
    @JoinColumn(name = "recipe_id")
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id")
    private Ingredient ingredient;

    private String amount;   // 예: "150g"
    private int weight = 1;  // 매칭 가중치
}