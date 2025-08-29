// src/main/java/com/homecook/ai_recipe/wishlist/WishlistItem.java
package com.homecook.ai_recipe.wishlist;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wishlist_item",
        indexes = {
                @Index(name="idx_wishlist_user", columnList = "user_id"),
                @Index(name="idx_wishlist_key", columnList = "item_key")
        })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
// 하이버네이트 프록시 직렬화 시 잡음 제거
@JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
public class WishlistItem {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore // 🔴 직렬화시 user를 제외해 순환/프록시 문제 방지
    private UserAccount user;

    @Column(name = "item_key", nullable = false, length = 255)
    private String itemKey;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "summary", length = 1000)
    private String summary;

    @Column(name = "image", length = 1000)
    private String image;

    @Column(name = "meta", length = 255)
    private String meta;

    @Lob
    @Column(name = "payload_json")
    private String payloadJson;
}
