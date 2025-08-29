// src/main/java/com/homecook/ai_recipe/domain/WishlistItem.java
package com.homecook.ai_recipe.domain;

import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WishlistItem {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private UserAccount user;

    private Long recipeId;          // 레시피 ID (AI가 생성한 것이라면 별도 관리 필요)
    private String title;           // 레시피 제목
    private String summary;         // 요약
    private String imageUrl;        // 대표 이미지

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
