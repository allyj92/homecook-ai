package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Recipe {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String summary;

    private Integer kcal, carbsG, proteinG, fatG, sodiumMg, cookTimeMin;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeIngredient> ingredients = new ArrayList<>();

    @ElementCollection
    private List<String> steps = new ArrayList<>();

    private String tips;
}