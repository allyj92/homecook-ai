package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "password_reset_tokens", indexes = {
        @Index(name = "idx_token_unique", columnList = "token", unique = true),
        @Index(name = "idx_expires", columnList = "expiresAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PasswordResetToken {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Column(nullable = false, unique = true, length = 191)
    private String token;             // URL-safe

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;        // 만료 시간

    @Column(nullable = false)
    private boolean used;             // 사용 여부
}
