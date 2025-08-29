// src/main/java/com/homecook/ai_recipe/wishlist/WishlistItem.java
package com.homecook.ai_recipe.wishlist;

import com.homecook.ai_recipe.auth.UserAccount;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wishlist_item",
        uniqueConstraints = @UniqueConstraint(name="uq_user_key", columnNames = {"user_id","item_key"}),
        indexes = {
                @Index(name="idx_user", columnList = "user_id"),
                @Index(name="idx_item_key", columnList = "item_key")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WishlistItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 로그인 사용자 */
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name="user_id", nullable=false, foreignKey = @ForeignKey(name="fk_wishlist_user"))
    private UserAccount user;

    /** 레시피를 대표하는 안정 키 (예: recipeId, 없으면 프론트가 해시) */
    @Column(name="item_key", nullable=false, length=128)
    private String itemKey;

    /** 표시용 메타 (카드에 바로 쓰기) */
    @Column(nullable=false) private String title;
    @Column(nullable=true)  private String summary;
    @Column(nullable=true)  private String image;   // 썸네일 URL(선택)
    @Column(nullable=true)  private String meta;    // "380kcal · 20분" 같은 요약

    /** 원본 페이로드(JSON 문자열로 보관. 필요 시) */
    @Lob @Column(nullable = true)
    private String payloadJson;

    @Column(name="created_at", nullable=false, updatable=false)
    private LocalDateTime createdAt;

    @PrePersist void onCreate() { this.createdAt = LocalDateTime.now(); }
}
