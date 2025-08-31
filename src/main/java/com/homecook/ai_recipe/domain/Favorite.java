// src/main/java/com/homecook/ai_recipe/domain/Favorite.java
package com.homecook.ai_recipe.domain;

import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "favorite",
        uniqueConstraints = @UniqueConstraint(name="uk_fav_user_recipe", columnNames={"user_id","recipe_id"}),
        indexes = { @Index(name="idx_fav_user", columnList="user_id") }
)
@Getter @Setter
public class Favorite {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="user_id", nullable=false)
    private Long userId;

    @Column(name="recipe_id", nullable=false)
    private Long recipeId;

    @Column(name="title", length=255)
    private String title;        // ★ 표시용

    @Column(name="summary")
    private String summary;      // ★ 표시용

    @Column(name="image")
    private String image;        // ★ 표시용(있으면 썸네일)

    @Column(name="meta", length=255)
    private String meta;         // ★ 예: "320kcal · 10분"

    @Column(name="created_at", nullable=false, updatable=false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { if (createdAt==null) createdAt = LocalDateTime.now(); }
}