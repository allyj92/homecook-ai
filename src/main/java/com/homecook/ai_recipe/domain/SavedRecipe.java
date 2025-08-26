// src/main/java/com/homecook/ai_recipe/domain/SavedRecipe.java
package com.homecook.ai_recipe.domain;

import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "saved_recipe",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id","recipe_id"}),
        indexes = @Index(name="ix_saved_user", columnList = "user_id"))
public class SavedRecipe {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id", nullable=false)
    private UserAccount user;

    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="recipe_id", nullable=false)
    private Recipe recipe;

    @Column(nullable=false, updatable=false)
    private Instant savedAt = Instant.now();

    // getters/setters...
}
