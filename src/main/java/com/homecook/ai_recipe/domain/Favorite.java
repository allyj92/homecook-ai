// src/main/java/com/homecook/ai_recipe/domain/Favorite.java
package com.homecook.ai_recipe.domain;

import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

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

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "recipe_id", nullable = false)
    private Long recipeId;

    // ▼ 메타 필드들(옵션). DB에 이미 있으므로 엔티티에만 추가하면 됩니다.
    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "summary", length = 1000)
    private String summary;

    @Column(name = "image", length = 1000)
    private String image;

    @Column(name = "meta", length = 255)
    private String meta;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
