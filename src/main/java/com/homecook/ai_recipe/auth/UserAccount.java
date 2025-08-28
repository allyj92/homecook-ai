// src/main/java/com/homecook/ai_recipe/auth/UserAccount.java
package com.homecook.ai_recipe.auth;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(
        name = "user_account",
        uniqueConstraints = { @UniqueConstraint(name="uk_user_email", columnNames = "email") }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false, length=180)
    private String email;

    @Column(nullable=false, length=80)
    private String passwordHash; // BCrypt

    @Column(length=80)
    private String name;

    @Column(length=512)
    private String avatar;

    @Column(nullable=false)
    private Instant createdAt;

    @PrePersist void prePersist(){ if (createdAt==null) createdAt = Instant.now(); }
}
