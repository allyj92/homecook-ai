// src/main/java/com/homecook/ai_recipe/auth/UserAuthProvider.java
package com.homecook.ai_recipe.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_auth_provider",
        uniqueConstraints = {
                @UniqueConstraint(name="uq_provider_pid",
                        columnNames = {"provider", "provider_id"})
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAuthProvider {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional=false, fetch=FetchType.LAZY)
    @JoinColumn(name="user_id", nullable=false)
    private UserAccount user;

    @Column(nullable=false, length=32)
    private String provider;          // google, naver, kakao, facebook...

    @Column(name="provider_id", nullable=false, length=128)
    private String providerId;        // sub/id

    @Column(nullable=false)
    private Instant createdAt;

    @PrePersist
    void pre() { if (createdAt==null) createdAt = Instant.now(); }
}
