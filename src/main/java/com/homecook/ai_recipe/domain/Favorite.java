// src/main/java/com/homecook/ai_recipe/domain/Favorite.java
package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "favorite")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Favorite {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "recipe_id", nullable = false)
    private Long recipeId;

    @Column(columnDefinition = "TEXT") // 또는 LONGTEXT
    private String summary;

    @Column(length = 512) // 이미지 URL이면 255 넘을 수 있어요
    private String image;

    @Column(length = 200) // 제목도 넉넉히
    private String title;

    @Column(name = "meta", length = 4000)
    private String meta;

    @Column(name = "provider", length = 20)   // ★ 추가
    private String provider;                  // "naver" | "kakao" | "google" | "common"

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
