package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "recipe", indexes = {
        @Index(name = "ix_recipe_title", columnList = "title")
})
@Getter @Setter @NoArgsConstructor
public class Recipe {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private Integer kcal, carbsG, proteinG, fatG, sodiumMg, cookTimeMin;

    // 작성 시각(정렬/신규 노출용)
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeIngredient> ingredients = new ArrayList<>();

    // 단계 순서가 중요하니 @OrderColumn으로 정렬 보장 + TEXT 칼럼
    @ElementCollection
    @CollectionTable(name = "recipe_step", joinColumns = @JoinColumn(name = "recipe_id"))
    @OrderColumn(name = "step_order")
    @Column(name = "content", columnDefinition = "TEXT")
    private List<String> steps = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String tips;

    // 편의 메서드 (양방향 연관관계 유지용) — 있으면 편하고, 없어도 됨
    public void addIngredient(RecipeIngredient ing) {
        ingredients.add(ing);
        ing.setRecipe(this);
    }
    public void removeIngredient(RecipeIngredient ing) {
        ingredients.remove(ing);
        ing.setRecipe(null);
    }
}
