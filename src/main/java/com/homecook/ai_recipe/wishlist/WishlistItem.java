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
@Access(AccessType.FIELD) // ✅ 필드 기반 매핑으로 고정(중복 매핑 방지)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WishlistItem {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name="user_id", nullable=false, foreignKey = @ForeignKey(name="fk_wishlist_user"))
    private UserAccount user;

    @Column(name="item_key", nullable=false, length=128)
    private String itemKey;

    @Column(nullable=false)
    private String title;

    private String summary;
    private String image;
    private String meta;

    @Lob
    private String payloadJson;

    // ✅ 'createdAt'은 필드에 "단 한 번만" 매핑. 게터/세터에는 절대 @Column 붙이지 마세요.
    @Column(name="created_at", nullable=false, updatable=false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = LocalDateTime.now(); }
}
