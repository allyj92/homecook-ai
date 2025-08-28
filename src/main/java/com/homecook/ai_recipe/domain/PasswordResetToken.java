package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Setter @Getter
public class PasswordResetToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Column(unique = true, nullable = false, length = 120)
    private String token;

    private Instant expiresAt;
    private Instant usedAt;

    // getters/setters
}