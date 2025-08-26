package com.homecook.ai_recipe.auth;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
        name = "user_account",
        uniqueConstraints = @UniqueConstraint(columnNames = "email")
)
public class UserAccount {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 190)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // --- getters / setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
