// src/main/java/com/homecook/ai_recipe/auth/AccountLinkToken.java
package com.homecook.ai_recipe.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "account_link_token",
        indexes = @Index(name="idx_expires_at", columnList = "expires_at"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccountLinkToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false)
    private Long userId;              // 로컬 유저(기존계정) id

    @Column(nullable=false, length=32)
    private String provider;

    @Column(name="provider_id", nullable=false, length=128)
    private String providerId;

    @Column(nullable=false, unique=true, length=200)
    private String token;

    @Column(name="expires_at", nullable=false)
    private Instant expiresAt;

    @Column(nullable=false)
    private Instant createdAt;

    @PrePersist
    void pre() {
        if (createdAt==null) createdAt = Instant.now();
        if (expiresAt==null) expiresAt = createdAt.plusSeconds(60*30); // 30분
    }
}
